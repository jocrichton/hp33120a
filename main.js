const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');

// --- Modulebene: lebt ueber den gesamten App-Lauf -------------------------

// Callback aus dem select-serial-port-Event.
let pendingSelect = null;

// portIds, die der Nutzer aktiv ausgewaehlt hat. Nur diese bekommen
// Geraeteberechtigung - sonst liefert getPorts() alle COM-Ports des
// Rechners zurueck und die UI verbindet sich stumm mit dem falschen.
const granted = new Set();

function resolveSelection(portId) {
  if (!pendingSelect) return;
  const cb = pendingSelect;
  pendingSelect = null;
  if (portId) granted.add(portId);
  cb(portId || ''); // leerer String = Abbruch, requestPort() rejected
}

// --- Fenster -------------------------------------------------------------

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

  // ses existiert NUR hier drin - alles was ses benutzt, gehoert
  // ebenfalls in diese Funktion.
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

    if (ports.length === 0) {
      const li = document.createElement('li');
      li.className = 'esp-hint';
      li.textContent = 'Kein serieller Port gefunden.';
      list.appendChild(li);
    }

    win.webContents.send('serial:ports', ports);
  });

  ses.on('serial-port-added', (event, port) => {
    win.webContents.send('serial:changed', { type: 'added', port });
  });
  ses.on('serial-port-removed', (event, port) => {
    win.webContents.send('serial:changed', { type: 'removed', port });
  });

  ses.setPermissionCheckHandler((webContents, permission) => permission === 'serial');
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === 'serial');
  });
  ses.setDevicePermissionHandler((details) =>
    details.deviceType === 'serial' && granted.has(details.device.portId)
  );

  win.loadFile(path.join(__dirname, 'index.html'));
}

// --- IPC und App-Lifecycle ----------------------------------------------

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