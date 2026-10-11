// Componente de Splash Screen / Verificação de Dependências
class SplashScreen {
  constructor(containerId, onReadyCallback) {
    this.container = document.getElementById(containerId);
    this.onReadyCallback = onReadyCallback;
    this.dependencies = {
      ytdlp: { label: 'Motor de download (yt-dlp)', status: 'checking', message: 'Aguardando verificação...' },
      ffmpeg: { label: 'Conversor de mídia (ffmpeg)', status: 'checking', message: 'Aguardando verificação...' },
      ffprobe: { label: 'Analisador de mídia (ffprobe)', status: 'checking', message: 'Aguardando verificação...' }
    };
  }

  init() {
    this.render();
    this.startVerification();
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="splash-card">
        <div class="splash-brand" style="flex-direction: column; align-items: flex-start; gap: 8px;">
          <div class="brand" style="gap: 12px;">
            <img src="assets/logos/logo_sem_fundo_sem_texto.png" alt="ClipDrop" height="40" style="object-fit: contain;">
            <span class="brand-name" style="font-size: 1.85rem; font-weight: 800; letter-spacing: -0.03em;">ClipDrop</span>
          </div>
          <p class="splash-subtitle">Preparando ambiente de alta velocidade...</p>
        </div>

        <div class="splash-checklist">
          ${this.renderChecklistItem('ytdlp', this.dependencies.ytdlp)}
          ${this.renderChecklistItem('ffmpeg', this.dependencies.ffmpeg)}
          ${this.renderChecklistItem('ffprobe', this.dependencies.ffprobe)}
        </div>

        <div class="splash-footer" id="splashFooter">
          <div class="splash-progress-track">
            <div class="splash-progress-bar" id="splashGlobalProgress" style="width: 15%"></div>
          </div>
          <p class="splash-hint" id="splashStatusText">Verificando ferramentas e permissões de sistema...</p>
        </div>

        <div class="splash-error-action" id="splashErrorBox" style="display: none;">
          <p class="splash-error-text" id="splashErrorMessage"></p>
          <button class="btn btn-primary" id="splashRetryBtn">Tentar Novamente</button>
        </div>
      </div>
    `;

    const retryBtn = document.getElementById('splashRetryBtn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        document.getElementById('splashErrorBox').style.display = 'none';
        document.getElementById('splashFooter').style.display = 'block';
        this.startVerification();
      });
    }
  }

  getStatusBadgeHtml(status) {
    if (status === 'ready') {
      return `
        <span class="status-badge success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </span>
      `;
    }
    if (status === 'error') {
      return `
        <span class="status-badge error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </span>
      `;
    }
    return '<div class="spinner-circle"></div>';
  }

  renderChecklistItem(key, item) {
    const iconHtml = this.getStatusBadgeHtml(item.status);

    return `
      <div class="checklist-item" id="item-${key}">
        <div class="checklist-left">
          <div class="checklist-icon" id="icon-${key}">${iconHtml}</div>
          <div class="checklist-info">
            <span class="checklist-label">${item.label}</span>
            <span class="checklist-status" id="status-${key}">${item.message}</span>
          </div>
        </div>
        <div class="checklist-progress-text" id="pct-${key}">${item.percent !== undefined ? item.percent + '%' : ''}</div>
      </div>
    `;
  }

  updateItemUI(key, state) {
    const item = this.dependencies[key];
    if (!item) return;

    Object.assign(item, state);

    const statusEl = document.getElementById(`status-${key}`);
    const pctEl = document.getElementById(`pct-${key}`);
    const iconEl = document.getElementById(`icon-${key}`);
    const itemRow = document.getElementById(`item-${key}`);

    if (statusEl) statusEl.textContent = item.message || '';
    if (pctEl) pctEl.textContent = item.percent !== undefined && item.status === 'downloading' ? `${item.percent}%` : '';

    if (iconEl) {
      iconEl.innerHTML = this.getStatusBadgeHtml(item.status);
      if (itemRow) {
        itemRow.classList.toggle('item-ready', item.status === 'ready');
        itemRow.classList.toggle('item-error', item.status === 'error');
      }
    }

    this.updateGlobalProgress();
  }

  updateGlobalProgress() {
    const keys = Object.keys(this.dependencies);
    const readyCount = keys.filter(k => this.dependencies[k].status === 'ready').length;
    const progressEl = document.getElementById('splashGlobalProgress');
    const statusTextEl = document.getElementById('splashStatusText');

    let basePercent = (readyCount / keys.length) * 100;
    if (progressEl) {
      progressEl.style.width = `${Math.max(15, basePercent)}%`;
    }

    if (readyCount === keys.length) {
      if (statusTextEl) statusTextEl.textContent = 'Ambiente pronto! Carregando aplicativo...';
    } else {
      if (statusTextEl) statusTextEl.textContent = 'Configurando dependências essenciais (zero configuração)...';
    }
  }

  async startVerification() {
    if (!window.clipdropAPI) {
      console.warn('clipdropAPI não disponível no ambiente');
      return;
    }

    // Ouvinte de progresso de downloads dos binários
    const unsubscribe = window.clipdropAPI.onDependencyProgress((update) => {
      if (update && update.key) {
        this.updateItemUI(update.key, update.state);
      }
    });

    try {
      const result = await window.clipdropAPI.startDependencySetup();
      if (result.success) {
        // Marca todos como prontos
        for (const k of ['ytdlp', 'ffmpeg', 'ffprobe']) {
          this.updateItemUI(k, { status: 'ready', message: 'Pronto para uso' });
        }
        this.updateGlobalProgress();

        // Transição suave para a tela principal
        setTimeout(() => {
          this.finish();
          if (unsubscribe) unsubscribe();
        }, 700);
      } else {
        this.showError(result.error || 'Não foi possível baixar os componentes necessários.');
      }
    } catch (err) {
      this.showError(err.message || 'Erro de conexão ou sistema.');
    }
  }

  showError(message) {
    const errorBox = document.getElementById('splashErrorBox');
    const errorMsg = document.getElementById('splashErrorMessage');
    const footer = document.getElementById('splashFooter');

    if (errorBox) errorBox.style.display = 'block';
    if (errorMsg) errorMsg.textContent = message;
    if (footer) footer.style.display = 'none';
  }

  finish() {
    if (this.container) {
      this.container.classList.add('splash-fade-out');
      setTimeout(() => {
        this.container.style.display = 'none';
        if (this.onReadyCallback) {
          this.onReadyCallback();
        }
      }, 500);
    }
  }
}

window.SplashScreen = SplashScreen;
