const fs = require('fs');
const { spawn } = require('child_process');
const { sanitizeUrl, formatDuration } = require('../utils/urlSanitizer');
const { translateError } = require('../utils/errorTranslator');

/**
 * Serviço responsável por analisar e extrair metadados prévios de links
 * (vídeos únicos e playlists do YouTube ou outras plataformas suportadas).
 */
class MediaInspector {
  /**
   * @param {object} pathsProvider Provedor de caminhos de binários (ytdlpPath, binDir, denoPath)
   */
  constructor(pathsProvider) {
    this.pathsProvider = pathsProvider;
  }

  /**
   * Analisa a URL e retorna as informações de pré-visualização.
   * @param {string} rawUrl
   * @returns {Promise<object>}
   */
  async inspectUrl(rawUrl) {
    const url = sanitizeUrl(rawUrl);
    const { ytdlpPath, binDir, denoPath } = this.pathsProvider.getPaths();

    if (!fs.existsSync(ytdlpPath)) {
      throw new Error('O motor de download (yt-dlp) ainda não está pronto.');
    }

    const isPlaylistUrl = url.includes('/playlist') || url.includes('list=');
    const args = [
      '--dump-single-json',
      '--flat-playlist',
      '--playlist-end', '100', // Limita varredura de playlists para proteger contra 429
      '--no-warnings',
      '--ffmpeg-location', binDir,
      ...(fs.existsSync(denoPath) ? ['--js-runtimes', `deno:${denoPath}`] : [])
    ];

    if (!isPlaylistUrl) {
      args.push('--no-playlist');
    }
    args.push(url.trim());

    return new Promise((resolve, reject) => {
      let stdoutData = '';
      let stderrData = '';

      const proc = spawn(ytdlpPath, args, { windowsHide: true });

      proc.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          const friendlyMessage = translateError(stderrData);
          return reject(new Error(friendlyMessage));
        }

        try {
          const json = JSON.parse(stdoutData.trim());
          const isPlaylist = Boolean(json._type === 'playlist' || (Array.isArray(json.entries) && json.entries.length > 1));

          if (isPlaylist) {
            const entries = (json.entries || []).map((entry, index) => ({
              id: entry.id || String(index + 1),
              index: index + 1,
              title: entry.title || `Faixa ${index + 1}`,
              url: entry.url || (entry.id ? `https://www.youtube.com/watch?v=${entry.id}` : url),
              uploader: entry.uploader || entry.channel || json.title || 'Desconhecido',
              duration: entry.duration || 0,
              durationFormatted: formatDuration(entry.duration),
              thumbnail: entry.thumbnails?.[0]?.url || entry.thumbnail || json.thumbnails?.[0]?.url || null,
              selected: true
            }));

            resolve({
              isPlaylist: true,
              id: json.id,
              title: json.title || 'Playlist',
              uploader: json.uploader || json.channel || 'Canal',
              itemCount: entries.length,
              thumbnail: json.thumbnails?.[0]?.url || (entries[0] && entries[0].thumbnail) || null,
              entries
            });
          } else {
            // Vídeo único
            const thumbnail = json.thumbnail || (Array.isArray(json.thumbnails) && json.thumbnails.length ? json.thumbnails[json.thumbnails.length - 1].url : null);
            resolve({
              isPlaylist: false,
              id: json.id,
              title: json.title || 'Vídeo',
              uploader: json.uploader || json.channel || 'Desconhecido',
              duration: json.duration || 0,
              durationFormatted: formatDuration(json.duration),
              thumbnail,
              url: json.webpage_url || url
            });
          }
        } catch (err) {
          reject(new Error('Falha ao processar os detalhes do vídeo: ' + err.message));
        }
      });

      proc.on('error', (err) => {
        reject(new Error('Erro ao iniciar o processo de análise: ' + err.message));
      });
    });
  }
}

module.exports = MediaInspector;
