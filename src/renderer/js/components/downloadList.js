// Lista de transferências com progresso em tempo real e gerenciamento de histórico
class DownloadList {
  constructor(sectionId, listId) {
    this.section = document.getElementById(sectionId);
    this.list = document.getElementById(listId);
    this.clearBtn = document.getElementById('clearDownloadsBtn');
    this.moreBar = document.getElementById('downloadsMoreBar');
    this.moreBtn = document.getElementById('toggleMoreDownloadsBtn');
    this.isExpanded = false;

    if (this.clearBtn) {
      this.clearBtn.addEventListener('click', () => this.clearFinished());
    }

    if (this.moreBtn) {
      this.moreBtn.addEventListener('click', () => this.toggleExpand());
    }

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
      this.finish(id, 'is-cancelled');
      uiState.upsertDownload(id, { status: 'cancelled' });
    });

    this.list.prepend(card);
    this.updateVisibility();
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  addRemoveButton(card) {
    if (card.querySelector('[data-role="remove"]')) return;
    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'icon-btn';
    removeBtn.setAttribute('data-role', 'remove');
    removeBtn.title = 'Remover da lista';
    removeBtn.setAttribute('aria-label', 'Remover da lista');
    removeBtn.innerHTML = ICONS.close;
    removeBtn.addEventListener('click', () => {
      card.remove();
      this.updateVisibility();
    });
    card.appendChild(removeBtn);
  }

  clearFinished() {
    const finishedCards = this.list.querySelectorAll('.download-card.is-done, .download-card.is-error, .download-card.is-cancelled');
    if (finishedCards.length === 0) return;
    finishedCards.forEach((c) => c.remove());
    this.updateVisibility();
    showToast('Downloads finalizados removidos.', 'info');
  }

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
    this.updateVisibility();
  }

  updateVisibility() {
    const cards = Array.from(this.list.children);
    const total = cards.length;

    if (total === 0) {
      this.section.hidden = true;
      if (this.moreBar) this.moreBar.style.display = 'none';
      if (this.clearBtn) this.clearBtn.style.display = 'none';
      return;
    }

    this.section.hidden = false;

    // Exibe botão de limpar se houver pelo menos um download finalizado
    const hasFinished = cards.some((c) =>
      c.classList.contains('is-done') || c.classList.contains('is-error') || c.classList.contains('is-cancelled')
    );
    if (this.clearBtn) {
      this.clearBtn.style.display = hasFinished ? 'inline-flex' : 'none';
    }

    // Regra de mais de 5 itens
    if (total > 5) {
      if (this.isExpanded) {
        cards.forEach((c) => (c.style.display = ''));
        if (this.moreBar) this.moreBar.style.display = 'flex';
        if (this.moreBtn) this.moreBtn.textContent = 'Ver menos';
      } else {
        cards.forEach((c, idx) => {
          c.style.display = idx < 5 ? '' : 'none';
        });
        if (this.moreBar) this.moreBar.style.display = 'flex';
        const hiddenCount = total - 5;
        if (this.moreBtn) this.moreBtn.textContent = `Ver mais (${hiddenCount})`;
      }
    } else {
      cards.forEach((c) => (c.style.display = ''));
      if (this.moreBar) this.moreBar.style.display = 'none';
    }
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
    const speedText = speed && speed !== '--' && speed !== 'NA' && speed !== 'Unknown' ? speed : '';
    const etaText = eta && eta !== '--' && eta !== 'NA' ? `restam ${eta}` : '';
    const statsText = [speedText, etaText].filter(Boolean).join(' · ');
    this.el(downloadId, 'stats').textContent = statsText;
    if (message) this.setStatus(downloadId, message);
    uiState.upsertDownload(downloadId, { status: 'downloading', percent });
  }

  onStatus({ downloadId, status, message, percent }) {
    const card = document.getElementById(`download-${downloadId}`);
    if (!card || card.classList.contains('is-cancelled')) return;
    if (message) this.setStatus(downloadId, message);

    if (typeof percent === 'number') {
      const bar = this.el(downloadId, 'bar');
      if (bar) bar.style.width = `${percent}%`;
      const pctEl = this.el(downloadId, 'percent');
      if (pctEl) pctEl.textContent = `${percent.toFixed(0)}%`;
    }

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
    this.updateVisibility();
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
    if (!card) return;
    card.classList.add(cssClass);
    card.querySelector('[data-role="cancel"]')?.remove();
    this.addRemoveButton(card);
    this.updateVisibility();
  }
}

window.DownloadList = DownloadList;
