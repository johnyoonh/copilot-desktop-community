const { ipcRenderer, contextBridge } = require('electron');

// Listen for signals from main process
ipcRenderer.on('trigger-shortcut', (event, keyCode) => {
  window.dispatchEvent(new CustomEvent('copilot-shortcut', { detail: { code: keyCode } }));
});

ipcRenderer.on('show-find-bar', () => {
  window.dispatchEvent(new CustomEvent('show-find-bar'));
});

ipcRenderer.on('show-shortcuts-modal', () => {
  window.dispatchEvent(new CustomEvent('show-shortcuts-modal'));
});

ipcRenderer.on('find-results', (event, data) => {
  window.dispatchEvent(new CustomEvent('find-results', { detail: data }));
});

// Securely expose the API to the page
contextBridge.exposeInMainWorld('electronSearch', {
  find: (text, forward = true, findNext = true) => ipcRenderer.send('find-in-page', text, { forward, findNext }),
  stop: () => ipcRenderer.send('stop-find'),
  log: (msg) => ipcRenderer.send('log-to-terminal', msg)
});

console.log('[Copilot Desktop] Context Bridge initialized');
