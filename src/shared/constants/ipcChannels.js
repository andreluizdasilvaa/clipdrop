/**
 * Catálogo centralizado de canais IPC do ClipDrop.
 * Elimina o uso de magic strings entre Main, Preload e Renderer.
 */
const IPC_CHANNELS = Object.freeze({
  DEPENDENCIES: Object.freeze({
    GET_STATUS: 'dependencies:get-status',
    START_SETUP: 'dependencies:start-setup',
    PROGRESS: 'dependencies:progress'
  }),
  MEDIA: Object.freeze({
    INSPECT: 'media:inspect'
  }),
  DOWNLOAD: Object.freeze({
    START: 'media:download',
    CANCEL: 'media:cancel-download',
    PROGRESS: 'download:progress',
    STATUS: 'download:status'
  }),
  SYSTEM: Object.freeze({
    CHOOSE_DIRECTORY: 'dialog:choose-directory',
    OPEN_FOLDER: 'shell:open-folder',
    GET_DEFAULT_PATHS: 'system:get-default-paths',
    GET_THEME: 'system:get-theme',
    GET_USERNAME: 'system:get-username',
    GET_USERNAME_SYNC: 'system:get-username-sync'
  })
});

module.exports = { IPC_CHANNELS };
