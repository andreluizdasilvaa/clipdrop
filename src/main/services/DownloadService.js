const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { buildDownloadArgs } = require('../argsBuilder');
const { sanitizeUrl } = require('../utils/urlSanitizer');
const { translateError, SUBTITLE_ERROR_MESSAGE } = require('../utils/errorTranslator');
const { resolveOutputDir, findMostRecentFile } = require('../utils/pathUtils');
const OutputParser = require('./OutputParser');
const DuplicateManager = require('./DuplicateManager');
const PostProcessor = require('./PostProcessor');

/**
 * Serviço responsável pela orquestração do ciclo de vida dos downloads multimídia,
 * coordenação de processos, prevenção de concorrência e integração com pós-processamento.
 */
class DownloadService {
  /**
   * @param {object} dependencyManager
   */
  constructor(dependencyManager) {
    this.dependencyManager = dependencyManager;
    this.activeProcesses = new Map();
    this.activeTempDirs = new Map();
    this.activeDownloadsByUrl = new Map();

    const userDataDir = path.dirname(dependencyManager.binDir);
    this.duplicateManager = new DuplicateManager(userDataDir);
    this.postProcessor = new PostProcessor(dependencyManager.ffmpegPath);
  }

  getPaths() {
    return this.dependencyManager.getPaths();
  }

  async _ensureFfmpeg(onStatus, downloadId) {
    const { ffmpegPath } = this.getPaths();
    if (!fs.existsSync(ffmpegPath)) {
      if (onStatus) {
        onStatus({
          downloadId,
          status: 'starting',
          percent: 5,
          message: 'Configurando conversor multimídia...'
        });
      }
      try {
        await this.dependencyManager.verifyAndSetup();
      } catch (_) {}

      const check = this.getPaths();
      if (!fs.existsSync(check.ffmpegPath)) {
        throw new Error('O conversor multimídia (ffmpeg) está ausente e não foi possível instalá-lo automaticamente.');
      }
    }
  }

  /**
   * Inicia o download da mídia.
   * Se o mesmo link já foi baixado anteriormente (mesmo arquivo), duplica localmente sem requisições de rede.
   * @param {string} downloadId
   * @param {object} options
   * @param {Function} [onProgress]
   * @param {Function} [onStatus]
   * @returns {Promise<object>}
   */
  async download(downloadId, options, onProgress, onStatus) {
    const { url, mode, outputDir, isPlaylist } = options;
    const destDir = resolveOutputDir(outputDir);

    // Se for item individual (não playlist), verifica se já existe para duplicar localmente
    if (!isPlaylist && url) {
      const cacheKey = this.duplicateManager.getCacheKey(url, mode, destDir, options);

      // 1. Se já houver um download ativo do mesmo link, aguarda-o terminar para duplicar
      const activePromise = this.activeDownloadsByUrl.get(cacheKey);
      if (activePromise) {
        if (onStatus) {
          onStatus({
            downloadId,
            status: 'starting',
            percent: 10,
            message: 'Aguardando download em andamento para duplicar...'
          });
        }
        try {
          const originalFilePath = await activePromise;
          if (originalFilePath && fs.existsSync(originalFilePath)) {
            return await this.duplicateManager.duplicateExistingFile(downloadId, originalFilePath, onProgress, onStatus);
          }
        } catch (_) {}
      }

      // 2. Se já tiver sido concluído e o arquivo físico existir no disco
      const previous = this.duplicateManager.getCompleted(cacheKey);
      if (previous && previous.filePath && fs.existsSync(previous.filePath)) {
        return await this.duplicateManager.duplicateExistingFile(downloadId, previous.filePath, onProgress, onStatus);
      }

      // 3. Verificação de fallback pelo título na pasta de destino
      try {
        const found = this.duplicateManager.findExistingFile(destDir, mode, options);
        if (found && fs.existsSync(found)) {
          this.duplicateManager.recordCompleted(cacheKey, {
            key: cacheKey,
            url: sanitizeUrl(url),
            filePath: found,
            title: options.title,
            mode,
            timestamp: Date.now()
          });
          return await this.duplicateManager.duplicateExistingFile(downloadId, found, onProgress, onStatus);
        }
      } catch (_) {}
    }

    const subsEnabled = options.mode === 'video' && options.video?.subtitles?.enabled;
    if (!subsEnabled) {
      return this._runDownload(downloadId, options, onProgress, onStatus);
    }

    // Primeira tentativa: intercepta erro exclusivo de legendas para tentar fallback
    const guardedStatus = (data) => {
      if (data.status === 'error' && data.message === SUBTITLE_ERROR_MESSAGE) return;
      if (onStatus) onStatus(data);
    };

    try {
      return await this._runDownload(downloadId, options, onProgress, guardedStatus);
    } catch (err) {
      if (err.message !== SUBTITLE_ERROR_MESSAGE) {
        if (onStatus) onStatus({ downloadId, status: 'error', message: err.message });
        throw err;
      }
      if (onStatus) {
        onStatus({
          downloadId,
          status: 'downloading',
          message: 'Legendas indisponíveis no momento. Baixando o vídeo sem elas...'
        });
      }
      const fallback = structuredClone(options);
      fallback.video.subtitles.enabled = false;
      return this._runDownload(downloadId, fallback, onProgress, onStatus);
    }
  }

