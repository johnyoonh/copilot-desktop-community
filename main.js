const { app, BrowserWindow, globalShortcut, ipcMain, webFrameMain, shell, Menu, MenuItem, session, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');

// Set the name before app is ready for better Dock/Taskbar display in dev
app.setName('Copilot Desktop CE');

// Register URL scheme for deep linking
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('copilot', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('copilot');
}

let win;
const contentJs = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

function handleDeepLink(url) {
  if (!win) return;
  try {
    const parsedUrl = new URL(url);
    const query = parsedUrl.searchParams.get('q');

    if (query) {
      console.log(`[Main] Received deep link prompt: "${query}"`);
      win.loadURL(`https://copilot.microsoft.com/?q=${encodeURIComponent(query)}`);
    }
  } catch (err) {
    console.error('[Main] Failed to parse deep link URL:', err);
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
    handleDeepLink(url);
  } else {
    app.once('ready', () => handleDeepLink(url));
  }
});

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'Copilot Desktop CE',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: true, // Crucial for iframes
    },
  });

  win.loadURL('https://copilot.microsoft.com');

  // Open external links (target="_blank") in default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('copilot.microsoft.com') && !parsedUrl.hostname.includes('login.live.com')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Intercept standard navigation to open external links in default browser
  win.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes('copilot.microsoft.com') && 
        !parsedUrl.hostname.includes('bing.com') && 
        !parsedUrl.hostname.includes('microsoft.com') && 
        !parsedUrl.hostname.includes('live.com')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // Right-click context menu
  win.webContents.on('context-menu', (event, params) => {
    const menu = new Menu();

    // Add basic edit actions
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'cut' }));
      menu.append(new MenuItem({ role: 'copy' }));
      menu.append(new MenuItem({ role: 'paste' }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ role: 'copy' }));
    }

    // Add link options
    if (params.linkURL) {
      menu.append(new MenuItem({
        label: 'Open Link in Default Browser',
        click: () => shell.openExternal(params.linkURL)
      }));
      menu.append(new MenuItem({
        label: 'Open Link in Preview Window',
        click: () => {
          const previewWin = new BrowserWindow({
            width: 1000,
            height: 800,
            title: 'Preview',
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true
            }
          });
          previewWin.loadURL(params.linkURL);
        }
      }));
      menu.append(new MenuItem({
        label: 'Copy Link Address',
        role: 'copyLink',
      }));
    }

    // Add inspect element for debugging
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(new MenuItem({
      label: 'Inspect Element',
      click: () => win.webContents.inspectElement(params.x, params.y)
    }));

    menu.popup(win);
  });

  // Inject into every frame as it finishes loading
  win.webContents.on('did-frame-finish-load', (event, isMainFrame, frameProcessId, frameRoutingId) => {
    const frame = webFrameMain.fromId(frameProcessId, frameRoutingId);
    if (frame) {
      console.log(`[Main] Injecting JS into frame: ${frame.url}`);
      frame.executeJavaScript(contentJs).catch(err => {
        console.error(`[Main] Failed to inject JS into frame ${frame.url}:`, err);
      });
    }
  });

  // Handle App-Specific Shortcuts using before-input-event
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    const isCmdOrCtrl = input.meta || input.control;

    if (isCmdOrCtrl) {
      const key = input.key.toUpperCase();
      const validLetterKeys = ['N', 'L', 'T', 'D', 'S', 'I', 'B', 'M', 'K', 'E'];

      // Basic letter shortcuts
      if (validLetterKeys.includes(key) && !input.shift) {
        win.webContents.send('trigger-shortcut', `Key${key}`);
        event.preventDefault();
      } 
      else if (key === ',' && !input.shift) {
        win.webContents.send('trigger-shortcut', 'Comma');
        event.preventDefault();
      } 
      else if (key === '.' && !input.shift) {
        win.webContents.send('trigger-shortcut', 'Period');
        event.preventDefault();
      }
      // Cmd+U intentionally NOT intercepted here — letting the native keydown
      // reach the renderer preserves the user-activation required for
      // getUserMedia (microphone) when content.js clicks "Talk to Copilot".

      // Show shortcuts modal
      else if (key === '/' && !input.shift) {
        win.webContents.send('show-shortcuts-modal');
        event.preventDefault();
      } 
      // Show find bar
      else if (key === 'F' && !input.shift) {
        win.webContents.send('show-find-bar');
        event.preventDefault();
      } 
      // Shift+O shortcut
      else if (key === 'O' && input.shift) {
        win.webContents.send('trigger-shortcut', 'KeyO');
        event.preventDefault();
      }
      // Cmd+Shift+M: open macOS/Windows microphone privacy settings
      else if (key === 'M' && input.shift) {
        if (process.platform === 'darwin') {
          shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
        } else if (process.platform === 'win32') {
          shell.openExternal('ms-settings:privacy-microphone');
        }
        event.preventDefault();
      }
      // Cmd+Shift+D: show mic diagnostics banner in renderer
      else if (key === 'D' && input.shift) {
        win.webContents.send('show-mic-diagnostics');
        event.preventDefault();
      } 
      // Navigation Back
      else if (key === '[' && !input.shift) {
        if (win.webContents.navigationHistory.canGoBack()) win.webContents.navigationHistory.goBack();
        event.preventDefault();
      } 
      // Navigation Forward
      else if (key === ']' && !input.shift) {
        if (win.webContents.navigationHistory.canGoForward()) win.webContents.navigationHistory.goForward();
        event.preventDefault();
      }
    }
  });
}
ipcMain.on('find-in-page', (event, text, options) => {
  if (win && win.webContents) {
    console.log(`[Main] Search requested for: "${text}" with options:`, options);
    win.webContents.findInPage(text, options || {});
  }
});

