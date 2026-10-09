// Modo 🎵 Áudio & Música
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

  settingsHtml() {
    const s = uiState.getSettings('audio');
    return `
      <div class="setting-block">
        <span class="setting-title">Formato</span>
        ${segmentedHtml('format', [
          { value: 'mp3', label: 'MP3' },
          { value: 'flac', label: 'FLAC (sem perdas)' }
        ], s.format)}
      </div>
      <div class="setting-divider"></div>
      ${toggleHtml('embedCover', 'Embutir capa da música no arquivo', s.embedCover)}
      ${toggleHtml('embedMetadata', 'Preencher nome do artista e data', s.embedMetadata, 'Tags organizadas para pendrive e celular')}
      <div class="setting-divider"></div>
      ${toggleHtml('sponsorblock', 'Remover vinhetas e propagandas faladas', s.sponsorblock)}`;
  }
}

window.AudioView = AudioView;
