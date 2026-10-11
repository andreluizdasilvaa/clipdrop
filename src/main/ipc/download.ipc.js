const { ipcMain } = require('electron');
const { IPC_CHANNELS } = require('../../shared/constants/ipcChannels');

/**
 * Registra os manipuladores IPC do domínio de Downloads.
 * @param {object} params
 * @param {import('electron').BrowserWindow} params.mainWindow
 * @param {import('../services/DownloadService')} params.downloadService
 */
function registerDownloadIpc({ mainWindow, downloadService }) {
  ipcMain.handle(IPC_CHANNELS.DOWNLOAD.START, async (_event, options) => {
    if (!options || !['audio', 'video'].includes(options.mode) || typeof options.url !== 'string' || !options.url.trim()) {
      return { success: false, error: 'Pedido de download inválido. O link é obrigatório.' };
    }
    const downloadId = options.id || `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      downloadService.download(
        downloadId,
        options,
        (progressData) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD.PROGRESS, progressData);
          }
        },
        (statusData) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send(IPC_CHANNELS.DOWNLOAD.STATUS, statusData);
          }
        }
      ).catch((err) => {
        console.error(`[IPC] Erro assíncrono no download ${downloadId}:`, err.message);
      });

      return { success: true, downloadId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IPC_CHANNELS.DOWNLOAD.CANCEL, async (_event, downloadId) => {
    const cancelled = downloadService.cancelDownload(downloadId);
    return { success: cancelled };
  });
}

module.exports = { registerDownloadIpc };
