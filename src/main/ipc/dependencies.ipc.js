const { ipcMain } = require('electron');
const { IPC_CHANNELS } = require('../../shared/constants/ipcChannels');

/**
 * Registra os manipuladores IPC do domínio de Dependências (yt-dlp, ffmpeg, deno).
 * @param {object} params
 * @param {import('electron').BrowserWindow} params.mainWindow
 * @param {object} params.dependencyManager
 */
function registerDependenciesIpc({ mainWindow, dependencyManager }) {
  ipcMain.handle(IPC_CHANNELS.DEPENDENCIES.GET_STATUS, async () => {
    return dependencyManager.getSummary();
  });

  ipcMain.handle(IPC_CHANNELS.DEPENDENCIES.START_SETUP, async () => {
    try {
      const summary = await dependencyManager.verifyAndSetup((update) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.DEPENDENCIES.PROGRESS, update);
        }
      });
      return { success: true, summary };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerDependenciesIpc };
