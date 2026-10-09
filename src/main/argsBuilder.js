const path = require('path');

const PROGRESS_TEMPLATE =
  'download:%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s';

const VIDEO_FORMATS = {
  best: 'bv*+ba/b',
  '1080': 'bv*[height<=1080]+ba/b[height<=1080]',
  '720': 'bv*[height<=720]+ba/b[height<=720]'
};

const SUBTITLE_LANGS = {
  pt: 'pt.*',
  en: 'en.*'
};

function buildSponsorBlockArgs(categories, mode) {
  if (!categories.length) return [];
  const flag = mode === 'mark' ? '--sponsorblock-mark' : '--sponsorblock-remove';
  return [flag, categories.join(',')];
}

function buildAudioArgs(audio = {}) {
  const format = audio.format === 'flac' ? 'flac' : 'mp3';
  const args = ['-x', '--audio-format', format, '--audio-quality', '0'];

  if (audio.embedMetadata !== false) {
    args.push('--embed-metadata');
  }
  if (audio.embedCover !== false) {
    // A capa vem como webp na maioria das plataformas; jpg é aceito por todos os players.
    args.push('--convert-thumbnails', 'jpg', '--embed-thumbnail');
  }
  if (audio.sponsorblock) {
    args.push(...buildSponsorBlockArgs(['sponsor', 'intro', 'outro'], 'remove'));
  }
  return args;
}

function buildVideoArgs(video = {}) {
  const format = VIDEO_FORMATS[video.quality] || VIDEO_FORMATS.best;
  const args = ['-f', format, '--merge-output-format', 'mp4', '--embed-metadata'];

  const subs = video.subtitles || {};
  if (subs.enabled) {
    args.push('--write-subs', '--sub-langs', SUBTITLE_LANGS[subs.lang] || SUBTITLE_LANGS.pt);
    if (subs.embed !== false) {
      args.push('--embed-subs');
    }
  }

  const sb = video.sponsorblock || {};
  const categories = [];
  if (sb.sponsor) categories.push('sponsor');
  if (sb.introOutro) categories.push('intro', 'outro');
  if (sb.selfpromo) categories.push('selfpromo');
  args.push(...buildSponsorBlockArgs(categories, sb.mode));

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
  const { mode, url, outputDir, binDir, audio, video, isPlaylist = false, selectedIndices = null } = opts;

  if (mode !== 'audio' && mode !== 'video') {
    throw new Error(`Modo de download inválido: ${mode}`);
  }
  if (!url || !String(url).trim()) {
    throw new Error('Informe um link válido.');
  }

  const args = [
    '--newline',
    '--progress-template', PROGRESS_TEMPLATE,
    '--ffmpeg-location', binDir,
    '--download-archive', path.join(outputDir, '.archive.txt'),
    '--paths', outputDir,
    '--no-mtime',
    '--windows-filenames'
  ];

  // Playlists ganham uma subpasta com o nome da própria playlist.
  const template = isPlaylist
    ? '%(playlist_title)s/%(title)s.%(ext)s'
    : '%(title)s.%(ext)s';
  args.push('-o', template);

  if (isPlaylist) {
    // Seleção parcial usa -I; sem seleção, a playlist inteira é baixada.
    if (Array.isArray(selectedIndices) && selectedIndices.length > 0) {
      args.push('-I', selectedIndices.join(','));
    }
  } else {
    args.push('--no-playlist');
  }

  args.push(...(mode === 'audio' ? buildAudioArgs(audio) : buildVideoArgs(video)));
  args.push(String(url).trim());

  return args;
}

module.exports = { buildDownloadArgs, PROGRESS_TEMPLATE, VIDEO_FORMATS };
