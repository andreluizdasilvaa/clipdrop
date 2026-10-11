const { contextBridge, ipcRenderer } = require('electron');
const { IPC_CHANNELS } = require('../shared/constants/ipcChannels');

/**
 * Preload Script seguro e desacoplado.
 * Nenhuma API nativa do Node (como os ou fs) é exposta ou acessada diretamente aqui.
 * Toda a comunicação passa pelos canais IPC catalogados e protegidos por contextIsolation.
 */
contextBridge.exposeInMainWorld('clipdropAPI', {
  // Usuário do sistema (via IPC síncrono para inicialização imediata da UI)
  getUserName: () => {
    try {
      return ipcRenderer.sendSync(IPC_CHANNELS.SYSTEM.GET_USERNAME_SYNC) || '';
    } catch (_) {
      return '';
    }
  },

  // Verificação e configuração de dependências
  getDependencyStatus: () => ipcRenderer.invoke(IPC_CHANNELS.DEPENDENCIES.GET_STATUS),
  startDependencySetup: () => ipcRenderer.invoke(IPC_CHANNELS.DEPENDENCIES.START_SETUP),
  onDependencyProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.DEPENDENCIES.PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DEPENDENCIES.PROGRESS, handler);
  },

  // Inspeção de link e metadados
  inspectUrl: (url) => ipcRenderer.invoke(IPC_CHANNELS.MEDIA.INSPECT, url),

  // Downloads e streaming de progresso
  downloadMedia: (options) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD.START, options),
  cancelDownload: (id) => ipcRenderer.invoke(IPC_CHANNELS.DOWNLOAD.CANCEL, id),
  onDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD.PROGRESS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD.PROGRESS, handler);
  },
  onDownloadStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.DOWNLOAD.STATUS, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.DOWNLOAD.STATUS, handler);
  },

  // Integração com o sistema de arquivos
  chooseDirectory: (defaultPath) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.CHOOSE_DIRECTORY, defaultPath),
  openFolder: (path) => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.OPEN_FOLDER, path),
  getDefaultPaths: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_DEFAULT_PATHS),

  // Tema do sistema operacional
  getSystemTheme: () => ipcRenderer.invoke(IPC_CHANNELS.SYSTEM.GET_THEME)
});
