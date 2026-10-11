const { app, BrowserWindow } = require('electron');
const path = require('path');

// Evita erros 0x5 (Acesso negado) no GPUCache quando há processos órfãos do Chromium
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

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
    icon: path.join(__dirname, '../renderer/assets/logos/icon/logo_sem_fundo_sem_texto.ico'),
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

  mainWindow.setMenu(null);

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