ipcMain.on('stop-find', () => {
  if (win && win.webContents) {
    console.log('[Main] Search stopped');
    win.webContents.stopFindInPage('clearSelection');
  }
});

ipcMain.handle('get-mic-diagnostics', () => getMicDiagnostics());

ipcMain.on('open-mic-settings', () => {
  if (process.platform === 'darwin') {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone');
  } else if (process.platform === 'win32') {
    shell.openExternal('ms-settings:privacy-microphone');
  }
});

// Grant microphone (and related media) permission to Copilot origins so that
// the page's getUserMedia call actually receives an audio track when the user
// activates "Talk to Copilot". Without this, Electron silently denies the
// request and the voice UI appears to "listen" but hears nothing.
const ALLOWED_MEDIA_ORIGINS = new Set([
  'https://copilot.microsoft.com',
  'https://www.copilot.microsoft.com',
]);

const MEDIA_PERMISSIONS = new Set(['media', 'microphone', 'audioCapture']);

function isAllowedMediaOrigin(originOrUrl) {
  if (!originOrUrl) return false;
  try {
    return ALLOWED_MEDIA_ORIGINS.has(new URL(originOrUrl).origin);
  } catch {
    return false;
  }
}

function configureMediaPermissions() {
  const s = session.defaultSession;

  s.setPermissionRequestHandler((webContents, permission, callback, details) => {
    if (MEDIA_PERMISSIONS.has(permission)) {
      const requestingUrl = details?.requestingUrl || webContents?.getURL();
      const mediaTypes = details?.mediaTypes ? JSON.stringify(details.mediaTypes) : '[]';
      const allow = isAllowedMediaOrigin(requestingUrl);
      console.log(`[Main] Permission REQUEST: ${permission} mediaTypes=${mediaTypes} url=${requestingUrl} -> ${allow ? 'ALLOW' : 'DENY'}`);
      return callback(allow);
    }
    callback(false);
  });

  s.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    if (MEDIA_PERMISSIONS.has(permission)) {
      const allow = isAllowedMediaOrigin(requestingOrigin);
      console.log(`[Main] Permission CHECK: ${permission} origin=${requestingOrigin} -> ${allow ? 'ALLOW' : 'DENY'}`);
      return allow;
    }
    return false;
  });

  // Accept device access on macOS 15+ (enumerateDevices labels, etc.)
  s.setDevicePermissionHandler?.((details) => {
    if (details.deviceType === 'audioInput' || details.deviceType === 'videoInput') {
      return isAllowedMediaOrigin(details.origin);
    }
    return false;
  });
}

function getMicDiagnostics() {
  const info = {
    platform: process.platform,
    execPath: process.execPath,
    bundlePath: app.getPath('exe'),
    appName: app.getName(),
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    micStatus: 'unknown',
  };
  if (process.platform === 'darwin') {
    try { info.micStatus = systemPreferences.getMediaAccessStatus('microphone'); } catch {}
  }
  return info;
}

// Prompt the macOS mic access dialog up front so the OS-level permission is
// in place before the user triggers voice. Safe no-op on non-darwin.
async function primeMacMicrophoneAccess() {
  if (process.platform !== 'darwin') return;
  try {
    const status = systemPreferences.getMediaAccessStatus('microphone');
    console.log(`[Main] macOS microphone access status: ${status}`);
    if (status !== 'granted') {
      const granted = await systemPreferences.askForMediaAccess('microphone');
      console.log(`[Main] macOS microphone access granted: ${granted}`);
    }
  } catch (err) {
    console.error('[Main] Failed to query/request microphone access:', err);
  }
}

app.whenReady().then(async () => {
  configureMediaPermissions();
  await primeMacMicrophoneAccess();
  createWindow();

  // Listen for results globally
  win.webContents.on('found-in-page', (event, result) => {
    console.log(`[Main] Search Match: ${result.activeMatchOrdinal}/${result.matches} (final=${result.finalUpdate})`);
    
    // Send to renderer regardless of finalUpdate so the UI feels responsive
    win.webContents.send('find-results', {
      activeMatchOrdinal: result.activeMatchOrdinal,
      matches: result.matches
    });
  });


  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
