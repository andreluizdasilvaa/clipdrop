const fs = require('fs');
const path = require('path');
const { sanitizeUrl } = require('../utils/urlSanitizer');
const { getUserDataDir } = require('../utils/pathUtils');

/**
 * Serviço responsável por cache de downloads finalizados,
 * detecção de itens existentes e duplicação local sem chamadas de rede.
 */
class DuplicateManager {
  /**
   * @param {string} [baseDir] Diretório base onde salvar o histórico de downloads
   */
  constructor(baseDir) {
    this.completedDownloads = new Map();
    this.historyFilePath = this._resolveHistoryFilePath(baseDir);
    this._loadHistory();
  }

  _resolveHistoryFilePath(baseDir) {
    const base = baseDir || getUserDataDir();
    return path.join(base, 'completed_downloads.json');
  }

  _loadHistory() {
    try {
      if (fs.existsSync(this.historyFilePath)) {
        const raw = fs.readFileSync(this.historyFilePath, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item && item.key && item.filePath) {
              this.completedDownloads.set(item.key, item);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[DuplicateManager] Aviso ao ler histórico de downloads:', e.message);
    }
  }

  _saveHistory() {
    try {
      const dir = path.dirname(this.historyFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const arr = Array.from(this.completedDownloads.values()).slice(-200);
      fs.writeFileSync(this.historyFilePath, JSON.stringify(arr, null, 2), 'utf8');
    } catch (e) {
      console.warn('[DuplicateManager] Aviso ao salvar histórico de downloads:', e.message);
    }
  }

  _resolveFormat(mode, options = {}) {
    return mode === 'audio'
      ? (options.audio?.format || 'mp3')
      : (options.video?.container || 'mp4');
  }

  getCacheKey(url, mode, destDir, options = {}) {
    const cleanUrl = sanitizeUrl(url);
    const format = this._resolveFormat(mode, options);
    return `${cleanUrl}|${mode}|${format}|${destDir}`;
  }

  getCompleted(cacheKey) {
    return this.completedDownloads.get(cacheKey) || null;
  }

  recordCompleted(cacheKey, data) {
    this.completedDownloads.set(cacheKey, data);
    this._saveHistory();
  }

  getDuplicateFilePath(originalPath) {
    const dir = path.dirname(originalPath);
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    let counter = 1;
    let candidate = path.join(dir, `${baseName} (${counter})${ext}`);
    while (fs.existsSync(candidate)) {
      counter++;
      candidate = path.join(dir, `${baseName} (${counter})${ext}`);
    }
    return candidate;
  }

  findExistingFile(destDir, mode, options = {}) {
    if (!options.title || !fs.existsSync(destDir)) return null;
    const format = this._resolveFormat(mode, options);

    try {
      const files = fs.readdirSync(destDir);
      const safeTitle = options.title.replace(/[\\/:*?"<>|]/g, '').trim().toLowerCase();
      for (const f of files) {
        const fLower = f.toLowerCase();
        if (fLower.endsWith(`.${format}`)) {
          const fBase = path.basename(f, path.extname(f)).toLowerCase();
          if (fBase === safeTitle || fBase.startsWith(safeTitle) || safeTitle.startsWith(fBase)) {
            return path.join(destDir, f);
          }
        }
      }
    } catch (_) {}
    return null;
  }

  async duplicateExistingFile(downloadId, existingFilePath, onProgress, onStatus) {
    if (onStatus) {
      onStatus({
        downloadId,
        status: 'starting',
        percent: 20,
        message: 'Arquivo já baixado anteriormente! Duplicando localmente...'
      });
    }

    const duplicatePath = this.getDuplicateFilePath(existingFilePath);

    // Feedback visual suave de progresso na interface
    await new Promise((r) => setTimeout(r, 180));

    if (onProgress) {
      onProgress({
        downloadId,
        percent: 65,
        speed: 'Local',
        eta: '0s',
        status: 'downloading',
        message: 'Copiando arquivo duplicado...'
      });
    }

    fs.copyFileSync(existingFilePath, duplicatePath);

    await new Promise((r) => setTimeout(r, 180));

    if (onProgress) {
      onProgress({
        downloadId,
        percent: 100,
        speed: 'Local',
        eta: '0s',
        status: 'downloading',
        message: 'Duplicação concluída!'
      });
    }

    if (onStatus) {
      onStatus({
        downloadId,
        status: 'completed',
        percent: 100,
        message: 'Arquivo duplicado com sucesso!'
      });
    }

    return { success: true, downloadId, duplicated: true, filePath: duplicatePath };
  }
}

module.exports = DuplicateManager;
