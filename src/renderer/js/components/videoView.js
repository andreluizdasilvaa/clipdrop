// Modo 🎬 Vídeo com Seção Básica e Painel Colapsável de Opções Avançadas
class VideoView extends ModeView {
  constructor(container, downloads) {
    super({
      container,
      mode: 'video',
      badge: 'Vídeo',
      title: 'Qual vídeo você quer?',
      subtitle: 'Cole o link de um vídeo ou de uma coleção completa.',
      verb: 'Baixar',
      downloads
    });
    this.accordionOpen = false;
  }

  hasCustomAdvanced() {
    const s = uiState.getSettings('video');
    const adv = s.advanced || {};
    const subs = s.subtitles || {};
    return (
      (adv.container && adv.container !== 'mp4') ||
      Boolean(adv.videoOnly) ||
      Boolean(adv.recodeVideo) ||
      adv.embedChapters === false ||
      Boolean(adv.embedThumbnail) ||
      adv.embedMetadata === false ||
      Boolean(adv.trim?.enabled) ||
      Boolean(adv.playlistRange) ||
      adv.ignoreExisting === false ||
      Boolean(adv.concurrentFragments) ||
      Boolean(adv.cautiousMode) ||
      (subs.type && subs.type !== 'official') ||
      (subs.method && subs.method !== 'softsub')
    );
  }

