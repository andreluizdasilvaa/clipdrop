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
  }

  hasCustomAdvanced() {
    const adv = uiState.getSettings('audio').advanced || {};
    return this.hasCommonCustomAdvanced(adv) || adv.embedCover === false;
  }

  settingsHtml() {
    const s = uiState.getSettings('audio');
    const adv = s.advanced || {};
    const trim = adv.trim || {};
    const format = s.format || 'mp3';
    const lossless = format === 'flac' || format === 'wav';
    const noCover = format === 'wav';
    const isCustom = this.hasCustomAdvanced();

    const basicSection = `
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
      <div class="setting-divider"></div>`;

    const advancedContent = `
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

      ${trimCardHtml({
        trim,
        prefix: 'advanced.trim',
        title: 'Corte de Trecho (Trim)',
        toggleLabel: 'Extrair Apenas um Trecho',
        toggleHint: 'Baixa somente o intervalo de tempo escolhido da faixa'
      })}

      <section class="adv-card">
        <h3 class="adv-card-title">Playlists e Álbuns</h3>
        ${playlistRangeFieldHtml({
          range: adv.playlistRange,
          settingPath: 'advanced.playlistRange',
          label: 'Intervalo da Playlist',
          placeholder: 'Ex: 1-15 ou 1,3,5 (vazio = todas)',
          hint: 'Define quais faixas serão baixadas. Vale para a playlist inteira (sem seleção manual).'
        })}
        <div class="setting-divider-sub"></div>
        ${toggleHtml(
          'advanced.concurrentFragments',
          'Downloads Paralelos de Fragmentos (Multi-threading)',
          adv.concurrentFragments !== false,
          'Baixa múltiplos fragmentos concorrentemente (-N 4) acelerando downloads de alta velocidade'
        )}
      </section>`;

    return basicSection + accordionHtml({
      title: 'Opções Avançadas',
      hint: 'Capa e tags, corte de trecho e gerenciamento de playlists',
      isCustom,
      isOpen: this.accordionOpen,
      content: advancedContent
    });
  }
}

window.AudioView = AudioView;
