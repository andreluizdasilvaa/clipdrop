// Base compartilhada pelos modos Áudio e Vídeo:
// botão voltar, cabeçalho, URL, configurações, pré-visualização e disparo do download.
class ModeView {
  /**
   * @param {object} cfg
   * @param {HTMLElement} cfg.container
   * @param {'audio'|'video'} cfg.mode
   * @param {string} cfg.badge     Rótulo curto do modo
   * @param {string} cfg.title     Título da tela
   * @param {string} cfg.subtitle  Texto de apoio
   * @param {string} cfg.verb      Verbo do botão ("Baixar música", "Baixar vídeo")
   * @param {DownloadList} cfg.downloads
   */
  constructor({ container, mode, badge, title, subtitle, verb, downloads }) {
    this.container = container;
    this.mode = mode;
    this.badge = badge;
    this.title = title;
    this.subtitle = subtitle;
    this.verb = verb;
    this.downloads = downloads;
    this.media = null;
    this.inspecting = false;
    this.accordionOpen = false;
    this.mount();
  }

  // ---- Ganchos para as subclasses ----
  settingsHtml() { return ''; }
  extraOptions() { return {}; }

  /**
   * Verifica configurações avançadas comuns aos modos (trim, playlistRange, etc.)
   * @param {object} adv
   * @returns {boolean}
   */
  hasCommonCustomAdvanced(adv = {}) {
    return (
      Boolean(adv.trim?.enabled) ||
      Boolean(adv.playlistRange) ||
      adv.concurrentFragments === false ||
      adv.embedMetadata === false
    );
  }

  mount() {
    this.container.innerHTML = `
      <button type="button" class="back-link" data-role="back"><span style="display:inline-block; vertical-align:middle; margin-right:4px;">${ICONS.back}</span> Voltar ao início</button>
      <header class="view-head">
        <span class="chip chip-solid">${escapeHtml(this.badge)}</span>
        <h1 class="view-title">${escapeHtml(this.title)}</h1>
        <p class="view-sub">${escapeHtml(this.subtitle)}</p>
      </header>
      <div class="url-slot" data-role="url"></div>
      <div class="settings-card" data-role="settings"></div>
      <div class="preview-slot">
        <div data-role="single"></div>
        <div data-role="playlist"></div>
      </div>`;

    this.settingsEl = this.container.querySelector('[data-role="settings"]');
    this.singleEl = this.container.querySelector('[data-role="single"]');

    this.urlBar = new UrlBar(this.container.querySelector('[data-role="url"]'), {
      onSubmit: (url) => this.inspect(url),
      onClear: () => this.clearPreview()
    });

    this.playlistView = new PlaylistView(this.container.querySelector('[data-role="playlist"]'), {
      downloadLabel: this.verb,
      onDownload: ({ playlist, selectedIndices, count }) => {
        this.startDownload({
          title: `${playlist.title} (${count} ${count === 1 ? 'item' : 'itens'})`,
          thumbnail: playlist.thumbnail,
          isPlaylist: true,
          selectedIndices
        });
      }
    });

    this.container.querySelector('[data-role="back"]').addEventListener('click', () => {
      this.reset();
      uiState.navigate('home');
    });

    this.bindSettings();
    this.renderSettings();
  }

  // ---- Configurações (delegação centralizada de eventos) ----
  renderSettings() {
    this.settingsEl.innerHTML = this.settingsHtml();
  }

  toggleAccordion() {
    this.accordionOpen = !this.accordionOpen;
    const trigger = this.settingsEl.querySelector('[data-role="accordion-trigger"]');
    const panel = this.settingsEl.querySelector('.accordion-panel');
    const chevron = this.settingsEl.querySelector('.accordion-chevron');
    if (trigger) {
      trigger.setAttribute('aria-expanded', this.accordionOpen);
      trigger.classList.toggle('open', this.accordionOpen);
    }
    if (panel) panel.classList.toggle('open', this.accordionOpen);
    if (chevron) chevron.classList.toggle('open', this.accordionOpen);
  }

