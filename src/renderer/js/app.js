// ClipDrop - inicialização e roteador de telas
document.addEventListener('DOMContentLoaded', async () => {
  // Gerenciamento de Modo Claro / Escuro
  const setupTheme = async () => {
    const isManual = localStorage.getItem('clipdrop_theme_manual') === 'true';
    let initialTheme = localStorage.getItem('clipdrop_theme');

    // Primeira vez: obtém diretamente do sistema operacional do usuário
    if (!isManual || !initialTheme) {
      try {
        if (window.clipdropAPI && typeof window.clipdropAPI.getSystemTheme === 'function') {
          initialTheme = await window.clipdropAPI.getSystemTheme();
        }
      } catch (e) {}
      if (!initialTheme) {
        initialTheme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
      }
    }

    const applyTheme = (theme, saveManual = false) => {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.setAttribute('data-theme', theme);
      localStorage.setItem('clipdrop_theme', theme);
      if (saveManual) {
        localStorage.setItem('clipdrop_theme_manual', 'true');
      }
      const toggleBtn = document.getElementById('themeToggleBtn');
      if (toggleBtn) {
        const isDark = theme === 'dark';
        toggleBtn.setAttribute('title', isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro');
        toggleBtn.setAttribute('aria-label', isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro');
      }
    };

    applyTheme(initialTheme, false);

    const toggleBtn = document.getElementById('themeToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next, true);
      });
    }

    // Acompanha mudanças no sistema do usuário se não tiver fixado manualmente
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (localStorage.getItem('clipdrop_theme_manual') !== 'true') {
          applyTheme(e.matches ? 'dark' : 'light', false);
        }
      });
    }
  };
  setupTheme();

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
