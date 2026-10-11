// Gerenciamento de estado da interface do ClipDrop (navegação por modos)

const STORAGE_KEY = 'clipdrop_settings_v5';

const DEFAULT_SETTINGS = {
  audio: {
    format: 'mp3', // 'mp3' | 'm4a' | 'flac' | 'wav' | 'opus'
    quality: '0', // '0' (melhor VBR) | '320' | '256' | '192'
    advanced: {
      embedCover: true,
      embedMetadata: true,
      trim: {
        enabled: false,
        start: '',
        end: ''
      },
      playlistRange: '',
      concurrentFragments: true
    }
  },
  video: {
    quality: 'best', // 'best' | '1080' | '720' | '480'
    subtitles: {
      enabled: false,
      lang: 'pt', // 'pt' | 'en' | 'es'
      type: 'official', // 'official' | 'auto' | 'both'
      method: 'softsub', // 'softsub' | 'separate' | 'hardsub'
      format: 'srt'
    },
    advanced: {
      container: 'mp4', // 'mp4' | 'mkv' | 'webm' | 'mov'
      videoOnly: false,
      recodeVideo: false,
      embedChapters: true,
      embedThumbnail: false,
      embedMetadata: true,
      trim: {
        enabled: false,
        start: '',
        end: ''
      },
      playlistRange: '',
      concurrentFragments: true
    }
  }
};

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return structuredClone(base);
  const out = {};
  for (const key of Object.keys(base)) {
    const b = base[key];
    const o = override[key];
    if (b && typeof b === 'object' && !Array.isArray(b)) {
      out[key] = deepMerge(b, o);
    } else {
      out[key] = typeof o === typeof b ? o : b;
    }
  }
  return out;
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('clipdrop_settings_v4') || localStorage.getItem('clipdrop_settings_v3') || localStorage.getItem('clipdrop_settings_v2');
    const parsed = JSON.parse(saved);
    // Migração: embedCover/embedMetadata de áudio passaram a viver em audio.advanced.
    if (parsed && parsed.audio && !parsed.audio.advanced) {
      parsed.audio.advanced = {
        embedCover: parsed.audio.embedCover,
        embedMetadata: parsed.audio.embedMetadata
      };
    }
    // Garante que o multi-threading esteja habilitado em migrações que não o possuíam
    if (parsed && parsed.video && parsed.video.advanced && parsed.video.advanced.concurrentFragments === undefined) {
      parsed.video.advanced.concurrentFragments = true;
    }
    if (parsed && parsed.audio && parsed.audio.advanced && parsed.audio.advanced.concurrentFragments === undefined) {
      parsed.audio.advanced.concurrentFragments = true;
    }
    return deepMerge(DEFAULT_SETTINGS, parsed);
  } catch (_) {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

class UIStateManager {
  constructor() {
    this.state = {
      view: 'splash', // 'splash' | 'home' | 'audio' | 'video'
      destinationFolder: '',
      settings: loadSettings(),
      downloads: new Map()
    };
    this.listeners = new Set();
  }

  getState() {
    return this.state;
  }

  getSettings(mode) {
    return this.state.settings[mode];
  }

  navigate(view) {
    if (this.state.view === view) return;
    this.state.view = view;
    this.notify();
  }

  setDestinationFolder(folder) {
    this.state.destinationFolder = folder;
    this.notify();
  }

  /** Atualiza uma configuração por caminho, ex.: setSetting('video', 'subtitles.lang', 'en'). */
  setSetting(mode, path, value, silent = false) {
    const keys = path.split('.');
    let target = this.state.settings[mode];
    for (let i = 0; i < keys.length - 1; i++) {
      if (!target[keys[i]] || typeof target[keys[i]] !== 'object') {
        target[keys[i]] = {};
      }
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
    this.persist();
    if (!silent) {
      this.notify();
    }
  }

  getSetting(mode, path) {
    return path.split('.').reduce((obj, key) => (obj != null ? obj[key] : undefined), this.state.settings[mode]);
  }

  persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state.settings));
    } catch (_) {
      // Armazenamento indisponível: preferências valem só para esta sessão.
    }
  }

  upsertDownload(id, patch) {
    const current = this.state.downloads.get(id) || { id };
    this.state.downloads.set(id, { ...current, ...patch });
    this.notify();
  }

  removeDownload(id) {
    this.state.downloads.delete(id);
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Erro em subscriber de UIState:', err);
      }
    }
  }
}

window.uiState = new UIStateManager();
