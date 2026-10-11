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
  }

  hasCustomAdvanced() {
    const s = uiState.getSettings('video');
    const adv = s.advanced || {};
    const subs = s.subtitles || {};
    return (
      this.hasCommonCustomAdvanced(adv) ||
      (adv.container && adv.container !== 'mp4') ||
      Boolean(adv.videoOnly) ||
      Boolean(adv.recodeVideo) ||
      adv.embedChapters === false ||
      Boolean(adv.embedThumbnail) ||
      Boolean(adv.cautiousMode) ||
      (Boolean(subs.enabled) && (
        (subs.type && subs.type !== 'official') ||
        (subs.method && subs.method !== 'softsub')
      ))
    );
  }

  settingsHtml() {
    const s = uiState.getSettings('video');
    const subs = s.subtitles || {};
    const adv = s.advanced || {};
    const trim = adv.trim || {};
    const isCustom = this.hasCustomAdvanced();

    const basicSection = `
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

      <div class="setting-divider"></div>`;

    const advancedContent = `
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

      ${subs.enabled ? `
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
      </section>` : ''}

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
      ${trimCardHtml({
        trim,
        prefix: 'advanced.trim',
        title: 'Corte por Intervalo de Tempo (Trim)',
        toggleLabel: 'Baixar Apenas um Trecho Específico',
        toggleHint: 'Recorta e faz o download de um intervalo de tempo determinado'
      })}

      <!-- Card E: Gerenciamento de Lotes e Desempenho -->
      <section class="adv-card">
        <h3 class="adv-card-title">Gerenciamento de Lotes e Desempenho</h3>

        ${playlistRangeFieldHtml({
          range: adv.playlistRange,
          settingPath: 'advanced.playlistRange',
          label: 'Intervalo da Playlist / Canal',
          placeholder: 'Ex: 1-10 ou 1,3,5 (vazio = todos)',
          hint: 'Define quais itens da lista serão baixados. Útil para canais ou playlists longas.'
        })}

        <div class="setting-divider-sub"></div>

        ${toggleHtml(
          'advanced.concurrentFragments',
          'Downloads Paralelos de Fragmentos (Multi-threading)',
          adv.concurrentFragments !== false,
          'Baixa múltiplos fragmentos concorrentemente (-N 4) acelerando downloads de alta velocidade'
        )}

        <div class="setting-divider-sub"></div>

        ${toggleHtml(
          'advanced.cautiousMode',
          'Modo Cauteloso (Pausas entre downloads)',
          Boolean(adv.cautiousMode),
          'Adiciona pequenas pausas aleatórias para contornar bloqueios por excesso de requisições (Útil para centenas de vídeos)'
        )}
      </section>`;

    return basicSection + accordionHtml({
      title: 'Opções Avançadas',
      hint: 'Formatos, codecs, legendas avançadas, corte e desempenho',
      isCustom,
      isOpen: this.accordionOpen,
      content: advancedContent
    });
  }
}

window.VideoView = VideoView;
