// Barra de URL compartilhada pelos modos Áudio e Vídeo
class UrlBar {
  constructor(container, { onSubmit, onClear }) {
    this.container = container;
    this.onSubmit = onSubmit;
    this.onClear = onClear;
    this.loading = false;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="url-box">
        <button type="button" class="url-paste" data-role="paste" title="Colar da área de transferência">
          ${ICONS.paste}<span>Colar</span>
        </button>
        <input type="text" class="url-field" data-role="input"
               placeholder="Cole o link aqui" autocomplete="off" spellcheck="false"
               aria-label="Link do vídeo, música ou playlist" />
        <button type="button" class="url-clear" data-role="clear" title="Limpar" hidden>${ICONS.close}</button>
        <button type="button" class="btn btn-primary url-go" data-role="go">
          <span class="btn-spinner" hidden></span>
          <span class="url-go-icon">${ICONS.search}</span>
          <span>Analisar</span>
        </button>
      </div>`;

    this.input = this.container.querySelector('[data-role="input"]');
    this.clearBtn = this.container.querySelector('[data-role="clear"]');
    this.goBtn = this.container.querySelector('[data-role="go"]');
    this.spinner = this.container.querySelector('.btn-spinner');
    this.goIcon = this.container.querySelector('.url-go-icon');

    this.input.addEventListener('input', () => {
      this.clearBtn.hidden = !this.input.value.trim();
      if (!this.input.value.trim()) this.onClear?.();
    });

    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.submit();
    });

    // Detecção de link colado: analisa na hora, sem precisar clicar em "Analisar".
    this.input.addEventListener('paste', (event) => {
      const text = (event.clipboardData?.getData('text') || '').trim();
      if (isHttpUrl(text)) {
        event.preventDefault();
        this.setValue(text);
        this.submit();
      }
    });

    this.clearBtn.addEventListener('click', () => {
      this.setValue('');
      this.onClear?.();
      this.input.focus();
    });

    this.goBtn.addEventListener('click', () => this.submit());

    this.container.querySelector('[data-role="paste"]').addEventListener('click', async () => {
      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (!text) return;
        this.setValue(text);
        this.submit();
      } catch (_) {
        showToast('Não foi possível acessar a área de transferência. Cole com Ctrl+V.', 'error');
      }
    });
  }

  getValue() {
    return this.input.value.trim();
  }

  setValue(value) {
    this.input.value = value;
    this.clearBtn.hidden = !value;
  }

  focus() {
    this.input.focus();
  }

  setLoading(loading) {
    this.loading = loading;
    this.goBtn.disabled = loading;
    this.spinner.hidden = !loading;
    this.goIcon.hidden = loading;
  }

  submit() {
    const url = this.getValue();
    if (!url || this.loading) return;
    if (!isHttpUrl(url)) {
      showToast('Esse link não parece válido. Ele deve começar com https://', 'error');
      return;
    }
    this.onSubmit?.(url);
  }
}

window.UrlBar = UrlBar;