  bindSettings() {
    this.settingsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.seg-btn');
      if (btn) {
        uiState.setSetting(this.mode, btn.dataset.seg, btn.dataset.value);
        this.renderSettings();
        return;
      }

      const trigger = e.target.closest('[data-role="accordion-trigger"]');
      if (trigger) {
        this.toggleAccordion();
      }
    });

    this.settingsEl.addEventListener('input', (e) => {
      const input = e.target.closest('input[data-setting]');
      if (input) {
        uiState.setSetting(this.mode, input.dataset.setting, input.value, true);
      }
    });

    this.settingsEl.addEventListener('change', (e) => {
      const toggle = e.target.closest('input[data-toggle]');
      if (toggle) {
        uiState.setSetting(this.mode, toggle.dataset.toggle, toggle.checked);
        this.renderSettings();
        return;
      }

      const select = e.target.closest('select[data-select]');
      if (select) {
        uiState.setSetting(this.mode, select.dataset.select, select.value);
        this.renderSettings();
        return;
      }

      const input = e.target.closest('input[data-setting]');
      if (input) {
        uiState.setSetting(this.mode, input.dataset.setting, input.value);
      }
    });
  }

  // ---- Inspeção ----
  async inspect(url) {
    if (this.inspecting) return;
    this.inspecting = true;
    this.urlBar.setLoading(true);
    this.clearPreview();

    try {
      const media = await window.clipdropAPI.inspectUrl(url);
      this.media = { ...media, sourceUrl: url };
      if (media.isPlaylist) {
        this.playlistView.setPlaylist(media);
      } else {
        this.renderSingle(media);
      }
      // O botão de baixar fica abaixo das configurações; garante que apareça na tela.
      requestAnimationFrame(() => {
        this.container.querySelector('.preview-slot').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    } catch (err) {
      showToast(this.friendlyError(err), 'error');
    } finally {
      this.inspecting = false;
      this.urlBar.setLoading(false);
    }
  }

  friendlyError(err) {
    // O Electron prefixa erros do IPC com "Error invoking remote method"; mostramos só a mensagem útil.
    return String(err.message || err).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  }

  renderSingle(media) {
    this.singleEl.innerHTML = `
      <article class="single-card">
        <div class="single-thumb">
          ${media.thumbnail ? `<img src="${escapeHtml(media.thumbnail)}" alt="" />` : ''}
          ${media.durationFormatted && media.durationFormatted !== '--:--' ? `<span class="duration-pill">${escapeHtml(media.durationFormatted)}</span>` : ''}
        </div>
        <div class="single-body">
          <h2 class="single-title">${escapeHtml(media.title)}</h2>
          <p class="single-author">${escapeHtml(media.uploader)}</p>
          <button type="button" class="btn btn-primary" data-role="download">
            ${ICONS.download}<span>${escapeHtml(this.verb)}</span>
          </button>
        </div>
      </article>`;

    this.singleEl.querySelector('[data-role="download"]').addEventListener('click', () => {
      this.startDownload({
        title: media.title,
        thumbnail: media.thumbnail,
        isPlaylist: false,
        selectedIndices: null
      });
    });
  }

  clearPreview() {
    this.media = null;
    this.singleEl.innerHTML = '';
    this.playlistView.clear();
  }

  reset() {
    this.urlBar.setValue('');
    this.clearPreview();
  }

  // ---- Download ----
  startDownload({ title, thumbnail, isPlaylist, selectedIndices }) {
    const dlBtn = this.singleEl.querySelector('[data-role="download"]');
    if (dlBtn) {
      dlBtn.disabled = true;
      setTimeout(() => { if (dlBtn) dlBtn.disabled = false; }, 2500);
    }

    const state = uiState.getState();
    showToast('Download iniciado! Acompanhe o progresso abaixo.', 'info');

    this.downloads.start({
      title,
      thumbnail,
      options: {
        mode: this.mode,
        url: this.media?.sourceUrl || this.urlBar.getValue(),
        outputDir: state.destinationFolder,
        isPlaylist,
        selectedIndices,
        title,
        thumbnail,
        [this.mode]: structuredClone(uiState.getSettings(this.mode)),
        ...this.extraOptions()
      }
    });
  }

  onShow() {
    this.urlBar.focus();
  }
}

window.ModeView = ModeView;
