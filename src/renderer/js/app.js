// ClipDrop - inicialização e roteador de telas
document.addEventListener('DOMContentLoaded', async () => {
  const downloads = new DownloadList('downloadsSection', 'downloadsList');

  const views = {
    home: new HomeView(document.getElementById('homeView')),
    audio: new AudioView(document.getElementById('audioView'), downloads),
    video: new VideoView(document.getElementById('videoView'), downloads)
  };

  // Roteador: mostra só a tela do estado atual.
  let lastView = null;
  function renderRoute(state) {
    if (state.view === lastView) return;
    lastView = state.view;

    document.body.dataset.view = state.view;
    for (const [name, view] of Object.entries(views)) {
      const el = document.getElementById(`${name}View`);
      el.hidden = name !== state.view;
      if (name === state.view) view.onShow?.();
    }
  }
  uiState.subscribe(renderRoute);

  // Splash: confere/instala yt-dlp e ffmpeg e então segue para a Home.
  const splash = new SplashScreen('splashScreen', () => uiState.navigate('home'));
  splash.init();

  // Pasta de destino
  const folderText = document.getElementById('currentFolderPath');
  function showFolder(folder) {
    folderText.textContent = folder;
    folderText.title = folder;
  }

  try {
    const paths = await window.clipdropAPI.getDefaultPaths();
    const initial = paths.downloads || paths.music || '';
    uiState.setDestinationFolder(initial);
    showFolder(initial);
  } catch (err) {
    console.warn('Erro ao carregar caminhos padrão:', err);
  }

  document.getElementById('changeFolderBtn').addEventListener('click', async () => {
    const selected = await window.clipdropAPI.chooseDirectory(uiState.getState().destinationFolder);
    if (selected) {
      uiState.setDestinationFolder(selected);
      showFolder(selected);
    }
  });

  document.getElementById('openFolderBtn').addEventListener('click', () => {
    window.clipdropAPI.openFolder(uiState.getState().destinationFolder);
  });
});
