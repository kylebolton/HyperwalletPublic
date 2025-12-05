import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { autoUpdater } from 'electron-updater';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, // Security: disable Node.js in renderer
      contextIsolation: true, // Security: enable context isolation with contextBridge
      sandbox: false, // Allow preload script to access Node.js APIs
    },
    titleBarStyle: 'hiddenInset', // Mac style
    backgroundColor: '#FFFFFF',
  });

  // In production, load the index.html of the app.
  // In development, load the Vite dev server URL.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  return mainWindow;
}

// Configure auto-updater
autoUpdater.autoDownload = false; // Don't auto-download, let user choose
autoUpdater.autoInstallOnAppQuit = true; // Install on app quit after download

// Configure update server (for private repos, releases should be public)
// The updater will automatically use the publish config from package.json
// For private repositories: Make releases public (releases can be public even if repo is private)
// This allows end users to download updates without authentication

// Only check for updates in production
if (process.env.NODE_ENV !== 'development') {
  // Configure update check interval (check every 4 hours)
  const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

  // Check for updates on app ready
  app.whenReady().then(() => {
    // Initial check after a short delay to let app fully load
    setTimeout(() => {
      checkForUpdates();
    }, 5000);

    // Set up periodic update checks
    setInterval(() => {
      checkForUpdates();
    }, UPDATE_CHECK_INTERVAL);
  });

  // Auto-updater event handlers
  autoUpdater.on('checking-for-update', () => {
    sendUpdateStatus('checking', 'Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    sendUpdateStatus('available', `Update available: ${info.version}`, info);
  });

  autoUpdater.on('update-not-available', (info) => {
    sendUpdateStatus('not-available', `You're on the latest version (${info.version})`);
  });

  autoUpdater.on('error', (err) => {
    sendUpdateStatus('error', `Update error: ${err.message}`, err);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    sendUpdateStatus('download-progress', 'Downloading update...', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendUpdateStatus('downloaded', 'Update downloaded. Restart to install.', info);
  });
}

function checkForUpdates() {
  if (process.env.NODE_ENV === 'development') {
    console.log('Skipping update check in development mode');
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => {
    console.error('Error checking for updates:', err);
    sendUpdateStatus('error', `Failed to check for updates: ${err.message}`);
  });
}

function sendUpdateStatus(status: string, message: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, message, data });
  }
  console.log(`[AutoUpdater] ${status}: ${message}`, data || '');
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// IPC handlers for update management
ipcMain.handle('check-for-updates', async () => {
  if (process.env.NODE_ENV === 'development') {
    return { status: 'development', message: 'Update checks disabled in development' };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return { status: 'checking', message: 'Checking for updates...', result };
  } catch (error: any) {
    return { status: 'error', message: error.message, error };
  }
});

ipcMain.handle('download-update', async () => {
  if (process.env.NODE_ENV === 'development') {
    return { status: 'development', message: 'Update downloads disabled in development' };
  }
  try {
    await autoUpdater.downloadUpdate();
    return { status: 'downloading', message: 'Download started...' };
  } catch (error: any) {
    return { status: 'error', message: error.message, error };
  }
});

ipcMain.handle('install-update', async () => {
  if (process.env.NODE_ENV === 'development') {
    return { status: 'development', message: 'Update installation disabled in development' };
  }
  try {
    autoUpdater.quitAndInstall(false, true);
    return { status: 'installing', message: 'Restarting to install update...' };
  } catch (error: any) {
    return { status: 'error', message: error.message, error };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

