const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronWindow', {
  setTheme: (mode) => ipcRenderer.send('theme:changed', mode)
});

contextBridge.exposeInMainWorld('electronSerial', {
  // Wird aufgerufen, sobald der Main-Prozess eine Portliste anbietet.
  onPorts: (cb) => {
    ipcRenderer.on('serial:ports', (_event, ports) => cb(ports));
  },
  // Hotplug-Info, rein informativ fuers UI.
  onChange: (cb) => {
    ipcRenderer.on('serial:changed', (_event, info) => cb(info));
  },
  select: (portId) => ipcRenderer.send('serial:select', portId),
  cancel: () => ipcRenderer.send('serial:select', '')
});
