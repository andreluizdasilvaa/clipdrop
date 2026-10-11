const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * Utilitários centralizados para manipulação e resolução de caminhos no processo Main.
 */

/**
 * Obtém o diretório de dados do usuário (.clipdrop ou userData do Electron).
 * @returns {string}
 */
function getUserDataDir() {
  try {
    if (app && typeof app.getPath === 'function') {
      return app.getPath('userData');
    }
  } catch (_) {}
  return path.join(process.env.APPDATA || process.env.HOME || '.', '.clipdrop');
}

/**
 * Obtém o diretório padrão de downloads do sistema operacional.
 * @returns {string}
 */
function getDefaultDownloadsDir() {
  try {
    if (app && typeof app.getPath === 'function') {
      return app.getPath('downloads');
    }
  } catch (_) {}
  return path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Downloads');
}

/**
 * Resolve o diretório de destino garantindo fallback caso não fornecido.
 * @param {string} [outputDir]
 * @returns {string}
 */
function resolveOutputDir(outputDir) {
  return (outputDir && String(outputDir).trim()) ? outputDir.trim() : getDefaultDownloadsDir();
}

/**
 * Localiza o arquivo de mídia mais recentemente modificado em uma pasta,
 * ignorando arquivos temporários ou de metadados.
 * @param {string} dirPath
 * @param {string[]} [ignoreSuffixes]
 * @returns {string|null}
 */
function findMostRecentFile(dirPath, ignoreSuffixes = ['.temp', '.part', '.txt', '.webp', '.ytdl']) {
  if (!dirPath || !fs.existsSync(dirPath)) return null;
  try {
    const files = fs.readdirSync(dirPath).map((f) => {
      const fullPath = path.join(dirPath, f);
      return {
        name: f,
        fullPath,
        mtime: fs.statSync(fullPath).mtimeMs
      };
    }).sort((a, b) => b.mtime - a.mtime);

    const match = files.find((f) => !ignoreSuffixes.some((sfx) => f.name.endsWith(sfx)));
    return (match && fs.existsSync(match.fullPath)) ? match.fullPath : null;
  } catch (_) {
    return null;
  }
}

module.exports = {
  getUserDataDir,
  getDefaultDownloadsDir,
  resolveOutputDir,
  findMostRecentFile
};
