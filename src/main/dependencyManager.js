const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { getUserDataDir } = require('./utils/pathUtils');

class DependencyManager {
  constructor() {
    this.isWin = process.platform === 'win32';

    // Armazenamento isolado de binários em userData/bin (sem exigir admin)
    this.binDir = path.join(getUserDataDir(), 'bin');

    this.binaries = {
      ytdlp: {
        name: 'yt-dlp.exe',
        label: 'Motor de download (yt-dlp)',
        resolvedPath: null,
        status: 'checking'
      },
      ffmpeg: {
        name: 'ffmpeg.exe',
        label: 'Conversor de mídia (ffmpeg)',
        resolvedPath: null,
        status: 'checking'
      },
      ffprobe: {
        name: 'ffprobe.exe',
        label: 'Analisador de mídia (ffprobe)',
        resolvedPath: null,
        status: 'checking'
      },
      // Opcional: runtime JavaScript exigido pelo yt-dlp para o YouTube
      deno: {
        name: 'deno.exe',
        label: 'Runtime JavaScript (deno)',
        optional: true,
        resolvedPath: null,
        status: 'checking'
      }
    };
  }

  ensureBinDir() {
    if (!fs.existsSync(this.binDir)) {
      fs.mkdirSync(this.binDir, { recursive: true });
    }
  }

  getBinaryUrls() {
    return {
      ytdlp: {
        url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
        isZip: false
      },
      ffmpeg: {
        url: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffmpeg-6.1-win-64.zip',
        isZip: true
      },
      ffprobe: {
        url: 'https://github.com/ffbinaries/ffbinaries-prebuilt/releases/download/v6.1/ffprobe-6.1-win-64.zip',
        isZip: true
      },
      deno: {
        url: 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip',
        isZip: true
      }
    };
  }

