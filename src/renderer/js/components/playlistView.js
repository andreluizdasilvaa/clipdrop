// Lista de itens de uma playlist/canal com seleção granular
class PlaylistView {
  constructor(container, { onDownload, downloadLabel }) {
    this.container = container;
    this.onDownload = onDownload;
    this.downloadLabel = downloadLabel || 'Baixar';
    this.playlist = null;
    this.entries = [];
  }

  setPlaylist(playlist) {
    this.playlist = playlist;
    this.entries = (playlist.entries || []).map((entry, i) => ({
      ...entry,
      index: i + 1,
      selected: true
    }));
    this.render();
  }

  clear() {
    this.playlist = null;
    this.entries = [];
    this.container.innerHTML = '';
  }

  selectedIndices() {
    return this.entries.filter((e) => e.selected).map((e) => e.index);
  }

  allSelected() {
    return this.entries.length > 0 && this.entries.every((e) => e.selected);
  }

  render() {
    if (!this.playlist) return;
    const p = this.playlist;

    this.container.innerHTML = `
      <div class="playlist-card">
        <div class="playlist-head">
          <div class="playlist-cover">
            ${p.thumbnail ? `<img src="${escapeHtml(p.thumbnail)}" alt="" />` : ''}
          </div>
          <div class="playlist-info">
            <span class="chip">Playlist</span>
            <h2 class="playlist-title">${escapeHtml(p.title)}</h2>
            <p class="playlist-sub">${escapeHtml(p.uploader)} · <span data-role="count"></span></p>
          </div>
        </div>

        <div class="playlist-toolbar">
          <div class="toolbar-left">
            <button type="button" class="btn btn-ghost btn-sm" data-role="all">Selecionar todos</button>
            <button type="button" class="btn btn-ghost btn-sm" data-role="none">Desmarcar todos</button>
          </div>
          <button type="button" class="btn btn-primary" data-role="download">
            ${ICONS.download}<span data-role="download-label"></span>
          </button>
        </div>

        <div class="playlist-list">
          ${this.entries.map((e) => this.rowHtml(e)).join('')}
        </div>
      </div>`;

    this.container.querySelector('[data-role="all"]').addEventListener('click', () => this.setAll(true));
    this.container.querySelector('[data-role="none"]').addEventListener('click', () => this.setAll(false));
    this.container.querySelector('[data-role="download"]').addEventListener('click', () => this.requestDownload());

    this.container.querySelectorAll('.playlist-row').forEach((row) => {
      const index = Number(row.dataset.index);
      const checkbox = row.querySelector('input');
      const toggle = (checked) => {
        this.entries.find((e) => e.index === index).selected = checked;
        row.classList.toggle('selected', checked);
        checkbox.checked = checked;
        this.refreshSummary();
      };
      checkbox.addEventListener('change', () => toggle(checkbox.checked));
      row.addEventListener('click', (e) => {
        if (e.target !== checkbox) toggle(!checkbox.checked);
      });
    });

    this.refreshSummary();
  }

  rowHtml(e) {
    return `
      <div class="playlist-row selected" data-index="${e.index}">
        <input type="checkbox" checked aria-label="Selecionar ${escapeHtml(e.title)}" />
        <span class="row-num">${e.index}</span>
        <div class="row-thumb">${e.thumbnail ? `<img src="${escapeHtml(e.thumbnail)}" loading="lazy" alt="" />` : ''}</div>
        <div class="row-meta">
          <span class="row-title" title="${escapeHtml(e.title)}">${escapeHtml(e.title)}</span>
          <span class="row-sub">${escapeHtml(e.uploader)}</span>
        </div>
        <span class="row-duration">${escapeHtml(e.durationFormatted)}</span>
      </div>`;
  }

  setAll(selected) {
    this.entries.forEach((e) => { e.selected = selected; });
    this.container.querySelectorAll('.playlist-row').forEach((row) => {
      row.classList.toggle('selected', selected);
      row.querySelector('input').checked = selected;
    });
    this.refreshSummary();
  }

  refreshSummary() {
    const selected = this.selectedIndices().length;
    const total = this.entries.length;
    this.container.querySelector('[data-role="count"]').textContent = `${selected} de ${total} selecionados`;

    const btn = this.container.querySelector('[data-role="download"]');
    btn.disabled = selected === 0;
    this.container.querySelector('[data-role="download-label"]').textContent =
      this.allSelected()
        ? `${this.downloadLabel} playlist inteira (${total})`
        : `${this.downloadLabel} selecionados (${selected})`;
  }

  requestDownload() {
    const selected = this.selectedIndices();
    if (!selected.length) return;

    const dlBtn = this.container.querySelector('[data-role="download"]');
    if (dlBtn) {
      dlBtn.disabled = true;
      setTimeout(() => { if (dlBtn) dlBtn.disabled = false; }, 2500);
    }

    // Playlist inteira = sem -I (null); seleção parcial = lista de índices.
    this.onDownload?.({
      playlist: this.playlist,
      selectedIndices: this.allSelected() ? null : selected,
      count: selected.length
    });
  }
}

window.PlaylistView = PlaylistView;
