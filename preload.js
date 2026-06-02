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

ipcRenderer.on('show-mic-diagnostics', () => {
  window.dispatchEvent(new CustomEvent('show-mic-diagnostics'));
});

// Securely expose the API to the page
contextBridge.exposeInMainWorld('electronSearch', {
  find: (text, forward = true, findNext = true) => ipcRenderer.send('find-in-page', text, { forward, findNext }),
  stop: () => ipcRenderer.send('stop-find'),
  log: (msg) => ipcRenderer.send('log-to-terminal', msg)
});

contextBridge.exposeInMainWorld('electronMic', {
  getDiagnostics: () => ipcRenderer.invoke('get-mic-diagnostics'),
  openSystemSettings: () => ipcRenderer.send('open-mic-settings'),
  probe: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      return { ok: true };
    } catch (err) {
      return { ok: false, name: err?.name, message: err?.message };
    }
  }
});

console.log('[Copilot Desktop] Context Bridge initialized');
