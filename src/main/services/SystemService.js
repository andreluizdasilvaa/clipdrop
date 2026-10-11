const { dialog, shell, app, nativeTheme } = require('electron');
const os = require('os');

/**
 * Serviço responsável por integrações com o sistema operacional:
 * diálogos nativos, explorador de arquivos, caminhos padrão, usuário e tema.
 */
class SystemService {
  /**
   * Abre o diálogo nativo para seleção ou criação de pasta.
   * @param {import('electron').BrowserWindow} mainWindow
   * @param {string} [defaultPath]
   * @returns {Promise<string|null>}
   */
  async chooseDirectory(mainWindow, defaultPath) {
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
  }

  /**
   * Abre o explorador de arquivos do sistema no caminho informado.
   * @param {string} [targetPath]
   * @returns {Promise<boolean>}
   */
  async openFolder(targetPath) {
    const target = targetPath || app.getPath('downloads');
    await shell.openPath(target);
    return true;
  }

  /**
   * Retorna os caminhos padrão do usuário.
   * @returns {{ downloads: string, music: string, videos: string, userData: string }}
   */
  getDefaultPaths() {
    return {
      downloads: app.getPath('downloads'),
      music: app.getPath('music'),
      videos: app.getPath('videos'),
      userData: app.getPath('userData')
    };
  }

  /**
   * Retorna o tema atual do sistema ('dark' ou 'light').
   * @returns {'dark'|'light'}
   */
  getSystemTheme() {
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
  }

  /**
   * Obtém o nome do usuário do sistema operacional de forma segura.
   * @returns {string}
   */
  getUserName() {
    try {
      return os.userInfo().username || '';
    } catch (_) {
      return '';
    }
  }
}

module.exports = SystemService;
