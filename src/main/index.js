const { app, BrowserWindow } = require('electron');
const path = require('path');
const DependencyManager = require('./dependencyManager');
const YtdlpExecutor = require('./ytdlpExecutor');
const { registerIpcHandlers } = require('./ipcHandlers');

let mainWindow = null;
let dependencyManager = null;
let ytdlpExecutor = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 760,
    minWidth: 880,
    minHeight: 640,
    title: 'ClipDrop',
    backgroundColor: '#0a0d14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false
    }
  });

  dependencyManager = new DependencyManager();
  ytdlpExecutor = new YtdlpExecutor(dependencyManager);

  registerIpcHandlers({ mainWindow, dependencyManager, ytdlpExecutor });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
