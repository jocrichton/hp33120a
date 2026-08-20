const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// Callback aus dem select-serial-port-Event. Wird gesetzt, sobald der
// Renderer requestPort() aufruft, und vom Auswahl-UI wieder aufgeloest.
let pendingSelect = null;

function resolveSelection(portId) {
  if (!pendingSelect) return;
  const cb = pendingSelect;
  pendingSelect = null;
  cb(portId || ''); // leerer String = Abbruch, requestPort() rejected
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1150,
    height: 850,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // ses existiert nur innerhalb dieser Funktion - alles was ses benutzt,
  // gehoert ebenfalls hier hinein.
  const ses = win.webContents.session;

  // Electron zeigt keinen eigenen Portauswahl-Dialog. Ohne preventDefault
  // plus callback bleibt navigator.serial.requestPort() haengen.
  ses.on('select-serial-port', (event, portList, webContents, callback) => {
    event.preventDefault();
    pendingSelect = callback;

    const ports = portList.map((p) => ({
      portId: p.portId,
      portName: p.portName,
      displayName: p.displayName,
      vendorId: p.vendorId,
      productId: p.productId,
      serialNumber: p.serialNumber
    }));

    // Auch die leere Liste wird geschickt, damit der Dialog "kein Port
    // gefunden" anzeigen kann statt stumm abzubrechen.
    win.webContents.send('serial:ports', ports);
  });

  ses.on('serial-port-added', (event, port) => {
    win.webContents.send('serial:changed', { type: 'added', port });
  });
  ses.on('serial-port-removed', (event, port) => {
    win.webContents.send('serial:changed', { type: 'removed', port });
  });

  // Ohne diese beiden Handler liefert getPorts() eine leere Liste und
  // requestPort() wirft einen SecurityError.
  ses.setPermissionCheckHandler((webContents, permission) => permission === 'serial');
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'serial');
  });

  // Bewusst KEIN setDevicePermissionHandler: Electron merkt sich von
  // selbst, welche Geraete ueber select-serial-port freigegeben wurden.
  // Ein eigener Handler, der auf portId vergleicht, blockiert port.open().

  win.loadFile(path.join(__dirname, 'index.html'));
}

ipcMain.on('serial:select', (event, portId) => resolveSelection(portId));

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});