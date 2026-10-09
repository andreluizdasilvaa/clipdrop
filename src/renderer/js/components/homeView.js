// Tela inicial: saudação + dois cards de modo
class HomeView {
  constructor(container) {
    this.container = container;
    this.render();
  }

  greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  render() {
    this.container.innerHTML = `
      <header class="home-head">
        <h1 class="home-title" data-role="greeting"></h1>
        <p class="home-sub">O que você quer baixar hoje?</p>
      </header>

      <div class="mode-grid">
        <button type="button" class="mode-card" data-mode="audio">
          <span class="mode-icon">${ICONS.music}</span>
          <span class="mode-name">Áudio &amp; Música</span>
          <span class="mode-desc">Baixe músicas e álbuns com capa e tags organizadas para pendrive ou celular</span>
          <span class="mode-cta">Começar →</span>
        </button>

        <button type="button" class="mode-card" data-mode="video">
          <span class="mode-icon">${ICONS.video}</span>
          <span class="mode-name">Vídeo</span>
          <span class="mode-desc">Baixe vídeos individuais ou coleções em alta resolução</span>
          <span class="mode-cta">Começar →</span>
        </button>
      </div>`;

    this.refreshGreeting();
    this.container.querySelectorAll('.mode-card').forEach((card) => {
      card.addEventListener('click', () => uiState.navigate(card.dataset.mode));
    });
  }

  refreshGreeting() {
    this.container.querySelector('[data-role="greeting"]').textContent = `${this.greeting()}!`;
  }

  onShow() {
    this.refreshGreeting();
  }
}

window.HomeView = HomeView;
