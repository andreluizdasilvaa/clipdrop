const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('clipdropAPI', {
  getUserName: () => {
    try {
      return os.userInfo().username;
    } catch (e) {
      return '';
    }
  },
  // Verificação e configuração de dependências
  getDependencyStatus: () => ipcRenderer.invoke('dependencies:get-status'),
  startDependencySetup: () => ipcRenderer.invoke('dependencies:start-setup'),
  onDependencyProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('dependencies:progress', handler);
    return () => ipcRenderer.removeListener('dependencies:progress', handler);
  },

  // Inspeção de link e metadados
  inspectUrl: (url) => ipcRenderer.invoke('media:inspect', url),

  // Downloads e streaming de progresso
  downloadMedia: (options) => ipcRenderer.invoke('media:download', options),
  cancelDownload: (id) => ipcRenderer.invoke('media:cancel-download', id),
  onDownloadProgress: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:progress', handler);
    return () => ipcRenderer.removeListener('download:progress', handler);
  },
  onDownloadStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('download:status', handler);
    return () => ipcRenderer.removeListener('download:status', handler);
  },

  // Integração com o sistema de arquivos
  chooseDirectory: (defaultPath) => ipcRenderer.invoke('dialog:choose-directory', defaultPath),
  openFolder: (path) => ipcRenderer.invoke('shell:open-folder', path),
  getDefaultPaths: () => ipcRenderer.invoke('system:get-default-paths'),

  // Tema do sistema operacional
  getSystemTheme: () => ipcRenderer.invoke('system:get-theme')
});
