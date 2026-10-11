const { ipcMain } = require('electron');
const { IPC_CHANNELS } = require('../../shared/constants/ipcChannels');

/**
 * Registra os manipuladores IPC do domínio de Mídia (inspeção prévia).
 * @param {object} params
 * @param {import('../services/MediaInspector')} params.mediaInspector
 */
function registerMediaIpc({ mediaInspector }) {
  ipcMain.handle(IPC_CHANNELS.MEDIA.INSPECT, async (_event, url) => {
    if (!url || typeof url !== 'string' || !url.trim()) {
      throw new Error('Informe um link válido.');
    }
    return await mediaInspector.inspectUrl(url.trim());
  });
}

module.exports = { registerMediaIpc };