  checkSystemPath(binName) {
    try {
      // 1. Tenta encontrar diretamente no PATH sem abrir processos externos
      const pathEnv = process.env.PATH || process.env.Path || '';
      const pathDirs = pathEnv.split(path.delimiter);
      for (const dir of pathDirs) {
        if (!dir) continue;
        const candidate = path.join(dir, binName);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    } catch (_) {}

    try {
      const cmd = `where.exe ${binName}`;
      const stdout = execSync(cmd, {
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf-8',
        windowsHide: true
      });
      const firstLine = stdout.trim().split(/\r?\n/)[0];
      if (firstLine && fs.existsSync(firstLine)) {
        return firstLine;
      }
    } catch (_) {
      // Não encontrado no PATH global
    }
    return null;
  }

  checkLocalBin(binName) {
    const localPath = path.join(this.binDir, binName);
    if (fs.existsSync(localPath)) {
      return localPath;
    }
    return null;
  }

  async downloadWithProgress(url, targetPath, onProgress, maxRedirects = 5) {
    if (maxRedirects <= 0) {
      throw new Error(`Limite de redirecionamentos excedido para: ${url}`);
    }

    return new Promise((resolve, reject) => {
      const client = url.startsWith('https:') ? https : http;
      const req = client.get(url, { headers: { 'User-Agent': 'ClipDrop-Installer/1.0' } }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href;
          return resolve(this.downloadWithProgress(redirectUrl, targetPath, onProgress, maxRedirects - 1));
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Falha no download (${res.statusCode}): ${res.statusMessage}`));
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;
        const fileStream = fs.createWriteStream(targetPath);

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          const percent = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          if (onProgress) {
            onProgress({ downloadedBytes, totalBytes, percent });
          }
        });

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => resolve(targetPath));
        });

        fileStream.on('error', (err) => {
          fs.unlink(targetPath, () => {});
          reject(err);
        });
      });

      req.on('error', (err) => {
        fs.unlink(targetPath, () => {});
        reject(err);
      });
    });
  }

  async extractZip(zipPath, targetDir, expectedBinName) {
    const AdmZip = require('adm-zip');
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(targetDir, true);

    const rootBinPath = path.join(targetDir, expectedBinName);
    if (!fs.existsSync(rootBinPath)) {
      const entries = zip.getEntries();
      for (const entry of entries) {
        if (path.basename(entry.entryName).toLowerCase() === expectedBinName.toLowerCase()) {
          zip.extractEntryTo(entry, targetDir, false, true);
          break;
        }
      }
    }
  }

  async updateYtDlpInBackground() {
    const ytdlpPath = this.binaries.ytdlp.resolvedPath;
    if (!ytdlpPath || !fs.existsSync(ytdlpPath)) return;

    try {
      console.log('[dependencyManager] Verificando atualizações do yt-dlp em segundo plano...');
      const proc = spawn(ytdlpPath, ['-U'], {
        stdio: 'ignore',
        windowsHide: true
      });
      proc.on('error', () => {});
      proc.unref();
    } catch (err) {
      console.warn('[dependencyManager] Erro silencioso ao checar update do yt-dlp:', err.message);
    }
  }

  async verifyAndSetup(onStatusUpdate) {
    this.ensureBinDir();
    const urls = this.getBinaryUrls();

    const updateUI = (key, data) => {
      if (this.binaries[key]) {
        Object.assign(this.binaries[key], data);
      }
      if (onStatusUpdate) {
        onStatusUpdate({
          key,
          state: this.binaries[key],
          allBinaries: this.getSummary()
        });
      }
    };

    const keys = ['ytdlp', 'ffmpeg', 'ffprobe', 'deno'];

    for (const key of keys) {
      const binMeta = this.binaries[key];
      updateUI(key, { status: 'checking', message: 'Verificando instalação...' });

      // 1. ffmpeg/ffprobe sempre ficam na pasta interna do app: é ela que é passada ao yt-dlp
      //    via --ffmpeg-location, então um ffmpeg do PATH global não serviria.
      let foundPath = null;
      if (key === 'ytdlp') {
        foundPath = this.checkSystemPath(binMeta.name);
      }
      if (!foundPath) {
        // 2. Verifica se já existe na pasta isolada userData/bin
        foundPath = this.checkLocalBin(binMeta.name);
      }

      if (foundPath) {
        updateUI(key, {
          status: 'ready',
          resolvedPath: foundPath,
          message: 'Pronto para uso'
        });
        continue;
      }

      // 3. Ausente: Realiza download automático silencioso
      const info = urls[key];
      updateUI(key, { status: 'downloading', percent: 0, message: 'Baixando binário oficial...' });

      const onProgress = ({ percent }) => {
        updateUI(key, { status: 'downloading', percent, message: `Baixando... ${percent}%` });
      };

      try {
        if (info.isZip) {
          const tempZip = path.join(this.binDir, `${key}_temp.zip`);
          await this.downloadWithProgress(info.url, tempZip, onProgress);

          updateUI(key, { status: 'extracting', percent: 100, message: 'Descompactando arquivos...' });
          await this.extractZip(tempZip, this.binDir, binMeta.name);

          try {
            if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
          } catch (_) {}

          const localPath = path.join(this.binDir, binMeta.name);
          updateUI(key, {
            status: 'ready',
            resolvedPath: localPath,
            message: 'Instalado com sucesso'
          });
        } else {
          // Arquivo executável direto (ex: yt-dlp standalone)
          const targetPath = path.join(this.binDir, binMeta.name);
          await this.downloadWithProgress(info.url, targetPath, onProgress);
          updateUI(key, {
            status: 'ready',
            resolvedPath: targetPath,
            message: 'Instalado com sucesso'
          });
        }
      } catch (err) {
        console.error(`[dependencyManager] Erro ao baixar ${key}:`, err);
        updateUI(key, {
          status: 'error',
          error: err.message,
          message: `Falha no download: ${err.message}`
        });
        if (binMeta.optional) continue;
        throw new Error(`Falha ao configurar dependência ${binMeta.label}: ${err.message}`);
      }
    }

    // Se yt-dlp foi garantido, roda atualização em background
    this.updateYtDlpInBackground();

    return this.getSummary();
  }

  getSummary() {
    return {
      binDir: this.binDir,
      // Dependências opcionais (deno) não bloqueiam o app.
      ready: Object.values(this.binaries).filter(b => !b.optional).every(b => b.status === 'ready'),
      binaries: {
        ytdlp: { ...this.binaries.ytdlp },
        ffmpeg: { ...this.binaries.ffmpeg },
        ffprobe: { ...this.binaries.ffprobe },
        deno: { ...this.binaries.deno }
      }
    };
  }

  getPaths() {
    return {
      binDir: this.binDir,
      ytdlpPath: this.binaries.ytdlp.resolvedPath || path.join(this.binDir, this.binaries.ytdlp.name),
      ffmpegPath: this.binaries.ffmpeg.resolvedPath || path.join(this.binDir, this.binaries.ffmpeg.name),
      ffprobePath: this.binaries.ffprobe.resolvedPath || path.join(this.binDir, this.binaries.ffprobe.name),
      denoPath: this.binaries.deno.resolvedPath || path.join(this.binDir, this.binaries.deno.name)
    };
  }
}

module.exports = DependencyManager;