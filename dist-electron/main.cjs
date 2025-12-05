"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const electron_updater_1 = require("electron-updater");
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    electron_1.app.quit();
}
let mainWindow = null;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.cjs'),
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
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../dist/index.html'));
    }
    return mainWindow;
}
// Configure auto-updater
electron_updater_1.autoUpdater.autoDownload = false; // Don't auto-download, let user choose
electron_updater_1.autoUpdater.autoInstallOnAppQuit = true; // Install on app quit after download
// Configure update server (for private repos, releases should be public)
// The updater will automatically use the publish config from package.json
// For private repositories: Make releases public (releases can be public even if repo is private)
// This allows end users to download updates without authentication
// Only check for updates in production
if (process.env.NODE_ENV !== 'development') {
    // Configure update check interval (check every 4 hours)
    const UPDATE_CHECK_INTERVAL = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
    // Check for updates on app ready
    electron_1.app.whenReady().then(() => {
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
    electron_updater_1.autoUpdater.on('checking-for-update', () => {
        sendUpdateStatus('checking', 'Checking for updates...');
    });
    electron_updater_1.autoUpdater.on('update-available', (info) => {
        sendUpdateStatus('available', `Update available: ${info.version}`, info);
    });
    electron_updater_1.autoUpdater.on('update-not-available', (info) => {
        sendUpdateStatus('not-available', `You're on the latest version (${info.version})`);
    });
    electron_updater_1.autoUpdater.on('error', (err) => {
        sendUpdateStatus('error', `Update error: ${err.message}`, err);
    });
    electron_updater_1.autoUpdater.on('download-progress', (progressObj) => {
        sendUpdateStatus('download-progress', 'Downloading update...', progressObj);
    });
    electron_updater_1.autoUpdater.on('update-downloaded', (info) => {
        sendUpdateStatus('downloaded', 'Update downloaded. Restart to install.', info);
    });
}
function checkForUpdates() {
    if (process.env.NODE_ENV === 'development') {
        console.log('Skipping update check in development mode');
        return;
    }
    electron_updater_1.autoUpdater.checkForUpdates().catch((err) => {
        console.error('Error checking for updates:', err);
        sendUpdateStatus('error', `Failed to check for updates: ${err.message}`);
    });
}
function sendUpdateStatus(status, message, data) {
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('update-status', { status, message, data });
    }
    console.log(`[AutoUpdater] ${status}: ${message}`, data || '');
}
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', function () {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', function () {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
// IPC handlers for update management
electron_1.ipcMain.handle('check-for-updates', async () => {
    if (process.env.NODE_ENV === 'development') {
        return { status: 'development', message: 'Update checks disabled in development' };
    }
    try {
        const result = await electron_updater_1.autoUpdater.checkForUpdates();
        return { status: 'checking', message: 'Checking for updates...', result };
    }
    catch (error) {
        return { status: 'error', message: error.message, error };
    }
});
electron_1.ipcMain.handle('download-update', async () => {
    if (process.env.NODE_ENV === 'development') {
        return { status: 'development', message: 'Update downloads disabled in development' };
    }
    try {
        await electron_updater_1.autoUpdater.downloadUpdate();
        return { status: 'downloading', message: 'Download started...' };
    }
    catch (error) {
        return { status: 'error', message: error.message, error };
    }
});
electron_1.ipcMain.handle('install-update', async () => {
    if (process.env.NODE_ENV === 'development') {
        return { status: 'development', message: 'Update installation disabled in development' };
    }
    try {
        electron_updater_1.autoUpdater.quitAndInstall(false, true);
        return { status: 'installing', message: 'Restarting to install update...' };
    }
    catch (error) {
        return { status: 'error', message: error.message, error };
    }
});
electron_1.ipcMain.handle('get-app-version', () => {
    return electron_1.app.getVersion();
});