  async _runDownload(downloadId, options, onProgress, onStatus) {
    try {
      await this._ensureFfmpeg(onStatus, downloadId);
      const { ytdlpPath, binDir, denoPath } = this.getPaths();

      if (!fs.existsSync(ytdlpPath)) {
        throw new Error('O motor de download (yt-dlp) ainda não está pronto.');
      }

      const { url, mode, outputDir, audio, video, isPlaylist, selectedIndices } = options;
      const cleanUrl = sanitizeUrl(url);

      const destDir = resolveOutputDir(outputDir);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const tempDir = path.join(destDir, `.clipdrop_tmp_${downloadId}`);
      try {
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        this.activeTempDirs.set(downloadId, tempDir);
      } catch (_) {}

      const cleanupTemp = () => {
        this.activeTempDirs.delete(downloadId);
        try {
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch (_) {}
      };

      const args = buildDownloadArgs({
        mode,
        url: cleanUrl,
        outputDir: destDir,
        tempDir,
        binDir,
        denoPath: fs.existsSync(denoPath) ? denoPath : null,
        audio,
        video,
        isPlaylist,
        selectedIndices
      });

      const cacheKey = this.duplicateManager.getCacheKey(url, mode, destDir, options);
      let resolveActive;
      if (!isPlaylist) {
        this.activeDownloadsByUrl.set(
          cacheKey,
          new Promise((res) => { resolveActive = res; })
        );
      }
      let finalFilePath = null;

      return new Promise((resolve, reject) => {
        let stderrBuffer = '';
        const proc = spawn(ytdlpPath, args, { windowsHide: true });
        this.activeProcesses.set(downloadId, proc);

        if (onStatus) {
          onStatus({ downloadId, status: 'starting', percent: 2, message: 'Iniciando download...' });
        }

        let currentStreamIndex = 1;
        let wasAlreadyArchived = false;
        const isVideoWithAudio = options.mode === 'video' && !options.video?.advanced?.videoOnly;

        proc.stdout.on('data', (data) => {
          const text = data.toString();
          const lines = text.split(/\r?\n/);

          for (const line of lines) {
            if (!line.trim()) continue;

            const detectedPath = OutputParser.extractDestinationPath(line, destDir);
            if (detectedPath) {
              finalFilePath = detectedPath;
            }

            // Se yt-dlp indicar início de download de áudio separado no vídeo combinado
            if (line.includes('[download] Destination:') || line.includes('Destination:')) {
              if (isVideoWithAudio && (line.includes('.f251.') || line.includes('.f140.') || line.includes('audio') || line.endsWith('.webm') || line.endsWith('.m4a'))) {
                currentStreamIndex = 2;
              }
            }

            const metrics = OutputParser.parseProgressMetrics(line);
            if (metrics) {
              const { percentNum, speed, eta, totalBytes } = metrics;
              let overallPercent = percentNum;
              let displayStage = options.mode === 'audio' ? 'Baixando áudio' : 'Baixando mídia';

              if (isVideoWithAudio) {
                if (percentNum >= 99.5 && currentStreamIndex === 1) {
                  currentStreamIndex = 2;
                }
                if (currentStreamIndex === 1) {
                  overallPercent = Math.min(85, percentNum * 0.85);
                  displayStage = 'Baixando vídeo';
                } else {
                  overallPercent = Math.min(95, 85 + (percentNum * 0.10));
                  displayStage = 'Baixando áudio';
                }
              } else if (options.mode === 'audio') {
                overallPercent = Math.min(92, percentNum * 0.92);
                displayStage = 'Baixando áudio';
              }

              let message = `${displayStage}... ${percentNum.toFixed(0)}%`;
              if (totalBytes && totalBytes !== 'NA') {
                message += ` de ${totalBytes}`;
              }

              if (onProgress) {
                onProgress({
                  downloadId,
                  percent: Math.min(99, Math.max(1, overallPercent)),
                  speed: speed !== 'NA' ? speed : '--',
                  eta: eta !== 'NA' ? eta : '--',
                  status: 'downloading',
                  message
                });
              }
              continue;
            }

            const stage = OutputParser.parsePostProcessingStage(line);
            if (stage) {
              if (onStatus) {
                onStatus({ downloadId, ...stage });
              }
              continue;
            }

            if (line.includes('has already been recorded in the archive')) {
              wasAlreadyArchived = true;
            }
          }
        });

        proc.stderr.on('data', (chunk) => {
          stderrBuffer += chunk.toString();
        });

        proc.on('close', async (code) => {
          this.activeProcesses.delete(downloadId);
          cleanupTemp();

          if (code === 0) {
            if (wasAlreadyArchived) {
              const existing = finalFilePath || this.duplicateManager.findExistingFile(destDir, mode, options);
              if (existing && fs.existsSync(existing)) {
                if (resolveActive) resolveActive(existing);
                this.activeDownloadsByUrl.delete(cacheKey);
                try {
                  const res = await this.duplicateManager.duplicateExistingFile(downloadId, existing, onProgress, onStatus);
                  return resolve(res);
                } catch (dupErr) {
                  return reject(dupErr);
                }
              } else {
                if (onStatus) {
                  onStatus({
                    downloadId,
                    status: 'skipped',
                    percent: 100,
                    message: 'Item já baixado anteriormente (anti-duplicação ativo).'
                  });
                }
                if (resolveActive) resolveActive(null);
                this.activeDownloadsByUrl.delete(cacheKey);
                return resolve({ success: true, downloadId, skipped: true });
              }
            }

            // Hardsub opcional com ffmpeg
            try {
              await this.postProcessor.burnHardsubIfNeeded(downloadId, options, destDir, onStatus);
            } catch (burnErr) {
              console.warn('[PostProcessor] Aviso durante hardsub:', burnErr.message);
            }

            if (!finalFilePath || !fs.existsSync(finalFilePath)) {
              finalFilePath = findMostRecentFile(destDir);
            }

            if (finalFilePath && fs.existsSync(finalFilePath) && !isPlaylist) {
              this.duplicateManager.recordCompleted(cacheKey, {
                key: cacheKey,
                url: cleanUrl,
                filePath: finalFilePath,
                title: options.title,
                mode,
                timestamp: Date.now()
              });
            }

            if (resolveActive) resolveActive(finalFilePath);
            this.activeDownloadsByUrl.delete(cacheKey);

            if (onStatus) {
              onStatus({
                downloadId,
                status: 'completed',
                percent: 100,
                message: 'Concluído com sucesso!'
              });
            }
            resolve({ success: true, downloadId, filePath: finalFilePath });
          } else {
            if (resolveActive) resolveActive(null);
            this.activeDownloadsByUrl.delete(cacheKey);
            const friendlyMessage = translateError(stderrBuffer);
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'error',
                message: friendlyMessage
              });
            }
            reject(new Error(friendlyMessage));
          }
        });

        proc.on('error', (err) => {
          this.activeProcesses.delete(downloadId);
          cleanupTemp();
          if (resolveActive) resolveActive(null);
          this.activeDownloadsByUrl.delete(cacheKey);
          const msg = 'Falha ao executar o processo de download: ' + err.message;
          if (onStatus) {
            onStatus({ downloadId, status: 'error', message: msg });
          }
          reject(new Error(msg));
        });
      });
    } catch (err) {
      if (onStatus) {
        onStatus({ downloadId, status: 'error', message: err.message });
      }
      throw err;
    }
  }

  cancelDownload(downloadId) {
    const tempDir = this.activeTempDirs.get(downloadId);
    if (tempDir) {
      try {
        this.activeTempDirs.delete(downloadId);
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      } catch (_) {}
    }
    const proc = this.activeProcesses.get(downloadId);
    if (proc) {
      try {
        proc.kill('SIGTERM');
        this.activeProcesses.delete(downloadId);
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }
}

module.exports = DownloadService;
