const { app, BrowserWindow, globalShortcut, ipcMain, webFrameMain, shell, Menu, MenuItem, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { version } = require('./package.json');

const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const desktopUserAgentClientHints = {
  'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};

// Set the name before app is ready for better Dock/Taskbar display in dev
app.setName('Copilot Desktop CE');
app.userAgentFallback = desktopUserAgent;

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

function appendLogFile(fileName, message) {
  if (!app.isReady()) return;

  fs.appendFile(
    path.join(app.getPath('userData'), fileName),
    `${new Date().toISOString()} ${message}\n`,
    () => {}
  );
}

function logNavigation(scope, action, url) {
  const message = `[Navigation:${scope}] ${action}: ${url}`;
  console.log(message);
  appendLogFile('navigation.log', message);
}

function logApp(message) {
  const line = `[App] ${message}`;
  console.log(line);
  appendLogFile('app.log', line);
}

function configureSessionForMicrosoftAuth(targetSession) {
  targetSession.setUserAgent(desktopUserAgent);
  targetSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const requestHeaders = { ...details.requestHeaders };

    requestHeaders['User-Agent'] = desktopUserAgent;
    Object.entries(desktopUserAgentClientHints).forEach(([name, value]) => {
      requestHeaders[name] = value;
    });

    callback({ requestHeaders });
  });
}

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function hostnameMatches(hostname, domain) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function isCopilotUrl(url) {
  return hostnameMatches(getHostname(url), 'copilot.microsoft.com');
}

function isMicrosoftAuthUrl(url) {
  const hostname = getHostname(url);
  return [
    'login.live.com',
    'login.microsoft.com',
    'login.microsoftonline.com',
    'account.live.com',
    'account.microsoft.com',
  ].some((domain) => hostnameMatches(hostname, domain));
}

function isAllowedInAppUrl(url) {
  const hostname = getHostname(url);
  return isCopilotUrl(url) ||
    isMicrosoftAuthUrl(url) ||
    hostnameMatches(hostname, 'bing.com') ||
    hostnameMatches(hostname, 'microsoft.com') ||
    hostnameMatches(hostname, 'live.com');
}

function reloadMainWindowAfterAuth(authWindow) {
  if (!win || win.isDestroyed()) return;

  logNavigation('auth', 'completed, reloading main window', 'https://copilot.microsoft.com');
  win.loadURL('https://copilot.microsoft.com');
  win.focus();

  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.close();
  }
}

function watchAuthWindow(authWindow, initialUrl) {
  let sawAuthNavigation = isMicrosoftAuthUrl(initialUrl);
  logNavigation('auth-popup', 'created', initialUrl);
  authWindow.webContents.setUserAgent(desktopUserAgent);

  const handleNavigation = (url, canCompleteAuth = false) => {
    logNavigation('auth-popup', canCompleteAuth ? 'did-navigate' : 'redirect', url);

    if (isMicrosoftAuthUrl(url)) {
      sawAuthNavigation = true;
    }

    if (canCompleteAuth && sawAuthNavigation && isCopilotUrl(url)) {
      reloadMainWindowAfterAuth(authWindow);
    }
  };

  authWindow.webContents.on('did-navigate', (_event, url) => handleNavigation(url, true));
  authWindow.webContents.on('did-redirect-navigation', (_event, url) => handleNavigation(url));
  authWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedInAppUrl(url)) return;

    logNavigation('auth-popup', 'external', url);
    event.preventDefault();
    shell.openExternal(url);
  });
  authWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInAppUrl(url)) return { action: 'allow' };

    logNavigation('auth-popup', 'external-window', url);
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

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

function createApplicationMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { role: 'close' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: `About Copilot Desktop CE ${version}`,
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About Copilot Desktop CE',
              message: 'Copilot Desktop CE',
              detail: `Version ${version}`,
              buttons: ['OK'],
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
      nodeIntegrationInSubFrames: false,
    },
  });

  win.webContents.setUserAgent(desktopUserAgent);
  win.loadURL('https://copilot.microsoft.com');

  // Keep Copilot sign-in inside Electron so auth cookies land in this app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInAppUrl(url)) return { action: 'allow' };

    logNavigation('main', 'external-window', url);
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('did-create-window', (childWindow, details) => {
    watchAuthWindow(childWindow, details.url);
  });

  // Intercept standard navigation to open external links in default browser
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedInAppUrl(url)) {
      logNavigation('main', 'external', url);
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
    if (frame && isCopilotUrl(frame.url)) {
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

app.whenReady().then(() => {
  configureSessionForMicrosoftAuth(session.defaultSession);
  logApp(`Starting Copilot Desktop CE ${version}`);
  logApp(`Using user agent: ${desktopUserAgent}`);
  createApplicationMenu();
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
