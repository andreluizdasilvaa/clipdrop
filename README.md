# ClipDrop

Interface desktop simples para baixar músicas e vídeos (usa **yt-dlp** e **ffmpeg** por baixo, sem você precisar instalar nada).

## Como funciona

1. **Primeira abertura:** o app confere e instala sozinho o `yt-dlp` e o `ffmpeg` em `userData/bin` (sem pedir permissão de administrador). Se já existirem no `PATH`, usa os do sistema. O `yt-dlp` é atualizado em segundo plano.
2. **Tela inicial:** dois cards, **Áudio & Música** e **Vídeo**.
3. **Dentro de cada modo:** cole o link (a análise começa sozinha ao colar), ajuste as opções e baixe.

### 🎵 Áudio & Música
- Formato MP3 ou FLAC
- Embutir capa e preencher artista/data (tags)
- Remover vinhetas e propagandas faladas (SponsorBlock)
- Playlists: escolha itens ou baixe a playlist inteira (em subpasta com o nome da playlist)

### 🎬 Vídeo
- Qualidade: melhor, 1080p ou 720p (MP4)
- Legendas em Português ou Inglês
- SponsorBlock: patrocínios, vinhetas e pedidos de inscrição; cortar do vídeo ou só marcar capítulos
- Playlists: seleção item a item ou coleção completa

Em ambos: anti-duplicação silenciosa (`.archive.txt` na pasta de destino), progresso em tempo real e erros em português.

## Estrutura

```text
src/
├── main/
│   ├── index.js              # janela e ciclo de vida
│   ├── dependencyManager.js  # instala/verifica yt-dlp e ffmpeg
│   ├── argsBuilder.js        # configurações da UI -> argumentos do yt-dlp (função pura, testada)
│   ├── ytdlpExecutor.js      # processos, progresso e erros amigáveis
│   └── ipcHandlers.js        # canais IPC
├── preload/index.js          # window.clipdropAPI (contextBridge)
└── renderer/
    ├── index.html
    ├── css/style.css         # paleta: #FCF7FF · #090809 · #F40000 · #FFD447
    └── js/
        ├── app.js            # inicialização e roteador de telas
        ├── uiState.js        # estado: tela atual, configurações por modo (persistidas)
        ├── utils.js
        └── components/
            ├── splashScreen.js  homeView.js  modeView.js (base)
            ├── audioView.js     videoView.js
            └── urlBar.js  playlistView.js  downloadList.js
test/argsBuilder.test.js
```

## Comandos

```bash
npm start        # abre o app
npm test         # testes unitários (node:test)
npm run build    # gera o instalador em release/
```

No PowerShell com restrição de scripts, use `npm.cmd` no lugar de `npm`.
