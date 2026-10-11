// Modo 🎵 Áudio & Música com Seção Básica e Painel Colapsável de Opções Avançadas
class AudioView extends ModeView {
  constructor(container, downloads) {
    super({
      container,
      mode: 'audio',
      badge: 'Áudio & Música',
      title: 'Qual música você quer?',
      subtitle: 'Cole o link de uma música, álbum ou playlist.',
      verb: 'Baixar',
      downloads
    });
    this.accordionOpen = false;
  }

  hasCustomAdvanced() {
    const adv = uiState.getSettings('audio').advanced || {};
    return (
      adv.embedCover === false ||
      adv.embedMetadata === false ||
      Boolean(adv.trim?.enabled) ||
      Boolean(adv.playlistRange) ||
      adv.ignoreExisting === false ||
      adv.concurrentFragments === false
    );
  }

  settingsHtml() {
    const s = uiState.getSettings('audio');
    const adv = s.advanced || {};
    const trim = adv.trim || {};
    const format = s.format || 'mp3';
    const lossless = format === 'flac' || format === 'wav';
    const noCover = format === 'wav';
    const isCustom = this.hasCustomAdvanced();

    return `
      <!-- 1. SEÇÃO BÁSICA -->
      <div class="adv-inputs-group">
        <div class="adv-input-field">
          <label class="adv-field-label" for="audioFormatSelect">Formato de Áudio</label>
          ${selectHtml('format', [
            { value: 'mp3', label: '.mp3 (compatível com tudo)' },
            { value: 'm4a', label: '.m4a (AAC)' },
            { value: 'flac', label: '.flac (sem perdas)' },
            { value: 'wav', label: '.wav (sem compressão)' },
            { value: 'opus', label: '.opus (alta eficiência)' }
          ], format, { id: 'audioFormatSelect' })}
        </div>
        <div class="adv-input-field">
          <label class="adv-field-label" for="audioQualitySelect">Qualidade / Bitrate</label>
          ${selectHtml('quality', [
            { value: '0', label: 'Melhor qualidade (VBR)' },
            { value: '320', label: '320 kbps' },
            { value: '256', label: '256 kbps' },
            { value: '192', label: '192 kbps' }
          ], s.quality || '0', { id: 'audioQualitySelect', disabled: lossless })}
        </div>
      </div>
      ${lossless ? '<span class="adv-help-text">Formatos sem perdas não usam bitrate: a qualidade original é preservada.</span>' : ''}

      <div class="setting-divider"></div>

      <!-- 2. PAINEL DE OPÇÕES AVANÇADAS (Accordion) -->
      <div class="advanced-accordion">
        <button type="button" class="accordion-trigger ${this.accordionOpen ? 'open' : ''}" data-role="accordion-trigger" aria-expanded="${this.accordionOpen}">
          <div class="accordion-trigger-left">
            <span class="accordion-icon">${ICONS.settings}</span>
            <div class="accordion-trigger-text">
              <span class="accordion-title">Opções Avançadas</span>
              <span class="accordion-hint">Capa e tags, corte de trecho e gerenciamento de playlists</span>
            </div>
          </div>
          <div class="accordion-trigger-right">
            ${isCustom ? '<span class="chip chip-solid chip-sm">Personalizado</span>' : ''}
            <span class="accordion-chevron ${this.accordionOpen ? 'open' : ''}">${ICONS.chevronDown}</span>
          </div>
        </button>

        <div class="accordion-panel ${this.accordionOpen ? 'open' : ''}">
          <div class="accordion-inner">

            <section class="adv-card">
              <h3 class="adv-card-title">Metadados e Capa</h3>
              ${toggleHtml(
                'advanced.embedCover',
                'Embutir Capa de Álbum',
                adv.embedCover !== false && !noCover,
                noCover ? 'O formato WAV não suporta capa embutida' : 'Converte a miniatura da faixa em capa oficial do arquivo'
              )}
              <div class="setting-divider-sub"></div>
              ${toggleHtml(
                'advanced.embedMetadata',
                'Metadados nas Tags',
                adv.embedMetadata !== false,
                'Salva título, artista e demais informações nas tags do arquivo'
              )}
            </section>

            <section class="adv-card">
              <h3 class="adv-card-title">Corte de Trecho (Trim)</h3>
              ${toggleHtml(
                'advanced.trim.enabled',
                'Extrair Apenas um Trecho',
                Boolean(trim.enabled),
                'Baixa somente o intervalo de tempo escolhido da faixa'
              )}
              ${trim.enabled ? `
                <div class="setting-indent adv-inputs-group">
                  <div class="adv-input-field">
                    <label class="adv-field-label" for="audioTrimStartInput">Início</label>
                    <input type="text" id="audioTrimStartInput" class="adv-input" data-setting="advanced.trim.start"
                           placeholder="00:00:00" value="${escapeHtml(trim.start || '')}" autocomplete="off" spellcheck="false" />
                  </div>
                  <div class="adv-input-field">
                    <label class="adv-field-label" for="audioTrimEndInput">Fim</label>
                    <input type="text" id="audioTrimEndInput" class="adv-input" data-setting="advanced.trim.end"
                           placeholder="00:00:00" value="${escapeHtml(trim.end || '')}" autocomplete="off" spellcheck="false" />
                  </div>
                </div>
                <span class="adv-help-text">Formato HH:MM:SS ou MM:SS. Deixe em branco para usar o início ou o fim da faixa.</span>
              ` : ''}
            </section>

            <section class="adv-card">
              <h3 class="adv-card-title">Playlists e Álbuns</h3>
              <div class="adv-input-field">
                <label class="adv-field-label" for="audioPlaylistRangeInput">Intervalo da Playlist</label>
                <input type="text" id="audioPlaylistRangeInput" class="adv-input" data-setting="advanced.playlistRange"
                       placeholder="Ex: 1-15 ou 1,3,5 (vazio = todas)" value="${escapeHtml(adv.playlistRange || '')}" autocomplete="off" spellcheck="false" />
                <span class="adv-help-text">Define quais faixas serão baixadas. Vale para a playlist inteira (sem seleção manual).</span>
              </div>
              <div class="setting-divider-sub"></div>
              ${toggleHtml(
                'advanced.ignoreExisting',
                'Ignorar faixas já baixadas',
                adv.ignoreExisting !== false,
                'Registra os IDs num histórico local (.archive-audio.txt) para evitar duplicatas ao atualizar playlists'
              )}
              <div class="setting-divider-sub"></div>
              ${toggleHtml(
                'advanced.concurrentFragments',
                'Downloads Paralelos de Fragmentos (Multi-threading)',
                adv.concurrentFragments !== false,
                'Baixa múltiplos fragmentos concorrentemente (-N 4) acelerando downloads de alta velocidade'
              )}
            </section>

          </div>
        </div>
      </div>`;
  }

