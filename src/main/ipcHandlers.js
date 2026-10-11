const { ipcMain, dialog, shell, app, nativeTheme } = require('electron');
const path = require('path');

function registerIpcHandlers({ mainWindow, dependencyManager, ytdlpExecutor }) {
  // Verificação e status de dependências
  ipcMain.handle('dependencies:get-status', async () => {
    return dependencyManager.getSummary();
  });

  ipcMain.handle('dependencies:start-setup', async () => {
    try {
      const summary = await dependencyManager.verifyAndSetup((update) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('dependencies:progress', update);
        }
      });
      return { success: true, summary };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  // Inspeção prévia de URLs (detecção rápida de vídeos e playlists)
  ipcMain.handle('media:inspect', async (_event, url) => {
    if (!url || typeof url !== 'string' || !url.trim()) {
      throw new Error('Informe um link válido.');
    }
    return await ytdlpExecutor.inspectUrl(url.trim());
  });

  // Execução de Downloads
  ipcMain.handle('media:download', async (_event, options) => {
    if (!options || !['audio', 'video'].includes(options.mode) || typeof options.url !== 'string' || !options.url.trim()) {
      return { success: false, error: 'Pedido de download inválido. O link é obrigatório.' };
    }
    const downloadId = options.id || `dl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      // Inicia em background e reporta eventos via IPC
      ytdlpExecutor.download(
        downloadId,
        options,
        (progressData) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download:progress', progressData);
          }
        },
        (statusData) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('download:status', statusData);
          }
        }
      ).catch((err) => {
        // Erros são capturados e notificados via status
        console.error(`[IPC] Erro no download ${downloadId}:`, err.message);
      });

      return { success: true, downloadId };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('media:cancel-download', async (_event, downloadId) => {
    const cancelled = ytdlpExecutor.cancelDownload(downloadId);
    return { success: cancelled };
  });

  // Diálogo nativo para escolha de pasta
  ipcMain.handle('dialog:choose-directory', async (_event, defaultPath) => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Selecione a Pasta de Destino',
      defaultPath: defaultPath || app.getPath('downloads'),
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled || !result.filePaths.length) {
      return null;
    }
    return result.filePaths[0];
  });

  // Abrir pasta no explorador de arquivos nativo
  ipcMain.handle('shell:open-folder', async (_event, folderPath) => {
    const target = folderPath || app.getPath('downloads');
    await shell.openPath(target);
    return true;
  });

  // Obter diretórios padrão do sistema
  ipcMain.handle('system:get-default-paths', async () => {
    return {
      downloads: app.getPath('downloads'),
      music: app.getPath('music'),
      videos: app.getPath('videos'),
      userData: app.getPath('userData')
    };
  });

  // Obter tema do sistema operacional (dark ou light)
  ipcMain.handle('system:get-theme', async () => {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  });
}

module.exports = { registerIpcHandlers };
