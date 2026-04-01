const { app, BrowserWindow, globalShortcut, ipcMain, webFrameMain, shell, Menu, MenuItem } = require('electron');
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

  // Handle Global Shortcuts
  win.on('focus', () => {
    // Removed 'A', 'C', 'V', 'X' to prevent conflicts with Select All, Copy, Paste, and Cut
    const shortcuts = ['N', 'L', 'T', 'D', 'S', 'I', 'B', 'M', 'K', 'E', 'Comma', 'Period'];
    shortcuts.forEach(key => {
      let accelerator = `CommandOrControl+${key}`;
      if (key === 'Comma') accelerator = 'CommandOrControl+,';
      if (key === 'Period') accelerator = 'CommandOrControl+.';

      globalShortcut.register(accelerator, () => {
        if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
          win.webContents.send('trigger-shortcut', key === 'Comma' ? 'Comma' : (key === 'Period' ? 'Period' : `Key${key}`) );
        }
      });
    });

    // Voice Shortcut (moved to U to avoid Cmd+V Paste conflict)
    globalShortcut.register('CommandOrControl+U', () => {
      if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('trigger-shortcut', 'KeyV');
    });

    globalShortcut.register('CommandOrControl+/', () => {
      if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('show-shortcuts-modal');
    });
    
    globalShortcut.register('CommandOrControl+F', () => {
      if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('show-find-bar');
    });

    globalShortcut.register('CommandOrControl+Shift+O', () => {
      if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send('trigger-shortcut', 'KeyO');
    });

    globalShortcut.register('CommandOrControl+[', () => {
      if (win && !win.isDestroyed() && !win.webContents.isDestroyed() && win.webContents.navigationHistory.canGoBack()) win.webContents.navigationHistory.goBack();
    });

    globalShortcut.register('CommandOrControl+]', () => {
      if (win && !win.isDestroyed() && !win.webContents.isDestroyed() && win.webContents.navigationHistory.canGoForward()) win.webContents.navigationHistory.goForward();
    });
  });

  win.on('blur', () => {
    globalShortcut.unregisterAll();
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