  settingsHtml() {
    const s = uiState.getSettings('video');
    const subs = s.subtitles || {};
    const adv = s.advanced || {};
    const trim = adv.trim || {};
    const isCustom = this.hasCustomAdvanced();

    return `
      <!-- 1. SEÇÃO BÁSICA (Visível inicialmente) -->
      <div class="setting-block">
        <span class="setting-title">Qualidade Principal</span>
        ${segmentedHtml('quality', [
          { value: 'best', label: 'Melhor qualidade' },
          { value: '1080', label: '1080p' },
          { value: '720', label: '720p' },
          { value: '480', label: '480p' }
        ], s.quality)}
      </div>

      <div class="setting-divider"></div>

      ${toggleHtml('subtitles.enabled', 'Baixar legendas', subs.enabled, 'Salva faixas de legendas disponíveis para este vídeo')}

      ${subs.enabled ? `
        <div class="setting-block setting-indent">
          <span class="setting-title">Idioma Principal</span>
          ${segmentedHtml('subtitles.lang', [
            { value: 'pt', label: 'Português' },
            { value: 'en', label: 'Inglês' },
            { value: 'es', label: 'Espanhol' },
            { value: 'all', label: 'Todos os idiomas' }
          ], subs.lang || 'pt')}
        </div>` : ''}

      <div class="setting-divider"></div>

      <!-- 2. PAINEL DE OPÇÕES AVANÇADAS (Accordion / Colapsável) -->
      <div class="advanced-accordion">
        <button type="button" class="accordion-trigger ${this.accordionOpen ? 'open' : ''}" data-role="accordion-trigger" aria-expanded="${this.accordionOpen}">
          <div class="accordion-trigger-left">
            <span class="accordion-icon">${ICONS.settings}</span>
            <div class="accordion-trigger-text">
              <span class="accordion-title">Opções Avançadas</span>
              <span class="accordion-hint">Formatos, codecs, legendas avançadas, corte e desempenho</span>
            </div>
          </div>
          <div class="accordion-trigger-right">
            ${isCustom ? '<span class="chip chip-solid chip-sm">Personalizado</span>' : ''}
            <span class="accordion-chevron ${this.accordionOpen ? 'open' : ''}">${ICONS.chevronDown}</span>
          </div>
        </button>

        <div class="accordion-panel ${this.accordionOpen ? 'open' : ''}">
          <div class="accordion-inner">

            <!-- Card A: Formatos e Codecs de Vídeo -->
            <section class="adv-card">
              <h3 class="adv-card-title">Formatos e Codecs de Vídeo</h3>

              <div class="setting-block">
                <span class="setting-title">Contêiner de Saída</span>
                ${segmentedHtml('advanced.container', [
                  { value: 'mp4', label: '.mp4' },
                  { value: 'mkv', label: '.mkv' },
                  { value: 'webm', label: '.webm' },
                  { value: 'mov', label: '.mov' }
                ], adv.container || 'mp4')}
              </div>

              <div class="setting-divider-sub"></div>

              ${toggleHtml(
                'advanced.videoOnly',
                'Apenas Vídeo (Sem Áudio)',
                Boolean(adv.videoOnly),
                'Descarta a faixa sonora e baixa exclusivamente o fluxo de vídeo'
              )}

              <div class="setting-divider-sub"></div>

              ${toggleHtml(
                'advanced.recodeVideo',
                'Forçar Recodificação do Vídeo',
                Boolean(adv.recodeVideo),
                'Reencoda o vídeo para o formato selecionado caso o original seja incompatível'
              )}
            </section>

            <!-- Card B: Legendas Avançadas -->
            <section class="adv-card">
              <h3 class="adv-card-title">Legendas Avançadas</h3>

              <div class="setting-block">
                <span class="setting-title">Tipo de Legenda</span>
                ${segmentedHtml('subtitles.type', [
                  { value: 'official', label: 'Oficiais (Manuais)' },
                  { value: 'auto', label: 'Geradas por IA (Auto)' },
                  { value: 'both', label: 'Ambas (Oficial + IA)' }
                ], subs.type || 'official')}
              </div>

              <div class="setting-divider-sub"></div>

              <div class="setting-block">
                <span class="setting-title">Método de Inserção</span>
                ${segmentedHtml('subtitles.method', [
                  { value: 'softsub', label: 'Softsub (No Arquivo)' },
                  { value: 'separate', label: 'Arquivo Separado (.srt)' },
                  { value: 'hardsub', label: 'Hardsub (Queimado)' }
                ], subs.method || 'softsub')}
                <span class="adv-help-text">
                  ${(subs.method || 'softsub') === 'softsub'
                    ? 'Legenda embutida no contêiner do vídeo (ative ou desative a qualquer momento no player).'
                    : (subs.method === 'separate'
                      ? 'Salva um arquivo .srt avulso ao lado do vídeo na pasta de destino.'
                      : 'Reencoda o vídeo queimando as legendas diretamente nos pixels da imagem.')}
                </span>
              </div>
            </section>

            <!-- Card C: Capítulos e Metadados -->
            <section class="adv-card">
              <h3 class="adv-card-title">Capítulos e Metadados</h3>

              ${toggleHtml(
                'advanced.embedChapters',
                'Incrustar Capítulos',
                adv.embedChapters !== false,
                'Lê os marcadores de tempo da descrição e cria capítulos na barra do player'
              )}

              <div class="setting-divider-sub"></div>

              ${toggleHtml(
                'advanced.embedThumbnail',
                'Embutir Miniatura (Thumbnail) como Capa',
                Boolean(adv.embedThumbnail),
                'Grava a imagem oficial de capa dentro do arquivo final de vídeo'
              )}

              <div class="setting-divider-sub"></div>

              ${toggleHtml(
                'advanced.embedMetadata',
                'Salvar Metadados nas Tags',
                adv.embedMetadata !== false,
                'Incorpora título, autor, descrição e data de publicação nos metadados'
              )}
            </section>

            <!-- Card D: Corte por Intervalo de Tempo (Trim) -->
            <section class="adv-card">
              <h3 class="adv-card-title">Corte por Intervalo de Tempo (Trim)</h3>

              ${toggleHtml(
                'advanced.trim.enabled',
                'Baixar Apenas um Trecho Específico',
                Boolean(trim.enabled),
                'Recorta e faz o download de um intervalo de tempo determinado'
              )}

              ${trim.enabled ? `
                <div class="setting-indent adv-inputs-group">
                  <div class="adv-input-field">
                    <label class="adv-field-label" for="trimStartInput">Ponto Inicial</label>
                    <input type="text" id="trimStartInput" class="adv-input" data-setting="advanced.trim.start"
                           placeholder="00:00:00" value="${escapeHtml(trim.start || '')}" autocomplete="off" spellcheck="false" />
                  </div>
                  <div class="adv-input-field">
                    <label class="adv-field-label" for="trimEndInput">Ponto Final</label>
                    <input type="text" id="trimEndInput" class="adv-input" data-setting="advanced.trim.end"
                           placeholder="00:00:00" value="${escapeHtml(trim.end || '')}" autocomplete="off" spellcheck="false" />
                  </div>
                </div>
                <span class="adv-help-text">Formato HH:MM:SS ou MM:SS. Deixe um campo em branco para usar o início (0) ou o fim do vídeo.</span>
              ` : ''}
            </section>

            <!-- Card E: Gerenciamento de Lotes e Desempenho -->
            <section class="adv-card">
              <h3 class="adv-card-title">Gerenciamento de Lotes e Desempenho</h3>

              <div class="adv-input-field">
                <label class="adv-field-label" for="playlistRangeInput">Intervalo da Playlist / Canal</label>
                <input type="text" id="playlistRangeInput" class="adv-input" data-setting="advanced.playlistRange"
                       placeholder="Ex: 1-10 ou 1,3,5 (vazio = todos)" value="${escapeHtml(adv.playlistRange || '')}" autocomplete="off" spellcheck="false" />
                <span class="adv-help-text">Define quais itens da lista serão baixados. Útil para canais ou playlists longas.</span>
              </div>

              <div class="setting-divider-sub"></div>

              ${toggleHtml(
                'advanced.ignoreExisting',
                'Ignorar Vídeos Já Baixados Anteriormente',
                adv.ignoreExisting !== false,
                'Mantém um registro de controle (.archive.txt) para pular vídeos já salvos e evitar duplicatas'
              )}

              <div class="setting-divider-sub"></div>

              ${toggleHtml(
                'advanced.concurrentFragments',
                'Downloads Paralelos de Fragmentos (Multi-threading)',
                Boolean(adv.concurrentFragments),
                'Baixa múltiplos fragmentos concorrentemente (-N 4) acelerando downloads de alta velocidade'
              )}

              <div class="setting-divider-sub"></div>

              ${toggleHtml(
                'advanced.cautiousMode',
                'Modo Cauteloso (Pausas entre downloads)',
                Boolean(adv.cautiousMode),
                'Adiciona pequenas pausas aleatórias para contornar bloqueios por excesso de requisições (Útil para centenas de vídeos)'
              )}
            </section>

          </div>
        </div>
      </div>`;
  }

  bindSettings() {
    super.bindSettings();

    // Controle de expansão/recolhimento do Accordion
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

    // Campos de texto: atualização silenciosa em tempo real para não perder foco
    this.settingsEl.addEventListener('input', (e) => {
      const input = e.target.closest('input[data-setting]');
      if (!input) return;
      uiState.setSetting(this.mode, input.dataset.setting, input.value, true);
    });

    this.settingsEl.addEventListener('change', (e) => {
      const input = e.target.closest('input[data-setting]');
      if (!input) return;
      uiState.setSetting(this.mode, input.dataset.setting, input.value);
    });
  }
}

window.VideoView = VideoView;

