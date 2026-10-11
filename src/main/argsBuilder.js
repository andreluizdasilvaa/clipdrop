const path = require('path');

const PROGRESS_TEMPLATE =
  'download:clipdrop_progress:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s|%(progress._total_bytes_str,progress._total_bytes_estimate_str)s';

const VIDEO_FORMATS = {
  best: 'bv*+ba/b',
  '1080': 'bv*[height<=1080]+ba/b[height<=1080]',
  '720': 'bv*[height<=720]+ba/b[height<=720]',
  '480': 'bv*[height<=480]+ba/b[height<=480]'
};

const VIDEO_ONLY_FORMATS = {
  best: 'bv*',
  '1080': 'bv*[height<=1080]',
  '720': 'bv*[height<=720]',
  '480': 'bv*[height<=480]'
};

// Idiomas exatos: padrões como 'pt.*' casam com dezenas de faixas de tradução automática
// (pt-en, pt-es...) e geram dezenas de requisições, o que causa HTTP 429.
const SUBTITLE_LANGS = {
  pt: 'pt,pt-BR,pt-PT',
  en: 'en,en-US,en-GB',
  es: 'es,es-419,es-ES',
  all: 'all,-live_chat'
};

const AUDIO_FORMATS = ['mp3', 'm4a', 'flac', 'wav', 'opus'];
const LOSSLESS_FORMATS = ['flac', 'wav'];
const AUDIO_BITRATES = ['320', '256', '192'];
const TIME_PATTERN = /^\d+(:\d{1,2}){0,2}(\.\d+)?$/;
const RANGE_PATTERN = /^[\d,\-: ]+$/;

function buildAudioArgs(audio = {}) {
  const adv = audio.advanced || {};
  const format = AUDIO_FORMATS.includes(audio.format) ? audio.format : 'mp3';
  const args = ['-x', '--audio-format', format];

  if (!LOSSLESS_FORMATS.includes(format)) {
    const quality = AUDIO_BITRATES.includes(String(audio.quality)) ? `${audio.quality}K` : '0';
    args.push('--audio-quality', quality);
  }

  // Baixa apenas o melhor fluxo de áudio, evitando download desnecessário de vídeo
  if (format === 'm4a') {
    args.push('-f', 'ba[ext=m4a]/ba/b');
  } else if (format === 'opus') {
    args.push('-f', 'ba[ext=opus]/ba/b');
  } else {
    args.push('-f', 'ba/b');
  }

  const embedMetadata = adv.embedMetadata ?? audio.embedMetadata;
  const embedCover = adv.embedCover ?? audio.embedCover;

  if (embedMetadata !== false) {
    args.push('--embed-metadata');
  }
  // WAV não suporta capa embutida. A capa vem como webp na maioria das plataformas; jpg é aceito por todos os players.
  if (embedCover !== false && format !== 'wav') {
    args.push('--convert-thumbnails', 'jpg', '--embed-thumbnail', '--no-write-thumbnail');
  }
  args.push('--no-keep-video');

  const trim = adv.trim || {};
  if (trim.enabled && (trim.start || trim.end)) {
    const start = String(trim.start || '').trim() || '0';
    const end = String(trim.end || '').trim() || 'inf';
    if (TIME_PATTERN.test(start) && (end === 'inf' || TIME_PATTERN.test(end))) {
      args.push('--download-sections', `*${start}-${end}`);
    }
  }
  return args;
}

function buildVideoArgs(video = {}) {
  const adv = video.advanced || {};
  const isVideoOnly = Boolean(adv.videoOnly ?? video.videoOnly);

  const formatTable = isVideoOnly ? VIDEO_ONLY_FORMATS : VIDEO_FORMATS;
  const format = formatTable[video.quality] || formatTable.best;
  const container = adv.container || video.container || 'mp4';
  const recodeVideo = Boolean(adv.recodeVideo ?? video.recodeVideo);
  const embedChapters = adv.embedChapters ?? video.embedChapters;
  const embedThumbnail = Boolean(adv.embedThumbnail ?? video.embedThumbnail);
  const embedMetadata = adv.embedMetadata ?? video.embedMetadata;
  const trim = adv.trim || video.trim || {};

  const args = ['-f', format];

  if (container) {
    args.push('--merge-output-format', container);
  }

  if (recodeVideo) {
    args.push('--recode-video', container || 'mp4');
  }

  if (embedMetadata !== false) {
    args.push('--embed-metadata');
  } else {
    args.push('--no-embed-metadata');
  }

  if (embedChapters !== false) {
    args.push('--embed-chapters');
  } else {
    args.push('--no-embed-chapters');
  }

  if (embedThumbnail) {
    args.push('--convert-thumbnails', 'jpg', '--embed-thumbnail');
  }

  const subs = video.subtitles || {};
  if (subs.enabled) {
    const lang = SUBTITLE_LANGS[subs.lang] || subs.lang || SUBTITLE_LANGS.pt;
    const subType = subs.type || 'official';

    if (subType === 'auto') {
      args.push('--write-auto-subs');
    } else if (subType === 'both') {
      args.push('--write-subs', '--write-auto-subs');
    } else {
      args.push('--write-subs');
    }

    args.push('--sub-langs', lang, '--sleep-subtitles', '3');

    const method = subs.method || (subs.embed !== false ? 'softsub' : 'separate');
    if (method === 'softsub') {
      args.push('--embed-subs');
    } else if (method === 'separate') {
      const subFormat = subs.format || 'srt';
      args.push('--no-embed-subs', '--convert-subs', subFormat);
    } else if (method === 'hardsub') {
      args.push('--convert-subs', 'srt');
    }
  }

  if (trim.enabled && (trim.start || trim.end)) {
    const start = String(trim.start || '').trim() || '0';
    const end = String(trim.end || '').trim() || 'inf';
    args.push('--download-sections', `*${start}-${end}`);
  }

  return args;
}

