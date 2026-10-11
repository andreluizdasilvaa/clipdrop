const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const https = require('https');
const { buildDownloadArgs } = require('./argsBuilder');

const SUBTITLE_ERROR_MESSAGE = 'Não foi possível baixar as legendas (limite temporário da plataforma).';

class YtdlpExecutor {
  constructor(dependencyManager) {
    this.dependencyManager = dependencyManager;
    this.activeProcesses = new Map();
    this.activeTempDirs = new Map();
    this.activeDownloadsByUrl = new Map();
    this.completedDownloads = new Map();
    this.metadataCache = new Map();
    this.CACHE_TTL = 30 * 60 * 1000; // 30 minutos
    this.historyFilePath = this._getHistoryFilePath();
    this._loadCompletedHistory();
  }

  _getHistoryFilePath() {
    let baseUserData;
    try {
      baseUserData = path.dirname(this.dependencyManager.binDir);
    } catch (_) {
      baseUserData = path.join(process.env.APPDATA || process.env.HOME || '.', '.clipdrop');
    }
    return path.join(baseUserData, 'completed_downloads.json');
  }

  _loadCompletedHistory() {
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
      console.warn('[YtdlpExecutor] Aviso ao ler histórico de downloads:', e.message);
    }
  }

  _saveCompletedHistory() {
    try {
      const arr = Array.from(this.completedDownloads.values()).slice(-200);
      fs.writeFileSync(this.historyFilePath, JSON.stringify(arr, null, 2), 'utf8');
    } catch (e) {
      console.warn('[YtdlpExecutor] Aviso ao salvar histórico de downloads:', e.message);
    }
  }

  _getCacheKey(url, mode, destDir, options = {}) {
    const cleanUrl = this.sanitizeUrl(url);
    const format = mode === 'audio' 
      ? (options.audio?.format || 'mp3') 
      : (options.video?.container || 'mp4');
    return `${cleanUrl}|${mode}|${format}|${destDir}`;
  }

  _getDuplicateFilePath(originalPath) {
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

  _findExistingFile(destDir, mode, options) {
    if (!options.title || !fs.existsSync(destDir)) return null;
    const format = mode === 'audio'
      ? (options.audio?.format || 'mp3')
      : (options.video?.container || 'mp4');
    
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

  async _duplicateExistingFile(downloadId, existingFilePath, onProgress, onStatus) {
    if (onStatus) {
      onStatus({
        downloadId,
        status: 'starting',
        percent: 20,
        message: 'Arquivo já baixado anteriormente! Duplicando localmente...'
      });
    }

    const duplicatePath = this._getDuplicateFilePath(existingFilePath);

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

  getPaths() {
    return this.dependencyManager.getPaths();
  }

  async _ensureFfmpeg(onStatus, downloadId) {
    const missing = () => {
      const { ffmpegPath, ffprobePath } = this.getPaths();
      return !fs.existsSync(ffmpegPath) || !fs.existsSync(ffprobePath);
    };
    if (missing()) {
      if (onStatus && downloadId) {
        onStatus({ downloadId, status: 'downloading', message: 'Instalando componente necessário (ffmpeg)...' });
      }
      try {
        await this.dependencyManager.verifyAndSetup();
      } catch (err) {}
      
      if (missing()) {
        throw new Error('O conversor multimídia (ffmpeg) está ausente e não foi possível instalá-lo automaticamente. Verifique sua conexão com a internet ou tente instalá-lo manualmente.');
      }
    }
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
    const full = (stderr || '').toString();
    // Avisos (WARNING) também citam 429 em falhas de legenda; classifica só pelas linhas ERROR.
    const errorLines = full.split(/\r?\n/).filter((l) => l.startsWith('ERROR:'));
    const raw = errorLines.length ? errorLines.join('\n') : full;
    if (full.trim()) console.error('[yt-dlp stderr]', full.trim());
    if (!raw.trim()) return 'Ocorreu um erro inesperado durante a operação.';

    if (raw.includes('Unable to download video subtitles')) {
      return SUBTITLE_ERROR_MESSAGE;
    }
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
      return 'O conversor multimídia (ffmpeg) está ausente e não foi possível instalá-lo automaticamente. Verifique sua conexão com a internet ou tente instalá-lo manualmente.';
    }
    if (raw.includes('WinError 32') || raw.includes('used by another process') || raw.includes('sendo usado por outro processo')) {
      return 'O arquivo temporário estava em uso pelo sistema operacional ou antivírus. Tente novamente em instantes.';
    }

    // Se houver uma linha iniciada por "ERROR:", extrai o resumo limpo
    const errorMatch = raw.match(/ERROR:\s*([^\r\n]+)/);
    if (errorMatch && errorMatch[1]) {
      return `Erro: ${errorMatch[1].trim()}`;
    }

    return 'Não foi possível processar este link. Verifique se o endereço está correto e ativo.';
  }

  sanitizeUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    try {
      const u = new URL(rawUrl.trim());
      const host = u.hostname.toLowerCase();
      if (host.includes('youtube.com') || host.includes('youtu.be')) {
        u.searchParams.delete('si');
        u.searchParams.delete('feature');
        u.searchParams.delete('pp');
        // Se for vídeo individual com mix automático (RD...), remove o mix para não carregar rádio inteira
        if (u.searchParams.has('v') && u.searchParams.get('list')?.startsWith('RD')) {
          u.searchParams.delete('list');
          u.searchParams.delete('start_radio');
          u.searchParams.delete('index');
        }
      }
      return u.toString();
    } catch (_) {
      return rawUrl.trim();
    }
  }

  isSingleYouTubeVideo(urlStr) {
    try {
      const u = new URL(urlStr);
      const host = u.hostname.toLowerCase();
      if (u.pathname === '/playlist' && u.searchParams.has('list')) {
        return false;
      }
      if (host.includes('youtu.be') && u.pathname.length > 1) {
        return true;
      }
      if (host.includes('youtube.com')) {
        if (u.pathname.startsWith('/shorts/') && u.pathname.length > 8) {
          return true;
        }
        if (u.searchParams.has('v')) {
          return !u.searchParams.has('list');
        }
      }
      return false;
    } catch (_) {
      return false;
    }
  }

  async _inspectWithOembed(url) {
    return new Promise((resolve, reject) => {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const req = https.get(oembedUrl, { timeout: 3500 }, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`oEmbed HTTP ${res.statusCode}`));
        }
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            let videoId = '';
            try {
              const u = new URL(url);
              videoId = u.searchParams.get('v') || u.pathname.split('/').filter(Boolean).pop() || '';
            } catch (_) {}

            const thumbnail = videoId
              ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
              : (json.thumbnail_url || null);

            resolve({
              isPlaylist: false,
              id: videoId || json.title,
              title: json.title || 'Vídeo',
              uploader: json.author_name || 'Desconhecido',
              duration: 0,
              durationFormatted: '--:--',
              thumbnail,
              url
            });
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('oEmbed timeout'));
      });
      req.on('error', (err) => reject(err));
    });
  }

  async inspectUrl(rawUrl) {
    const cleanUrl = this.sanitizeUrl(rawUrl);
    if (!cleanUrl) {
      throw new Error('Informe um link válido.');
    }

    // 1. Consulta o cache em memória (evita requisições duplicadas)
    const cached = this.metadataCache.get(cleanUrl);
    if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
      return cached.data;
    }

    // 2. Se for vídeo individual do YouTube, tenta oEmbed ultrarrápido (< 400ms, sem risco de 429)
    if (this.isSingleYouTubeVideo(cleanUrl)) {
      try {
        const oembedData = await this._inspectWithOembed(cleanUrl);
        if (oembedData && oembedData.title) {
          this.metadataCache.set(cleanUrl, { data: oembedData, timestamp: Date.now() });
          return oembedData;
        }
      } catch (_) {
        // Fallback gracioso para yt-dlp caso oEmbed falhe
      }
    }

    // 3. Playlists, outras plataformas ou fallback: yt-dlp com flags otimizadas
    const data = await this._inspectWithYtdlp(cleanUrl);
    this.metadataCache.set(cleanUrl, { data, timestamp: Date.now() });
    return data;
  }

  async _inspectWithYtdlp(url) {
    await this._ensureFfmpeg();
    const { ytdlpPath, binDir } = this.getPaths();

    if (!fs.existsSync(ytdlpPath)) {
      throw new Error('O motor de download (yt-dlp) ainda não está pronto.');
    }

    const { denoPath } = this.getPaths();
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

  /**
   * Baixa a mídia. Se o mesmo link já foi baixado anteriormente (mesmo arquivo),
   * duplica localmente sem fazer requisições extras ao YouTube, poupando rate limit e tempo.
   */
  async download(downloadId, options, onProgress, onStatus) {
    const { url, mode, outputDir, isPlaylist } = options;
    const destDir = outputDir || path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Downloads');

    // Se for item individual (não playlist), verifica se já existe para duplicar localmente
    if (!isPlaylist && url) {
      const cacheKey = this._getCacheKey(url, mode, destDir, options);

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
            return await this._duplicateExistingFile(downloadId, originalFilePath, onProgress, onStatus);
          }
        } catch (_) {}
      }

      // 2. Se já tiver sido concluído e o arquivo físico existir no disco
      const previous = this.completedDownloads.get(cacheKey);
      if (previous && previous.filePath && fs.existsSync(previous.filePath)) {
        return await this._duplicateExistingFile(downloadId, previous.filePath, onProgress, onStatus);
      }

      // 3. Verificação de fallback pelo título na pasta de destino
      try {
        const found = this._findExistingFile(destDir, mode, options);
        if (found && fs.existsSync(found)) {
          this.completedDownloads.set(cacheKey, {
            key: cacheKey,
            url: this.sanitizeUrl(url),
            filePath: found,
            title: options.title,
            mode,
            timestamp: Date.now()
          });
          this._saveCompletedHistory();
          return await this._duplicateExistingFile(downloadId, found, onProgress, onStatus);
        }
      } catch (_) {}
    }

    const subsEnabled = options.mode === 'video' && options.video?.subtitles?.enabled;
    if (!subsEnabled) {
      return this._runDownload(downloadId, options, onProgress, onStatus);
    }

    // Primeira tentativa: segura o status de erro caso seja só de legenda
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
      const cleanUrl = this.sanitizeUrl(url);

      const destDir = outputDir || path.join(process.env.USERPROFILE || process.env.HOME || '.', 'Downloads');
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Diretório temporário isolado por download para evitar conflitos de arquivos e locks no Windows
      const tempDir = path.join(os.tmpdir(), 'clipdrop_temp', downloadId);
      try {
        fs.mkdirSync(tempDir, { recursive: true });
        this.activeTempDirs.set(downloadId, tempDir);
      } catch (_) {}

      const cleanupTemp = () => {
        try {
          this.activeTempDirs.delete(downloadId);
          if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        } catch (_) {}
      };

      // Anti-duplicação silencioso (.archive.txt) e demais flags ficam em buildDownloadArgs
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

      const cacheKey = this._getCacheKey(url, mode, destDir, options);
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

          // Rastreia arquivo de destino final gerado
          const destMatch = line.match(/(?:Destination:\s*|Merging formats into\s*["']?|Moving to\s*["']?)(.+?)(?:["']?\s*$)/i);
          if (destMatch && destMatch[1]) {
            const candidate = destMatch[1].replace(/["']/g, '').trim();
            if (!candidate.endsWith('.temp') && !candidate.endsWith('.part') && !candidate.endsWith('.ytdl') && !candidate.endsWith('.webp')) {
              finalFilePath = path.isAbsolute(candidate) ? candidate : path.resolve(destDir, candidate);
            }
          }

          if (line.includes('has already been downloaded')) {
            const alreadyMatch = line.match(/\[download\]\s+(.+?)\s+has already been downloaded/i);
            if (alreadyMatch && alreadyMatch[1]) {
              const candidate = alreadyMatch[1].trim();
              finalFilePath = path.isAbsolute(candidate) ? candidate : path.resolve(destDir, candidate);
            }
          }

          // Se yt-dlp indicar início de download de áudio separado, rastreia o estágio
          if (line.includes('[download] Destination:') || line.includes('Destination:')) {
            if (isVideoWithAudio && (line.includes('.f251.') || line.includes('.f140.') || line.includes('audio') || line.endsWith('.webm') || line.endsWith('.m4a'))) {
              currentStreamIndex = 2;
            }
          }

          let percentNum = null;
          let speed = '--';
          let eta = '--';
          let totalBytes = '';

          // 1. Parser com prefixo customizado clipdrop_progress: ou download:
          if (line.includes('clipdrop_progress:') || line.startsWith('download:')) {
            const cleanLine = line.replace('clipdrop_progress:', '').replace('download:', '').trim();
            const parts = cleanLine.split('|');
            if (parts.length >= 3) {
              percentNum = parseFloat(parts[0].replace('%', '').trim());
              speed = parts[1].trim() || '--';
              eta = parts[2].trim() || '--';
              if (parts[3]) totalBytes = parts[3].trim();
            }
          } else {
            // 2. Parser padrão yt-dlp (ex.: 50.0%| 4.2MiB/s| 00:15 ou [download] 50.0% of ...)
            const pipeMatch = line.match(/^\s*(\d+(?:\.\d+)?)%\s*\|\s*([^|]+)\s*\|\s*([^|\r\n]+)(?:\|\s*([^|\r\n]+))?/);
            if (pipeMatch) {
              percentNum = parseFloat(pipeMatch[1]);
              speed = pipeMatch[2].trim() || '--';
              eta = pipeMatch[3].trim() || '--';
              if (pipeMatch[4]) totalBytes = pipeMatch[4].trim();
            } else {
              const stdMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s*(?:of\s+([^\s]+))?\s*(?:at\s+([^\s]+))?\s*(?:ETA\s+([^\s]+))?/i);
              if (stdMatch) {
                percentNum = parseFloat(stdMatch[1]);
                totalBytes = stdMatch[2] || '';
                speed = stdMatch[3] || '--';
                eta = stdMatch[4] || '--';
              }
            }
          }

          if (percentNum !== null && !isNaN(percentNum)) {
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

          // Parser de etapas amigáveis de pós-processamento
          if (line.includes('[ExtractAudio]')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'postprocessing',
                percent: 94,
                message: 'Convertendo e extraindo áudio...'
              });
            }
          } else if (line.includes('[EmbedThumbnail]') || line.includes('Converting thumbnail')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'postprocessing',
                percent: 97,
                message: 'Embutindo capa oficial...'
              });
            }
          } else if (line.includes('[Metadata]') || line.includes('Adding metadata')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'postprocessing',
                percent: 98,
                message: 'Gravando tags de metadados...'
              });
            }
          } else if (line.includes('[Merger]') || line.includes('Merging formats')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'merging',
                percent: 95,
                message: 'Unificando vídeo e áudio em alta qualidade...'
              });
            }
          } else if (line.includes('[EmbedChapters]') || line.includes('Adding chapters')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'postprocessing',
                percent: 97,
                message: 'Incrustando capítulos no vídeo...'
              });
            }
          } else if (line.includes('[EmbedSubtitle]') || line.includes('Embedding subtitles')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'postprocessing',
                percent: 96,
                message: 'Embutindo faixas de legendas...'
              });
            }
          } else if (line.includes('[VideoConvertor]') || line.includes('[VideoRemuxer]')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'postprocessing',
                percent: 95,
                message: 'Recodificando formato de vídeo...'
              });
            }
          } else if (line.includes('Downloading section')) {
            if (onStatus) {
              onStatus({
                downloadId,
                status: 'downloading',
                message: 'Baixando trecho selecionado (trim)...'
              });
            }
          } else if (line.includes('has already been recorded in the archive')) {
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
            const existing = finalFilePath || this._findExistingFile(destDir, mode, options);
            if (existing && fs.existsSync(existing)) {
              if (resolveActive) resolveActive(existing);
              this.activeDownloadsByUrl.delete(cacheKey);
              try {
                const res = await this._duplicateExistingFile(downloadId, existing, onProgress, onStatus);
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

          // Hardsub opcional: se requisitado, queima a legenda com ffmpeg
          try {
            await this._burnHardsubIfNeeded(downloadId, options, destDir, onStatus);
          } catch (burnErr) {
            console.warn('[Hardsub] Aviso durante processamento de hardsub:', burnErr.message);
          }

          if (!finalFilePath || !fs.existsSync(finalFilePath)) {
            try {
              const files = fs.readdirSync(destDir).map((f) => ({
                name: f,
                fullPath: path.join(destDir, f),
                mtime: fs.statSync(path.join(destDir, f)).mtimeMs
              })).sort((a, b) => b.mtime - a.mtime);
              const recent = files.find((f) => !f.name.endsWith('.temp') && !f.name.endsWith('.part') && !f.name.endsWith('.txt') && !f.name.endsWith('.webp'));
              if (recent && fs.existsSync(recent.fullPath)) {
                finalFilePath = recent.fullPath;
              }
            } catch (_) {}
          }

          if (finalFilePath && fs.existsSync(finalFilePath) && !isPlaylist) {
            this.completedDownloads.set(cacheKey, {
              key: cacheKey,
              url: cleanUrl,
              filePath: finalFilePath,
              title: options.title,
              mode,
              timestamp: Date.now()
            });
            this._saveCompletedHistory();
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

  async _burnHardsubIfNeeded(downloadId, options, destDir, onStatus) {
    if (options.mode !== 'video') return;
    const subs = options.video?.subtitles;
    if (!subs?.enabled || subs?.method !== 'hardsub') return;

    const { ffmpegPath } = this.getPaths();
    if (!fs.existsSync(ffmpegPath)) return;

    try {
      const files = fs.readdirSync(destDir);
      const videoExts = ['.mp4', '.mkv', '.webm', '.mov'];
      const subExts = ['.srt', '.vtt'];

      const videoFile = files.find((f) => videoExts.includes(path.extname(f).toLowerCase()) && !f.startsWith('temp_hardsub_'));
      const subFile = files.find((f) => subExts.includes(path.extname(f).toLowerCase()));

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

      // Escapamento compatível com o parser de filtros do FFmpeg
      const filterSubPath = subPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");

      await new Promise((resolve) => {
        const burnProc = spawn(ffmpegPath, [
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

module.exports = YtdlpExecutor;
