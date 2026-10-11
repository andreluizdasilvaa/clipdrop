const { ipcMain } = require('electron');
const { IPC_CHANNELS } = require('../../shared/constants/ipcChannels');

/**
 * Registra os manipuladores IPC do domínio de Sistema Operacional e Diálogos.
 * @param {object} params
 * @param {import('electron').BrowserWindow} params.mainWindow
 * @param {import('../services/SystemService')} params.systemService
 */
function registerSystemIpc({ mainWindow, systemService }) {
  // Diálogo nativo para escolha de pasta
  ipcMain.handle(IPC_CHANNELS.SYSTEM.CHOOSE_DIRECTORY, async (_event, defaultPath) => {
    return await systemService.chooseDirectory(mainWindow, defaultPath);
  });

  // Abrir pasta no explorador de arquivos nativo
  ipcMain.handle(IPC_CHANNELS.SYSTEM.OPEN_FOLDER, async (_event, folderPath) => {
    return await systemService.openFolder(folderPath);
  });

  // Obter diretórios padrão do sistema
  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_DEFAULT_PATHS, async () => {
    return systemService.getDefaultPaths();
  });

  // Obter tema do sistema operacional
  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_THEME, async () => {
    return systemService.getSystemTheme();
  });

  // Obter nome de usuário do SO (substitui a necessidade de require('os') no preload)
  ipcMain.handle(IPC_CHANNELS.SYSTEM.GET_USERNAME, async () => {
    return systemService.getUserName();
  });

  ipcMain.on(IPC_CHANNELS.SYSTEM.GET_USERNAME_SYNC, (event) => {
    event.returnValue = systemService.getUserName();
  });
}

module.exports = { registerSystemIpc };