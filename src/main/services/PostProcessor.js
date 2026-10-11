const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { MEDIA_FORMATS } = require('../../shared/constants/mediaFormats');

const VIDEO_EXTENSIONS = MEDIA_FORMATS.VIDEO.CONTAINERS.map((ext) => `.${ext}`);
const SUB_EXTENSIONS = ['.srt', '.vtt'];

/**
 * Serviço responsável por operações de pós-processamento multimídia com FFmpeg,
 * como a queima de legendas na faixa de vídeo (Hardsub).
 */
class PostProcessor {
  /**
   * @param {string} ffmpegPath
   */
  constructor(ffmpegPath) {
    this.ffmpegPath = ffmpegPath;
  }

  /**
   * Queima a legenda diretamente nos frames do vídeo se a opção 'hardsub' estiver ativa.
   * @param {string} downloadId
   * @param {object} options
   * @param {string} destDir
   * @param {Function} [onStatus]
   * @returns {Promise<void>}
   */
  async burnHardsubIfNeeded(downloadId, options, destDir, onStatus) {
    if (options.mode !== 'video') return;
    const subs = options.video?.subtitles;
    if (!subs?.enabled || subs?.method !== 'hardsub') return;

    if (!this.ffmpegPath || !fs.existsSync(this.ffmpegPath)) return;

    try {
      const files = fs.readdirSync(destDir);
      const videoFile = files.find((f) => VIDEO_EXTENSIONS.includes(path.extname(f).toLowerCase()) && !f.startsWith('temp_hardsub_'));
      const subFile = files.find((f) => SUB_EXTENSIONS.includes(path.extname(f).toLowerCase()));

      if (!videoFile || !subFile) return;

      const videoPath = path.join(destDir, videoFile);
      const subPath = path.join(destDir, subFile);
      const ext = path.extname(videoFile);
      const destExt = ext === '.webm' ? '.mkv' : ext;
      const tempOut = path.join(destDir, `temp_hardsub_${Date.now()}${destExt}`);

      if (onStatus) {
        onStatus({
          downloadId,
          status: 'postprocessing',
          message: 'Queimando legendas na imagem (Hardsub)...'
        });
      }

      // Escapamento seguro compatível com o parser de filtros do FFmpeg
      const filterSubPath = subPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

      await new Promise((resolve) => {
        const burnProc = spawn(this.ffmpegPath, [
          '-y',
          '-i', videoPath,
          '-vf', `subtitles='${filterSubPath}'`,
          '-c:v', 'libx264',
          '-crf', '20',
          '-c:a', 'aac',
          '-b:a', '192k',
          tempOut
        ], { windowsHide: true });

        burnProc.on('close', (exitCode) => {
          if (exitCode === 0 && fs.existsSync(tempOut)) {
            try {
              fs.unlinkSync(videoPath);
              const finalPath = path.join(destDir, path.basename(videoFile, ext) + destExt);
              fs.renameSync(tempOut, finalPath);
              if (fs.existsSync(subPath)) {
                fs.unlinkSync(subPath);
              }
            } catch (_) {}
          } else {
            try {
              if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
            } catch (_) {}
          }
          resolve();
        });

        burnProc.on('error', () => {
          try {
            if (fs.existsSync(tempOut)) fs.unlinkSync(tempOut);
          } catch (_) {}
          resolve();
        });
      });
    } catch (_) {}
  }
}

module.exports = PostProcessor;
