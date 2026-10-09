const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { buildDownloadArgs } = require('./argsBuilder');

class YtdlpExecutor {
  constructor(dependencyManager) {
    this.dependencyManager = dependencyManager;
    this.activeProcesses = new Map();
  }

  getPaths() {
    return this.dependencyManager.getPaths();
  }

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '--:--';
    const s = Math.floor(seconds);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  translateError(stderr) {
    const raw = (stderr || '').toString();
    if (!raw.trim()) return 'Ocorreu um erro inesperado durante a operação.';

    if (raw.includes('Private video') || raw.includes('This video is private')) {
      return 'Este vídeo é privado e requer autorização para ser acessado.';
    }
    if (raw.includes('Video unavailable') || raw.includes('has been removed')) {
      return 'Este conteúdo não está mais disponível ou foi removido da plataforma.';
    }
    if (raw.includes('Sign in to confirm your age') || raw.includes('age-gated')) {
      return 'Este vídeo requer autenticação de idade na plataforma.';
    }
    if (raw.includes('is not a valid URL') || raw.includes('Unsupported URL')) {
      return 'O link informado é inválido ou não pertence a uma plataforma suportada.';
    }
    if (raw.includes('Geo-restricted') || raw.includes('not available in your country')) {
      return 'Este conteúdo possui restrição geográfica para a sua região.';
    }
    if (raw.includes('HTTP Error 429') || raw.includes('Too Many Requests')) {
      return 'Muitas requisições enviadas à plataforma. Aguarde alguns minutos e tente novamente.';
    }
    if (raw.includes('Unable to download API page') || raw.includes('Network is unreachable')) {
      return 'Falha na conexão com a internet ou servidor do serviço indisponível.';
    }
    if (raw.includes('ffmpeg not found') || raw.includes('ffprobe not found')) {
      return 'O conversor multimídia (ffmpeg) não foi localizado corretamente no sistema.';
    }

    // Se houver uma linha iniciada por "ERROR:", extrai o resumo limpo
    const errorMatch = raw.match(/ERROR:\s*([^\r\n]+)/);
    if (errorMatch && errorMatch[1]) {
      return `Erro: ${errorMatch[1].trim()}`;
    }

    return 'Não foi possível processar este link. Verifique se o endereço está correto e ativo.';
  }

  async inspectUrl(url) {
    const { ytdlpPath, binDir } = this.getPaths();

    if (!fs.existsSync(ytdlpPath)) {
      throw new Error('O motor de download (yt-dlp) ainda não está pronto.');
    }

    const args = [
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      '--ffmpeg-location', binDir,
      url.trim()
    ];

    return new Promise((resolve, reject) => {
      let stdoutData = '';
      let stderrData = '';

      const proc = spawn(ytdlpPath, args, {
        windowsHide: true
      });

      proc.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      proc.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          const friendlyMessage = this.translateError(stderrData);
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
              durationFormatted: this.formatDuration(entry.duration),
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
              durationFormatted: this.formatDuration(json.duration),
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

  download(downloadId, options, onProgress, onStatus) {
    const { ytdlpPath, binDir } = this.getPaths();

    if (!fs.existsSync(ytdlpPath)) {
      throw new Error('O motor de download (yt-dlp) ainda não está pronto.');
    }

    const { url, mode, outputDir, audio, video, isPlaylist, selectedIndices } = options;

    const destDir = outputDir || path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Downloads');
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Anti-duplicação silencioso (.archive.txt) e demais flags ficam em buildDownloadArgs
    const args = buildDownloadArgs({
      mode,
      url,
      outputDir: destDir,
      binDir,
      audio,
      video,
      isPlaylist,
      selectedIndices
    });

    return new Promise((resolve, reject) => {
      let stderrBuffer = '';
      const proc = spawn(ytdlpPath, args, { windowsHide: true });
      this.activeProcesses.set(downloadId, proc);

      if (onStatus) {
        onStatus({ downloadId, status: 'starting', message: 'Iniciando download...' });
      }

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split(/\r?\n/);

        for (const line of lines) {
          if (!line.trim()) continue;

          // Parser do progresso padronizado: download: 50.0%| 4.2MiB/s| 00:15
          if (line.startsWith('download:')) {
            const rawParts = line.replace('download:', '').trim().split('|');
            if (rawParts.length >= 3) {
              const rawPercent = rawParts[0].trim().replace('%', '');
              const percentNum = parseFloat(rawPercent) || 0;
              const speed = rawParts[1].trim() || '--';
              const eta = rawParts[2].trim() || '--';

              if (onProgress) {
                onProgress({
                  downloadId,
                  percent: Math.min(100, Math.max(0, percentNum)),
                  speed,
                  eta,
                  status: 'downloading',
                  message: `Baixando mídia... ${percentNum.toFixed(1)}%`
                });
              }
            }
            continue;
          }

          // Parser de etapas amigáveis de pós-processamento
          if (line.includes('[ExtractAudio]') || line.includes('[Metadata]') || line.includes('[EmbedThumbnail]')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'postprocessing',
                message: 'Gravando capa e tags ID3...'
              });
            }
          } else if (line.includes('[SponsorBlock]') || line.includes('Removing segments')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'sponsorblock',
                message: 'Removendo anúncios patrocinados com SponsorBlock...'
              });
            }
          } else if (line.includes('[Merger]') || line.includes('Merging formats')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'merging',
                message: 'Unificando vídeo e áudio em alta qualidade...'
              });
            }
          } else if (line.includes('has already been recorded in the archive')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'skipped',
                message: 'Item já baixado anteriormente (anti-duplicação ativo).'
              });
            }
          }
        }
      });

      proc.stderr.on('data', (chunk) => {
        stderrBuffer += chunk.toString();
      });

      proc.on('close', (code) => {
        this.activeProcesses.delete(downloadId);
        if (code === 0) {
          if (onStatus) {
            onStatus({
              downloadId,
              status: 'completed',
              percent: 100,
              message: 'Concluído com sucesso!'
            });
          }
          resolve({ success: true, downloadId });
        } else {
          const friendlyMessage = this.translateError(stderrBuffer);
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
        const msg = 'Falha ao executar o processo de download: ' + err.message;
        if (onStatus) {
          onStatus({ downloadId, status: 'error', message: msg });
        }
        reject(new Error(msg));
      });
    });
  }

  cancelDownload(downloadId) {
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

module.exports = YtdlpExecutor;
