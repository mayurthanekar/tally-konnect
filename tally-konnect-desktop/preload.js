const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    checkTally: (port) => ipcRenderer.invoke('check-tally', port),
    startTunnel: (port) => ipcRenderer.invoke('start-tunnel', port),
    stopTunnel: () => ipcRenderer.invoke('stop-tunnel'),
});
