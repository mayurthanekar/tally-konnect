const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    checkTally: (port) => ipcRenderer.invoke('check-tally', port),
    startRelay: (port) => ipcRenderer.invoke('start-relay', port),
    stopRelay: () => ipcRenderer.invoke('stop-relay'),
    getRelayStatus: () => ipcRenderer.invoke('get-relay-status'),
    // Listen for live status pushes from main process
    onRelayStatus: (callback) => ipcRenderer.on('relay-status', (_event, data) => callback(data)),
});
