// Lista de transferências com progresso em tempo real
class DownloadList {
  constructor(sectionId, listId) {
    this.section = document.getElementById(sectionId);
    this.list = document.getElementById(listId);

    window.clipdropAPI.onDownloadProgress((data) => this.onProgress(data));
    window.clipdropAPI.onDownloadStatus((data) => this.onStatus(data));
  }

  /** Cria o card e dispara o download via IPC. */
  async start({ title, thumbnail, options }) {
    const id = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    this.addCard(id, title, thumbnail);
    uiState.upsertDownload(id, { status: 'starting' });

    try {
      const result = await window.clipdropAPI.downloadMedia({ ...options, id });
      if (!result.success) this.fail(id, result.error || 'Não foi possível iniciar o download.');
    } catch (err) {
      this.fail(id, err.message);
    }
  }

  addCard(id, title, thumbnail) {
    this.section.hidden = false;

    const card = document.createElement('article');
    card.className = 'download-card';
    card.id = `download-${id}`;
    card.innerHTML = `
      <div class="dl-thumb">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" />` : ''}</div>
      <div class="dl-body">
        <div class="dl-head">
          <span class="dl-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
          <span class="dl-percent" data-role="percent">0%</span>
        </div>
        <div class="progress-track"><div class="progress-bar" data-role="bar"></div></div>
        <div class="dl-foot">
          <span class="dl-status" data-role="status">Iniciando…</span>
          <span class="dl-stats" data-role="stats"></span>
        </div>
      </div>
      <button type="button" class="icon-btn" data-role="cancel" title="Cancelar" aria-label="Cancelar download">${ICONS.close}</button>`;

    card.querySelector('[data-role="cancel"]').addEventListener('click', async () => {
      await window.clipdropAPI.cancelDownload(id);
      this.setStatus(id, 'Cancelado');
      card.classList.add('is-cancelled');
      card.querySelector('[data-role="cancel"]').remove();
      uiState.upsertDownload(id, { status: 'cancelled' });
    });

    this.list.prepend(card);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  el(id, role) {
    return document.querySelector(`#download-${id} [data-role="${role}"]`);
  }

  setStatus(id, text) {
    const status = this.el(id, 'status');
    if (status && text) status.textContent = text;
  }

  onProgress({ downloadId, percent, speed, eta, message }) {
    const bar = this.el(downloadId, 'bar');
    if (!bar) return;
    bar.style.width = `${percent}%`;
    this.el(downloadId, 'percent').textContent = `${percent.toFixed(0)}%`;
    this.el(downloadId, 'stats').textContent = `${speed} · restam ${eta}`;
    this.setStatus(downloadId, message);
    uiState.upsertDownload(downloadId, { status: 'downloading', percent });
  }

  onStatus({ downloadId, status, message }) {
    const card = document.getElementById(`download-${downloadId}`);
    if (!card || card.classList.contains('is-cancelled')) return;
    this.setStatus(downloadId, message);

    if (status === 'completed') {
      this.finish(downloadId, 'is-done');
      this.el(downloadId, 'bar').style.width = '100%';
      this.el(downloadId, 'percent').textContent = '100%';
      this.el(downloadId, 'stats').textContent = '';
      showToast('Download concluído!', 'success');
    } else if (status === 'error') {
      this.fail(downloadId, message);
    }
    uiState.upsertDownload(downloadId, { status });
  }

  fail(id, message) {
    const card = document.getElementById(`download-${id}`);
    if (!card || card.classList.contains('is-error') || card.classList.contains('is-cancelled')) return;
    this.setStatus(id, message);
    this.finish(id, 'is-error');
    showToast(message || 'Erro durante o download.', 'error');
  }

  finish(id, cssClass) {
    const card = document.getElementById(`download-${id}`);
    card?.classList.add(cssClass);
    card?.querySelector('[data-role="cancel"]')?.remove();
  }
}

window.DownloadList = DownloadList;
