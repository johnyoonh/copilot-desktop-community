const { app, BrowserWindow, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Set the name before app is ready for better Dock/Taskbar display in dev
app.setName('Copilot Desktop (Community Edition)');

let win;
const contentJs = fs.readFileSync(path.join(__dirname, 'content.js'), 'utf8');

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    title: 'Copilot Desktop',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: true, // Crucial for iframes
    },
  });

  win.loadURL('https://copilot.microsoft.com');

  // Inject into the main frame
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript(contentJs);
  });

  // Inject into every subframe as it loads
  win.webContents.on('did-frame-finish-load', (event, isMainFrame, frameProcessId, frameRoutingId) => {
    if (!isMainFrame) {
      win.webContents.executeJavaScriptInFrame([frameProcessId, frameRoutingId], contentJs);
    }
  });

  // Handle Global Shortcuts
  win.on('focus', () => {
    const shortcuts = ['N', 'L', 'T', 'D', 'S', 'I', 'A', 'B', 'C', 'M', 'V', 'X', 'K', 'Comma', 'Period', 'Slash'];
    shortcuts.forEach(key => {
      let accelerator = key.length === 1 ? `CommandOrControl+${key}` : `CommandOrControl+${key}`;
      if (key === 'Slash') accelerator = '/'; 
      if (key === 'Comma') accelerator = 'CommandOrControl+,';
      if (key === 'Period') accelerator = 'CommandOrControl+.';

      globalShortcut.register(accelerator, () => {
        win.webContents.send('trigger-shortcut', key === 'Comma' ? 'Comma' : (key === 'Period' ? 'Period' : (key === 'Slash' ? 'Slash' : `Key${key}`)) );
      });
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
