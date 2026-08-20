const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// Callback aus dem select-serial-port-Event; wird gefüllt, sobald der
// Renderer requestPort() aufruft, und vom UI wieder aufgelöst.
let pendingSelect = null;

const granted = new Set();

function resolveSelection(portId) {
  if (!pendingSelect) return;
  const cb = pendingSelect;
  pendingSelect = null;
  if (portId) granted.add(portId);
  cb(portId || '');
}

ses.setDevicePermissionHandler((details) =>
  details.deviceType === 'serial' && granted.has(details.device.portId)
);

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

  const ses = win.webContents.session;

  // Kernstück: Electron zeigt KEINEN eigenen Portauswahl-Dialog.
  // Ohne preventDefault + callback bleibt navigator.serial.requestPort() haengen.
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

    if (ports.length === 0) {
      resolveSelection('');
      return;
    }

    win.webContents.send('serial:ports', ports);
  });

  // Wird der Adapter waehrend des offenen Dialogs eingesteckt, feuert
  // select-serial-port erneut - das UI aktualisiert sich dadurch von selbst.
  ses.on('serial-port-added', (event, port) => {
    win.webContents.send('serial:changed', { type: 'added', port });
  });
  ses.on('serial-port-removed', (event, port) => {
    win.webContents.send('serial:changed', { type: 'removed', port });
  });

  // Ohne diese drei Handler liefert getPorts() eine leere Liste und
  // requestPort() wirft einen SecurityError.
  ses.setPermissionCheckHandler((webContents, permission) => permission === 'serial');
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'serial');
  });
  ses.setDevicePermissionHandler((details) => details.deviceType === 'serial');

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
