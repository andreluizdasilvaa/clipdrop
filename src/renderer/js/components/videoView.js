// Modo 🎬 Vídeo
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

  settingsHtml() {
    const s = uiState.getSettings('video');
    const subs = s.subtitles;
    const sb = s.sponsorblock;
    return `
      <div class="setting-block">
        <span class="setting-title">Qualidade</span>
        ${segmentedHtml('quality', [
          { value: 'best', label: 'Melhor qualidade' },
          { value: '1080', label: '1080p' },
          { value: '720', label: '720p' }
        ], s.quality)}
      </div>
      <div class="setting-divider"></div>
      ${toggleHtml('subtitles.enabled', 'Baixar legendas', subs.enabled)}
      ${subs.enabled ? `
        <div class="setting-block setting-indent">
          <span class="setting-title">Idioma</span>
          ${segmentedHtml('subtitles.lang', [
            { value: 'pt', label: 'Português' },
            { value: 'en', label: 'Inglês' }
          ], subs.lang)}
        </div>` : ''}
      <div class="setting-divider"></div>
      <span class="setting-title">Pular partes chatas</span>
      ${toggleHtml('sponsorblock.sponsor', 'Remover patrocínios', sb.sponsor)}
      ${toggleHtml('sponsorblock.introOutro', 'Remover vinhetas de abertura e encerramento', sb.introOutro)}
      ${toggleHtml('sponsorblock.selfpromo', 'Remover pedidos de inscrição e like', sb.selfpromo)}
      <div class="setting-block setting-indent">
        <span class="setting-title">O que fazer com essas partes</span>
        ${segmentedHtml('sponsorblock.mode', [
          { value: 'remove', label: 'Cortar do vídeo' },
          { value: 'mark', label: 'Só marcar capítulos' }
        ], sb.mode)}
      </div>`;
  }
}

window.VideoView = VideoView;
