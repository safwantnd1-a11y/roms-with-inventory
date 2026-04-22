const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow;

// ── Determine correct paths ──────────────────────────────────────────
const isDev = !app.isPackaged;

// Database should be in userData (writable) for production
const dbPath = isDev
  ? path.join(__dirname, '..', 'roms.db')
  : path.join(app.getPath('userData'), 'roms.db');

// Copy default DB to userData if it doesn't exist yet
function ensureDatabase() {
  if (!isDev && !fs.existsSync(dbPath)) {
    const sourceDb = path.join(process.resourcesPath, 'roms.db');
    if (fs.existsSync(sourceDb)) {
      fs.copyFileSync(sourceDb, dbPath);
      console.log('[Electron] Copied default DB to', dbPath);
    }
  }
}

// Find server.cjs path
function getServerPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'server.cjs');
  }
  // In packaged app, try app.asar.unpacked first (for native modules)
  const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'server.cjs');
  if (fs.existsSync(unpacked)) return unpacked;
  // Fallback to asar
  return path.join(process.resourcesPath, 'app.asar', 'server.cjs');
}

// Wait for server to be ready
function waitForServer(url, maxAttempts = 60) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      attempts++;
      http.get(url, (res) => {
        if (res.statusCode < 500) resolve();
        else if (attempts < maxAttempts) setTimeout(check, 500);
        else reject(new Error('Server did not respond (status ' + res.statusCode + ')'));
      }).on('error', () => {
        if (attempts < maxAttempts) setTimeout(check, 500);
        else reject(new Error('Server not reachable after ' + maxAttempts + ' attempts'));
      });
    };
    check();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Restaurant Order Management System',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
    backgroundColor: '#0f172a',
  });

  // Show loading screen
  mainWindow.loadFile(path.join(__dirname, 'loading.html'));
  mainWindow.show();

  // Ensure DB exists
  ensureDatabase();

  // Start the Express server INSIDE the main process (no spawn!)
  startServerInProcess();
}

function startServerInProcess() {
  const serverPath = getServerPath();
  console.log('[Electron] isDev:', isDev);
  console.log('[Electron] Server path:', serverPath);
  console.log('[Electron] DB path:', dbPath);
  console.log('[Electron] Server exists:', fs.existsSync(serverPath));

  if (!fs.existsSync(serverPath)) {
    dialog.showErrorBox(
      'Server Not Found',
      `Cannot find server.cjs at:\n${serverPath}\n\nPlease reinstall the application.`
    );
    return;
  }

  // Set environment variables BEFORE requiring server
  process.env.NODE_ENV = 'production';
  process.env.PORT = '3000';
  process.env.DB_PATH = dbPath;
  process.env.ELECTRON_MODE = 'true';

  // Set dist path for serving static frontend files
  if (isDev) {
    process.env.DIST_PATH = path.join(__dirname, '..', 'dist');
  } else {
    // Try unpacked first (asarUnpack includes dist), then asar
    const unpackedDist = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist');
    const asarDist = path.join(process.resourcesPath, 'app.asar', 'dist');
    process.env.DIST_PATH = fs.existsSync(unpackedDist) ? unpackedDist : asarDist;
  }
  console.log('[Electron] DIST_PATH:', process.env.DIST_PATH);

  try {
    // Require the server directly — it starts listening on port 3000
    require(serverPath);
    console.log('[Electron] Server module loaded successfully');
  } catch (err) {
    console.error('[Electron] Failed to load server:', err);
    dialog.showErrorBox(
      'Server Error',
      `Failed to start backend server:\n\n${err.message}\n\n${err.stack}`
    );
    return;
  }

  // Wait for server then load the app
  waitForServer('http://localhost:3000/api/menu')
    .then(() => {
      console.log('[Electron] Server ready! Loading app...');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL('http://localhost:3000');
      }
    })
    .catch((err) => {
      console.error('[Electron] Server timeout:', err);
      dialog.showErrorBox(
        'Startup Error',
        'Backend server failed to start in time.\nPlease try restarting the application.'
      );
    });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Auto-updater events
autoUpdater.on('checking-for-update', () => {
  console.log('Checking for update...');
});
autoUpdater.on('update-available', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new update is available. Downloading now...'
  });
});
autoUpdater.on('update-not-available', (info) => {
  console.log('Update not available.');
});
autoUpdater.on('error', (err) => {
  console.log('Error in auto-updater. ' + err);
});
autoUpdater.on('update-downloaded', (info) => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update has been downloaded. The application will restart to install the update.'
  }).then((result) => {
    autoUpdater.quitAndInstall();
  });
});

app.whenReady().then(() => {
  createWindow();
  // Check for updates as soon as the app is ready
  if (!isDev) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
