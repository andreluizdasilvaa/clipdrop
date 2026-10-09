// Gerenciamento de estado da interface do ClipDrop (navegação por modos)

const STORAGE_KEY = 'clipdrop_settings_v2';

const DEFAULT_SETTINGS = {
  audio: {
    format: 'mp3', // 'mp3' | 'flac'
    embedCover: true,
    embedMetadata: true,
    sponsorblock: false
  },
  video: {
    quality: 'best', // 'best' | '1080' | '720'
    subtitles: { enabled: false, lang: 'pt' }, // 'pt' | 'en'
    sponsorblock: { sponsor: false, introOutro: false, selfpromo: false, mode: 'remove' } // 'remove' | 'mark'
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
    return deepMerge(DEFAULT_SETTINGS, JSON.parse(localStorage.getItem(STORAGE_KEY)));
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
  setSetting(mode, path, value) {
    const keys = path.split('.');
    let target = this.state.settings[mode];
    for (let i = 0; i < keys.length - 1; i++) {
      target = target[keys[i]];
    }
    target[keys[keys.length - 1]] = value;
    this.persist();
    this.notify();
  }

  getSetting(mode, path) {
    return path.split('.').reduce((obj, key) => obj[key], this.state.settings[mode]);
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
