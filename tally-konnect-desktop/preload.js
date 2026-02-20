const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    checkTally: (port, host) => ipcRenderer.invoke('check-tally', port, host),
    startRelay: (port, host) => ipcRenderer.invoke('start-relay', port, host),
    stopRelay: () => ipcRenderer.invoke('stop-relay'),
    getRelayStatus: () => ipcRenderer.invoke('get-relay-status'),
    // Listen for live status pushes from main process
    onRelayStatus: (callback) => ipcRenderer.on('relay-status', (_event, data) => callback(data)),
});