/**
 * Monta a lista completa de argumentos do yt-dlp para um download.
 *
 * @param {object} opts
 * @param {'audio'|'video'} opts.mode
 * @param {string} opts.url
 * @param {string} opts.outputDir        Pasta de destino (--paths)
 * @param {string} opts.binDir           Pasta com ffmpeg/ffprobe (--ffmpeg-location)
 * @param {object} [opts.audio]          Configurações do modo áudio
 * @param {object} [opts.video]          Configurações do modo vídeo
 * @param {boolean} [opts.isPlaylist]    A URL é uma playlist/canal
 * @param {number[]|null} [opts.selectedIndices]  Itens marcados; null/vazio = playlist inteira
 */
function buildDownloadArgs(opts) {
  const { mode, url, outputDir, binDir, denoPath = null, audio, video, isPlaylist = false, selectedIndices = null, tempDir = null } = opts;

  if (mode !== 'audio' && mode !== 'video') {
    throw new Error(`Modo de download inválido: ${mode}`);
  }
  if (!url || !String(url).trim()) {
    throw new Error('Informe um link válido.');
  }

  const modeSettings = (mode === 'audio' ? audio : video) || {};
  const adv = modeSettings.advanced || {};
  const ignoreExisting = adv.ignoreExisting ?? modeSettings.ignoreExisting;
  // Multi-threading (fragmentos concorrentes) ativado por padrão para acelerar o download
  const concurrentFragments = (adv.concurrentFragments ?? modeSettings.concurrentFragments) !== false;
  const cautiousMode = Boolean(adv.cautiousMode ?? modeSettings.cautiousMode);
  const rawRange = adv.playlistRange || modeSettings.playlistRange;
  const playlistRange = rawRange && RANGE_PATTERN.test(String(rawRange).trim()) ? rawRange : '';

  const args = [
    '--newline',
    '--progress-template', PROGRESS_TEMPLATE,
    '--ffmpeg-location', binDir,
    '--retries', '10',
    '--fragment-retries', '10',
    '--file-access-retries', '10',
    '--retry-sleep', 'http:exp=1:30',
    '--retry-sleep', 'fragment:exp=1:30',
    '--retry-sleep', 'file_access:linear=1::2',
    // Otimizações de desempenho e contorno de estrangulamento de banda do YouTube:
    '--http-chunk-size', '10M',
    '--buffer-size', '1024K'
  ];

  // Runtime JavaScript interno (deno): necessário para o YouTube e reduz bloqueios/formatos ausentes.
  if (denoPath) {
    args.push('--js-runtimes', `deno:${denoPath}`);
  }

  if (ignoreExisting !== false) {
    // Histórico separado por modo: um vídeo já baixado não bloqueia o áudio do mesmo link.
    const archiveName = mode === 'audio' ? '.archive-audio.txt' : '.archive.txt';
    args.push('--download-archive', path.join(outputDir, archiveName));
  }

  if (tempDir) {
    args.push(
      '--paths', `home:${outputDir}`,
      '--paths', `temp:${tempDir}`
    );
  } else {
    args.push('--paths', outputDir);
  }

  args.push(
    '--no-mtime',
    '--windows-filenames'
  );

  if (concurrentFragments) {
    args.push('-N', '4');
  }

  if (cautiousMode) {
    args.push('--sleep-requests', '1', '--min-sleep-interval', '3', '--max-sleep-interval', '10');
  } else if (isPlaylist) {
    // Espaçamento suave para playlists, evitando bloqueios por taxa de requisições excessivas (HTTP 429)
    args.push('--sleep-interval', '1', '--max-sleep-interval', '2');
  }

  // Playlists ganham uma subpasta com o nome da própria playlist.
  const template = isPlaylist
    ? '%(playlist_title)s/%(title)s.%(ext)s'
    : '%(title)s.%(ext)s';
  args.push('-o', template);

  if (isPlaylist) {
    // Seleção parcial via array de índices ou intervalo textual customizado
    if (Array.isArray(selectedIndices) && selectedIndices.length > 0) {
      args.push('-I', selectedIndices.join(','));
    } else if (playlistRange && String(playlistRange).trim()) {
      args.push('-I', String(playlistRange).trim());
    }
  } else {
    args.push('--no-playlist');
  }

  args.push(...(mode === 'audio' ? buildAudioArgs(audio) : buildVideoArgs(video)));
  args.push(String(url).trim());

  return args;
}

module.exports = {
  buildDownloadArgs,
  buildVideoArgs,
  buildAudioArgs,
  PROGRESS_TEMPLATE,
  VIDEO_FORMATS,
  VIDEO_ONLY_FORMATS,
  SUBTITLE_LANGS
};