  bindSettings() {
    super.bindSettings();

    // Expansão/recolhimento do Accordion
    this.settingsEl.addEventListener('click', (e) => {
      const trigger = e.target.closest('[data-role="accordion-trigger"]');
      if (!trigger) return;
      this.accordionOpen = !this.accordionOpen;
      const panel = this.settingsEl.querySelector('.accordion-panel');
      const chevron = this.settingsEl.querySelector('.accordion-chevron');
      trigger.setAttribute('aria-expanded', this.accordionOpen);
      trigger.classList.toggle('open', this.accordionOpen);
      if (panel) panel.classList.toggle('open', this.accordionOpen);
      if (chevron) chevron.classList.toggle('open', this.accordionOpen);
    });

    // Campos de texto: atualização silenciosa para não perder o foco
    this.settingsEl.addEventListener('input', (e) => {
      const input = e.target.closest('input[data-setting]');
      if (!input) return;
      uiState.setSetting(this.mode, input.dataset.setting, input.value, true);
    });

    this.settingsEl.addEventListener('change', (e) => {
      const input = e.target.closest('input[data-setting]');
      if (input) {
        uiState.setSetting(this.mode, input.dataset.setting, input.value);
        return;
      }
      const select = e.target.closest('select[data-select]');
      if (select) {
        uiState.setSetting(this.mode, select.dataset.select, select.value);
        this.renderSettings();
      }
    });
  }
}

window.AudioView = AudioView;
