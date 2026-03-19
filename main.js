const { app, BrowserWindow, globalShortcut, ipcMain, webFrameMain } = require('electron');
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
    // Removed 'A', 'C', 'V' to prevent conflicts with Select All, Copy, and Paste
    const shortcuts = ['N', 'L', 'T', 'D', 'S', 'I', 'B', 'M', 'X', 'K', 'Comma', 'Period'];
    shortcuts.forEach(key => {
      let accelerator = `CommandOrControl+${key}`;
      if (key === 'Comma') accelerator = 'CommandOrControl+,';
      if (key === 'Period') accelerator = 'CommandOrControl+.';

      globalShortcut.register(accelerator, () => {
        win.webContents.send('trigger-shortcut', key === 'Comma' ? 'Comma' : (key === 'Period' ? 'Period' : `Key${key}`) );
      });
    });

    // Voice Shortcut (moved to U to avoid Cmd+V Paste conflict)
    globalShortcut.register('CommandOrControl+U', () => {
      win.webContents.send('trigger-shortcut', 'KeyV');
    });

    // Native Focus Search (/)
    globalShortcut.register('/', () => {
      win.webContents.send('trigger-shortcut', 'Slash');
    });

    globalShortcut.register('CommandOrControl+F', () => {
      win.webContents.send('show-find-bar');
    });

    globalShortcut.register('CommandOrControl+Shift+O', () => {
      win.webContents.send('trigger-shortcut', 'KeyO');
    });

    globalShortcut.register('CommandOrControl+[', () => {
      if (win.webContents.navigationHistory.canGoBack()) win.webContents.navigationHistory.goBack();
    });

    globalShortcut.register('CommandOrControl+]', () => {
      if (win.webContents.navigationHistory.canGoForward()) win.webContents.navigationHistory.goForward();
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
