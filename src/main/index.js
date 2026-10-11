const { app, BrowserWindow } = require('electron');
const path = require('path');

// Evita erros 0x5 (Acesso negado) no GPUCache quando há processos órfãos do Chromium
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');

const DependencyManager = require('./dependencyManager');
const DownloadService = require('./services/DownloadService');
const MediaInspector = require('./services/MediaInspector');
const SystemService = require('./services/SystemService');
const { registerAllIpcHandlers } = require('./ipc');

let mainWindow = null;
let dependencyManager = null;
let downloadService = null;
let mediaInspector = null;
let systemService = null;

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
  downloadService = new DownloadService(dependencyManager);
  mediaInspector = new MediaInspector(dependencyManager);
  systemService = new SystemService();

  mainWindow.setMenu(null);

  registerAllIpcHandlers({
    mainWindow,
    downloadService,
    mediaInspector,
    dependencyManager,
    systemService
  });

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
});

app.on('window-all-closed', () => {
  app.quit();
});
