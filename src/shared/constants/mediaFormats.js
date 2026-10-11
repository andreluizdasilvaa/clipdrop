/**
 * Constantes e opções de formatos multimídia suportados pelo ClipDrop.
 */
const MEDIA_FORMATS = Object.freeze({
  AUDIO: Object.freeze({
    FORMATS: ['mp3', 'm4a', 'flac', 'wav', 'opus'],
    LOSSLESS: ['flac', 'wav'],
    BITRATES: ['320', '256', '192'],
    DEFAULT_FORMAT: 'mp3',
    DEFAULT_BITRATE: '320'
  }),
  VIDEO: Object.freeze({
    QUALITIES: ['best', '1080', '720', '480'],
    CONTAINERS: ['mp4', 'mkv', 'webm', 'mov'],
    DEFAULT_QUALITY: 'best',
    DEFAULT_CONTAINER: 'mp4'
  }),
  SUBTITLES: Object.freeze({
    LANGUAGES: Object.freeze({
      pt: 'pt,pt-BR,pt-PT',
      en: 'en,en-US,en-GB',
      es: 'es,es-419,es-ES',
      all: 'all,-live_chat'
    }),
    DEFAULT_LANG: 'pt'
  })
});

module.exports = { MEDIA_FORMATS };
