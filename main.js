const { app, BrowserWindow, globalShortcut, ipcMain, webFrameMain, shell, Menu, MenuItem, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { version } = require('./package.json');

const desktopUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';
const desktopUserAgentMetadata = {
  brands: [
    { brand: 'Not A(Brand', version: '8' },
    { brand: 'Chromium', version: '132' },
    { brand: 'Google Chrome', version: '132' },
  ],
  fullVersionList: [
    { brand: 'Not A(Brand', version: '8.0.0.0' },
    { brand: 'Chromium', version: '132.0.6834.210' },
    { brand: 'Google Chrome', version: '132.0.6834.210' },
  ],
  fullVersion: '132.0.6834.210',
  platform: 'Windows',
  platformVersion: '19.0.0',
  architecture: 'x86',
  model: '',
  mobile: false,
};
const desktopUserAgentClientHints = {
  'sec-ch-ua': '"Not A(Brand";v="8", "Chromium";v="132", "Google Chrome";v="132"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};
const disabledAuthBreakingFeatures = [
  'BlockThirdPartyCookies',
  'TrackingProtection3pcd',
  'ThirdPartyStoragePartitioning',
  'ThirdPartyCookiesPhaseout',
];

// Set the name before app is ready for better Dock/Taskbar display in dev
app.setName('Copilot Desktop CE');
app.userAgentFallback = desktopUserAgent;
app.commandLine.appendSwitch('disable-features', disabledAuthBreakingFeatures.join(','));
app.commandLine.appendSwitch('disable-site-isolation-trials');

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
const diagnosticsFiles = ['app.log', 'navigation.log'];
const diagnosticHostnames = [
  'copilot.microsoft.com',
  'login.live.com',
  'login.microsoft.com',
  'login.microsoftonline.com',
  'account.live.com',
  'account.microsoft.com',
  'graph.microsoft.com',
  'copilot.fun',
];
const sensitiveUrlParams = [
  'code',
  'client_info',
  'state',
  'nonce',
  'epct',
  'epctrc',
  'uaid',
  'username',
  'login_hint',
  'X-AnchorMailbox',
];
const authCookieHostnames = [
  'copilot.microsoft.com',
  'login.live.com',
  'login.microsoft.com',
  'login.microsoftonline.com',
  'account.live.com',
  'account.microsoft.com',
  'live.com',
  'microsoft.com',
  'microsoftonline.com',
];
let authFlushTimer = null;
let quittingAfterFlush = false;

function appendLogFile(fileName, message) {
  if (!app.isReady()) return;

  fs.appendFile(
    path.join(app.getPath('userData'), fileName),
    `${new Date().toISOString()} ${message}\n`,
    () => {}
  );
}

function redactUrlForLog(value) {
  if (!value || typeof value !== 'string') return value;

  try {
    const parsed = new URL(value);
    sensitiveUrlParams.forEach((param) => {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[redacted]');
      }
    });

    if (parsed.hash) {
      const hashParams = new URLSearchParams(parsed.hash.slice(1));
      let changed = false;
      sensitiveUrlParams.forEach((param) => {
        if (hashParams.has(param)) {
          hashParams.set(param, '[redacted]');
          changed = true;
        }
      });
      if (changed) parsed.hash = `#${hashParams.toString()}`;
    }

    return parsed.toString();
  } catch {
    return value.replace(/([?&#](?:code|client_info|state|nonce|epct|epctrc|uaid|username|login_hint|X-AnchorMailbox)=)[^&#\s]+/gi, '$1[redacted]');
  }
}

function logNavigation(scope, action, url) {
  const message = `[Navigation:${scope}] ${action}: ${redactUrlForLog(url)}`;
  console.log(message);
  appendLogFile('navigation.log', message);
}

function logApp(message) {
  const line = `[App] ${message}`;
  console.log(line);
  appendLogFile('app.log', line);
}

function getDiagnosticsText() {
  if (!app.isReady()) return 'Diagnostics are not available until the app is ready.';

  return diagnosticsFiles.map((fileName) => {
    const filePath = path.join(app.getPath('userData'), fileName);
    if (!fs.existsSync(filePath)) return `${fileName}\n(no file yet)`;

    const text = fs.readFileSync(filePath, 'utf8').trim();
    return `${fileName}\n${text || '(empty)'}`;
  }).join('\n\n');
}

async function resetSignInData() {
  const targetSession = session.defaultSession;

  await targetSession.clearStorageData({
    storages: [
      'cookies',
      'localstorage',
      'indexdb',
      'serviceworkers',
      'cachestorage',
      'websql',
    ],
  });
  await targetSession.clearCache();

  logApp('Cleared sign-in data');

  if (win && !win.isDestroyed()) {
    await win.loadURL('https://copilot.microsoft.com');
    win.focus();
  }
}

async function flushAuthState(reason) {
  try {
    await session.defaultSession.cookies.flushStore();
    session.defaultSession.flushStorageData();
    logApp(`Flushed auth state: ${reason}`);
  } catch (err) {
    logApp(`Failed to flush auth state (${reason}): ${err.message}`);
  }
}

function scheduleAuthStateFlush(reason) {
  clearTimeout(authFlushTimer);
  authFlushTimer = setTimeout(() => {
    flushAuthState(reason);
  }, 1000);
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

  targetSession.webRequest.onCompleted((details) => {
    if (!isDiagnosticUrl(details.url) || details.statusCode < 400) return;

    logNavigation('request', `${details.method} ${details.statusCode}`, details.url);
  });

  targetSession.webRequest.onErrorOccurred((details) => {
    if (!isDiagnosticUrl(details.url)) return;

    logNavigation('request', `${details.method} ${details.error}`, details.url);
  });

  targetSession.cookies.on('changed', (_event, cookie, _cause, removed) => {
    if (removed) return;

    const cookieDomain = (cookie.domain || '').replace(/^\./, '').toLowerCase();
    if (!authCookieHostnames.some((domain) => hostnameMatches(cookieDomain, domain))) return;

    scheduleAuthStateFlush(`cookie changed for ${cookieDomain}`);
  });
}

function withTimeout(promise, milliseconds) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out after ${milliseconds}ms`)), milliseconds)),
  ]);
}

function applyChromeIdentity(webContents, scope) {
  webContents.setUserAgent(desktopUserAgent);

  (async () => {
    try {
      if (!webContents.debugger.isAttached()) {
        webContents.debugger.attach('1.3');
      }

      await withTimeout(webContents.debugger.sendCommand('Network.enable'), 1500);
      await withTimeout(webContents.debugger.sendCommand('Network.setUserAgentOverride', {
        userAgent: desktopUserAgent,
        platform: 'Windows',
        userAgentMetadata: desktopUserAgentMetadata,
      }), 1500);
      logApp(`Applied Chrome identity to ${scope}`);
    } catch (err) {
      logApp(`Failed to apply Chrome identity to ${scope}: ${err.message}`);
    }
  })();
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

function isCopilotAuthRedirect(url) {
  if (!isCopilotUrl(url)) return false;

  try {
    const parsed = new URL(url);
    return new URLSearchParams(parsed.hash.slice(1)).has('code');
  } catch {
    return false;
  }
}

function shouldInjectContent(url) {
  const hostname = getHostname(url);
  return hostnameMatches(hostname, 'copilot.microsoft.com') ||
    hostnameMatches(hostname, 'copilot.fun');
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

function isDiagnosticUrl(url) {
  const hostname = getHostname(url);
  return diagnosticHostnames.some((domain) => hostnameMatches(hostname, domain));
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

async function signInFromFrame(frame) {
  const code = `
    (() => {
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      };
      const textFor = (el) => [
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.innerText,
        el.textContent,
        el.value,
      ].find((value) => value && value.trim())?.trim().replace(/\\s+/g, ' ') || '';
      const candidates = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="button"], input[type="submit"]'))
        .filter(visible)
        .map((el) => ({ el, text: textFor(el), href: el.href || '' }))
        .filter((item) => /sign\\s*in|log\\s*in|continue/i.test(item.text) || /login|signin|sign-in/i.test(item.href));
      const match = candidates[0];
      if (!match) {
        return { clicked: false, url: window.location.href, candidates: candidates.map((item) => ({ text: item.text, href: item.href })).slice(0, 10) };
      }
      match.el.focus();
      match.el.click();
      return { clicked: true, url: window.location.href, text: match.text, href: match.href };
    })();
  `;

  try {
    return await frame.executeJavaScript(code, true);
  } catch (err) {
    return { clicked: false, url: frame.url, error: err.message };
  }
}

async function triggerCopilotSignIn() {
  if (!win || win.isDestroyed()) return;

  const frames = win.webContents.mainFrame.framesInSubtree
    .filter((frame) => !frame.isDestroyed() && shouldInjectContent(frame.url));

  logNavigation('sign-in-command', 'frames', JSON.stringify(frames.map((frame) => frame.url)));

  for (const frame of frames) {
    const result = await signInFromFrame(frame);
    logNavigation('sign-in-command', 'result', JSON.stringify(result));
    if (result.clicked) return;
  }

  logNavigation('sign-in-command', 'fallback', 'https://copilot.microsoft.com/');
  win.loadURL('https://copilot.microsoft.com/');
}

function watchAuthWindow(authWindow, initialUrl) {
  let sawAuthNavigation = isMicrosoftAuthUrl(initialUrl);
  logNavigation('auth-popup', 'created', initialUrl);
  applyChromeIdentity(authWindow.webContents, 'auth popup');

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
  authWindow.webContents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame || isDiagnosticUrl(url)) {
      logNavigation('auth-popup', isInPlace ? 'start-in-place' : 'start-navigation', url);
    }
  });
  authWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame || isDiagnosticUrl(validatedURL)) {
      logNavigation('auth-popup', `fail ${errorCode} ${errorDescription}`, validatedURL);
    }
  });
  authWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level < 2) return;

    logNavigation('auth-popup-console', `level ${level} line ${line}`, `${sourceId}: ${message}`);
  });
  authWindow.webContents.on('will-navigate', (event, url) => {
    logNavigation('auth-popup', 'will-navigate', url);
    if (isAllowedInAppUrl(url)) return;

    logNavigation('auth-popup', 'external', url);
    event.preventDefault();
    shell.openExternal(url);
  });
  authWindow.webContents.setWindowOpenHandler(({ url }) => {
    logNavigation('auth-popup', 'window-open', url);
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
        {
          label: 'Reset Sign-in Data',
          click: async () => {
            const result = await dialog.showMessageBox(win, {
              type: 'warning',
              title: 'Reset Sign-in Data',
              message: 'Reset Copilot sign-in data?',
              detail: 'This clears cookies and local site data for this app, then reloads Copilot.',
              buttons: ['Reset', 'Cancel'],
              defaultId: 0,
              cancelId: 1,
            });

            if (result.response === 0) {
              await resetSignInData();
            }
          },
        },
        {
          label: 'Sign In',
          click: () => {
            triggerCopilotSignIn().catch((err) => {
              logNavigation('sign-in-command', 'error', err.message);
            });
          },
        },
        {
          label: 'Show Login Diagnostics',
          click: () => {
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'Login Diagnostics',
              message: 'Copilot Desktop CE Login Diagnostics',
              detail: getDiagnosticsText(),
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

app.on('before-quit', (event) => {
  if (quittingAfterFlush) return;

  event.preventDefault();
  quittingAfterFlush = true;
  flushAuthState('before quit').finally(() => app.quit());
});

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 900,
    title: `Copilot Desktop CE ${version}`,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      nodeIntegrationInSubFrames: false,
    },
  });

  applyChromeIdentity(win.webContents, 'main window');
  win.loadURL('https://copilot.microsoft.com');

  win.webContents.on('did-navigate', (_event, url) => {
    logNavigation('main', 'did-navigate', url);
    if (isCopilotAuthRedirect(url)) {
      scheduleAuthStateFlush('copilot auth redirect');
    }
  });
  win.webContents.on('did-start-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame || isDiagnosticUrl(url)) {
      logNavigation('main', isInPlace ? 'start-in-place' : 'start-navigation', url);
    }
  });
  win.webContents.on('did-redirect-navigation', (_event, url, isInPlace, isMainFrame) => {
    if (isMainFrame || isDiagnosticUrl(url)) {
      logNavigation('main', isInPlace ? 'in-place-redirect' : 'redirect', url);
    }
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (isMainFrame || isDiagnosticUrl(validatedURL)) {
      logNavigation('main', `fail ${errorCode} ${errorDescription}`, validatedURL);
    }
  });
  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (level < 2) return;

    logNavigation('main-console', `level ${level} line ${line}`, `${sourceId}: ${message}`);
  });

  // Keep Copilot sign-in inside Electron so auth cookies land in this app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    logNavigation('main', 'window-open', url);
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
    logNavigation('main', 'will-navigate', url);
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
    if (frame) {
      logNavigation('frame', isMainFrame ? 'main-load' : 'subframe-load', frame.url);
    }

    if (frame && shouldInjectContent(frame.url)) {
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

ipcMain.on('log-to-terminal', (_event, message) => {
  logNavigation('renderer-log', 'message', String(message));
});

ipcMain.on('renderer-diagnostic', (_event, data) => {
  logNavigation('renderer', data?.type || 'event', JSON.stringify(data));
});

app.whenReady().then(() => {
  configureSessionForMicrosoftAuth(session.defaultSession);
  logApp(`Starting Copilot Desktop CE ${version}`);
  logApp(`Using user agent: ${desktopUserAgent}`);
  logApp(`Disabled auth-breaking Chromium features: ${disabledAuthBreakingFeatures.join(', ')}`);
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
