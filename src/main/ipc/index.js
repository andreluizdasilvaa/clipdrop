const { registerDownloadIpc } = require('./download.ipc');
const { registerMediaIpc } = require('./media.ipc');
const { registerDependenciesIpc } = require('./dependencies.ipc');
const { registerSystemIpc } = require('./system.ipc');

/**
 * Registrador principal de todos os módulos de IPC da aplicação.
 * @param {object} params
 * @param {import('electron').BrowserWindow} params.mainWindow
 * @param {import('../services/DownloadService')} params.downloadService
 * @param {import('../services/MediaInspector')} params.mediaInspector
 * @param {object} params.dependencyManager
 * @param {import('../services/SystemService')} params.systemService
 */
function registerAllIpcHandlers({
  mainWindow,
  downloadService,
  mediaInspector,
  dependencyManager,
  systemService
}) {
  registerDownloadIpc({ mainWindow, downloadService });
  registerMediaIpc({ mediaInspector });
  registerDependenciesIpc({ mainWindow, dependencyManager });
  registerSystemIpc({ mainWindow, systemService });
}

module.exports = { registerAllIpcHandlers };
