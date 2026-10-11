# ClipDrop

> Interface gráfica desktop moderna, robusta e modular para download, extração e conversão de mídia via **yt-dlp** e **FFmpeg**.

<p align="center">
  <img src="src/renderer/assets/logos/logo_sem_fundo_com_texto_branco.png" alt="ClipDrop Logo" width="280" />
</p>

<p align="center">
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js" /></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-33.2.0-47848F?logo=electron&logoColor=white" alt="Electron" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" /></a>
  <a href="https://github.com/"><img src="https://img.shields.io/badge/Platform-Windows-lightgrey" alt="Platform" /></a>
</p>

---

## 1. Visão Geral (Overview)

O **ClipDrop** é uma aplicação desktop para Windows construída sobre o ecossistema Electron. Seu objetivo principal é fornecer uma experiência de usuário visualmente rica, simples e rápida para extração e processamento de mídias da internet, eliminando a barreira de uso de ferramentas de linha de comando como `yt-dlp` e `ffmpeg`.

### O Problema que Resolve
Ferramentas baseadas em terminal como o `yt-dlp` oferecem poder extremo e suporte a mais de 1.800 plataformas, porém exigem conhecimento de parâmetros de linha de comando, configuração manual de binários no `$PATH`, resolução de conflitos de codecs e gestão manual de dependências. O ClipDrop abstrai toda essa complexidade em um fluxo "Zero-Config" com interface gráfica reativa e intuitiva.

### Principais Funcionalidades
- **Zero-Config de Ferramentas:** Download e verificação automática dos binários oficiais (`yt-dlp`, `ffmpeg`, `ffprobe` e runtime `deno`) em espaço isolado de usuário (`userData`), sem exigir privilégios administrativos.
- **Inspeção Prévia de Links:** Pré-visualização instantânea do conteúdo antes do download (título, autor/canal, miniatura e duração exata).
- **Suporte Abrangente a Mídias:** Compatível com YouTube, YouTube Music, Instagram Reels, TikTok, Twitter/X, Facebook, Twitch, Reddit, SoundCloud, Vimeo e mais de 1.800 sites suportados pelo yt-dlp.
- **Modo Áudio Dedicado:** Conversão direta para MP3, M4A, FLAC, WAV e OPUS com injeção automática de metadados ID3 e capa de álbum embutida.
- **Modo Vídeo Avançado:** Seleção de qualidade (Melhor Qualidade, 1080p, 720p, 480p com fallback dinâmico), contêineres customizados (MP4, MKV, WEBM, MOV) e opção "Apenas Vídeo".
- **Gerenciamento de Legendas:** Suporte a legendas oficiais, geradas por IA (auto-subs), embutidas (*softsubs*), avulsas (.srt) ou queimadas nos frames do vídeo (*hardsub*).
- **Gestão Granular de Playlists:** Inspeção de listas de reprodução com seleção/desmarcação de faixas individuais ou intervalo numérico de lote.
- **Corte de Trechos (Trim):** Extração de intervalos específicos de tempo (HH:MM:SS) sem necessidade de baixar o arquivo inteiro.
- **Duplicação Inteligente e Gestão de Arquivos:** Ao solicitar novamente uma mídia já baixada, o `DuplicateManager` realiza cópia local instantânea com incremento numérico protegido `(1)`, `(2)`, dispensando arquivos `.archive.txt` do yt-dlp e evitando tráfego redundante de rede.
- **Auto-Update em Segundo Plano:** Verificação e atualização automática do motor `yt-dlp` (`-U`) de forma silenciosa e não-bloqueante na inicialização do app.
- **Design System Adaptativo & Minimalista:** Alternância suave entre Modo Escuro e Claro, sincronizado nativamente com o sistema operacional, com exibição sutil da versão do aplicativo no canto inferior esquerdo.

---

## 2. Arquitetura da Aplicação

O projeto segue rigorosamente os padrões de segurança e desacoplamento recomendados pela equipe do Electron, com separação estrita de contextos através de `contextIsolation: true` e `nodeIntegration: false`.

```
┌──────────────────────────────────────────────────────────────┐
│                    Processo Renderer                         │
│   (HTML5, Vanilla CSS Design System, UIState Pub/Sub, JS)    │
└──────────────────────────────┬───────────────────────────────┘
                               │ Chamadas via window.clipdropAPI
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                    Preload (Context Bridge)                  │
│       Isola APIs do Node e expõe métodos controlados         │
└──────────────────────────────┬───────────────────────────────┘
                               │ IPC Bidirecional (ipcRenderer <-> ipcMain)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     Processo Principal                       │
│  ┌───────────────────────┐        ┌───────────────────────┐  │
│  │     Módulos IPC       │◄──────►│  Camada de Serviços   │  │
│  │ (download, media,...) │        │  (Download, Inspector)│  │
│  └───────────────────────┘        └───────────┬───────────┘  │
│                                               ▼              │
│                           ┌───────────────────────────────┐  │
│                           │ Processos Filhos (spawn/exec) │  │
│                           │    yt-dlp, ffmpeg, ffprobe    │  │
│                           └───────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 2.1. Separação de Camadas

1. **Processo Principal (`src/main`):**
   - Controla o ciclo de vida da janela nativa (`BrowserWindow`), menus e eventos do SO.
   - Orquestra os serviços de negócio (`DownloadService`, `MediaInspector`, `DuplicateManager`, `DependencyManager`).
   - Gerencia a execução dos processos filhos (`child_process.spawn`) e pipelines de streaming do yt-dlp/ffmpeg.
   - Centraliza o tratamento de erros e tradução de saídas em linguagem amigável ao usuário.

2. **Preload Script (`src/preload/index.js`):**
   - Cria uma ponte segura através de `contextBridge.exposeInMainWorld('clipdropAPI', {...})`.
   - Impede que o Renderer tenha acesso direto a primitivas perigosas (`fs`, `child_process`, `os`).
   - Mapeia canais de comunicação tipados para métodos assíncronos e subscrições de eventos.

3. **Processo de Renderização (`src/renderer`):**
   - Interface pura construída em **HTML5**, **Vanilla CSS** e **JavaScript modular**.
   - Gerencia o estado persistido e transições de tela via `UIStateManager` (padrão Observer/Pub-Sub).
   - Componentes encapsulados que se conectam aos contratos disponibilizados por `window.clipdropAPI`.

### 2.2. Mapa da Estrutura de Diretórios

```
clipdrop/
├── .gitignore
├── README.md                  # Documentação técnica do projeto
├── electron-builder.yml       # Especificações de empacotamento e distribuição
├── package.json               # Dependências, scripts e metadados do projeto
│
├── src/
│   ├── main/                  # PROCESSO PRINCIPAL (Main Process)
│   │   ├── index.js           # Ponto de entrada do Electron e ciclo de vida
│   │   ├── argsBuilder.js     # Construtor puro de argumentos do yt-dlp
│   │   ├── dependencyManager.js # Auto-instalação e atualização de binários
│   │   │
│   │   ├── ipc/               # Controladores IPC agrupados por domínio
│   │   │   ├── index.js       # Registro unificado de canais IPC
│   │   │   ├── download.ipc.js # Handlers de início, cancelamento e progresso
│   │   │   ├── media.ipc.js   # Handlers de inspeção prévia de URLs
│   │   │   ├── dependencies.ipc.js # Handlers de status e setup de binários
│   │   │   └── system.ipc.js  # Diálogos nativos, shell e tema do SO
│   │   │
│   │   ├── services/          # Regras de negócio e orquestração
│   │   │   ├── DownloadService.js  # Gerenciador do ciclo de vida dos downloads
│   │   │   ├── DuplicateManager.js # Detecção de duplicatas e cache local
│   │   │   ├── MediaInspector.js   # Extração de metadados (dump JSON)
│   │   │   ├── OutputParser.js     # Parser de métricas de stdout do yt-dlp
│   │   │   ├── PostProcessor.js    # Hardsub e operações complementares FFmpeg
│   │   │   └── SystemService.js    # Interação com shell e sistema de arquivos
│   │   │
│   │   └── utils/             # Utilitários auxiliares de backend
│   │       ├── errorTranslator.js  # Mapeamento de mensagens de erro amigáveis
│   │       ├── pathUtils.js        # Resolução segura de caminhos e busca de arquivos
│   │       └── urlSanitizer.js     # Sanitização e remoção de tracking de URLs
│   │
│   ├── preload/               # CONTEXT BRIDGE (Isolamento de Segurança)
│   │   └── index.js           # Exposição da API controlada `window.clipdropAPI`
│   │
│   ├── shared/                # RECURSOS COMPARTILHADOS (Main, Preload e Renderer)
│   │   └── constants/
│   │       ├── ipcChannels.js # Catálogo imutável de identificadores IPC
│   │       └── mediaFormats.js# Constantes de formatos, qualidades e idiomas
│   │
│   └── renderer/              # PROCESSO DE RENDERIZAÇÃO (Frontend UI)
│       ├── index.html         # Estrutura DOM da aplicação
│       ├── css/
│       │   └── style.css      # Sistema de design, temas e microinterações
│       ├── assets/            # Imagens, marcas e ícones estáticos
│       └── js/
│           ├── app.js         # Inicializador do frontend e roteamento
│           ├── uiState.js     # Estado global reativo com persistência local
│           ├── utils.js       # Utilitários de DOM, ícones SVG e componentes HTML
│           └── components/    # Componentes modulares da interface
│               ├── splashScreen.js # Checklist visual de ferramentas
│               ├── homeView.js     # Tela inicial e seleção de modo
│               ├── modeView.js     # Classe base dos modos de download
│               ├── audioView.js    # Tela e configurações do modo Áudio
│               ├── videoView.js    # Tela e configurações do modo Vídeo
│               ├── urlBar.js       # Barra de links com colar inteligente
│               ├── playlistView.js # Visualizador e seletor de playlists
│               └── downloadList.js # Painel de transferências em tempo real
│
└── test/                      # TESTES AUTOMATIZADOS (Node.js Test Runner)
    ├── argsBuilder.test.js    # Testes unitários do gerador de argumentos
    └── services.test.js       # Testes dos parsers, sanitizers e DuplicateManager
```

### 2.3. Catálogo de Canais IPC

As mensagens IPC utilizam constantes imutáveis centralizadas em `src/shared/constants/ipcChannels.js`:

| Domínio | Canal IPC | Tipo | Finalidade |
| :--- | :--- | :--- | :--- |
| **Dependencies** | `dependencies:get-status` | `handle / invoke` | Obtém o status atual das ferramentas (`ytdlp`, `ffmpeg`, etc.) |
| **Dependencies** | `dependencies:start-setup`| `handle / invoke` | Dispara o fluxo de download/configuração dos binários |
| **Dependencies** | `dependencies:progress`   | `send / on` | Emite porcentagem de download dos binários para a Splash Screen |
| **Media** | `media:inspect` | `handle / invoke` | Analisa a URL e retorna metadados ou itens de playlist |
| **Download** | `media:download` | `handle / invoke` | Inicia um processo de download com as opções selecionadas |
| **Download** | `media:cancel-download` | `handle / invoke` | Interrompe o processo ativo via sinal `SIGTERM` |
| **Download** | `download:progress` | `send / on` | Streaming de métricas de progresso (`percent`, `speed`, `eta`) |
| **Download** | `download:status` | `send / on` | Atualizações de estágio (`starting`, `merging`, `completed`, `error`) |
| **System** | `dialog:choose-directory` | `handle / invoke` | Abre a caixa de diálogo nativa do SO para escolha de pasta |
| **System** | `shell:open-folder` | `handle / invoke` | Abre a pasta no explorador de arquivos do sistema operacional |
| **System** | `system:get-default-paths`| `handle / invoke` | Retorna os caminhos padrão do usuário (`Downloads`, `Músicas`) |
| **System** | `system:get-theme` | `handle / invoke` | Detecta se o sistema está em modo escuro ou claro |
| **System** | `system:get-username-sync`| `sendSync` | Obtém o nome do usuário do SO de forma síncrona na inicialização |

---

## 3. Stack Tecnológica

- **Runtime & Desktop Framework:** [Electron](https://www.electronjs.org/) (v33.2.0) sobre Node.js 20+.
- **Frontend Core:** HTML5 Semântico, Vanilla JavaScript (ES2022+), Vanilla CSS estruturado com tokens de cores HSL, variáveis CSS e suporte dinâmico a temas claro/escuro.
- **Tipografia:** Google Fonts ([Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)).
- **Extração & Conversão Multimídia:**
  - [yt-dlp](https://github.com/yt-dlp/yt-dlp) (motor principal de extração de streams).
  - [FFmpeg & FFprobe](https://github.com/ffbinaries/ffbinaries-prebuilt) (conversão, junção de canais, metadados e hardsubs).
  - [Deno](https://github.com/denoland/deno) (runtime JS para resolução de desafios em plataformas com proteção antibot).
- **Manipulação de Arquivos Compactados:** `adm-zip` (v0.5.16) para descompactação automática dos binários.
- **Testes Unitários:** Test Runner nativo do Node.js (`node:test` e `node:assert/strict`).
- **Empacotamento & Build:** [electron-builder](https://www.electron.build/) (v25.1.8).

---

## 4. Guia de Instalação e Execução (Desenvolvimento)

### Pré-requisitos
- **Node.js:** Versão `>= 18.0.0` (recomendado Node.js 20 LTS).
- **NPM:** Versão `>= 9.0.0`.
- **Git** instalado.

### Passo a Passo

1. **Clonar o Repositório:**
   ```bash
   git clone https://github.com/andreluizdasilvaa/clipdrop.git
   cd clipdrop
   ```

2. **Instalar Dependências:**
   ```bash
   npm install
   ```

3. **Executar a Suíte de Testes Unitários:**
   ```bash
   npm test
   # ou diretamente:
   node --test
   ```

4. **Iniciar a Aplicação em Modo Desenvolvimento:**
   ```bash
   npm start
   ```
   > **Nota:** Na primeira execução, a aplicação exibirá a tela de *Splash Screen* enquanto baixa automaticamente os binários oficiais necessários para a pasta de dados do usuário (`%APPDATA%/.clipdrop/bin` no Windows). Nenhuma instalação manual de FFmpeg ou yt-dlp é necessária.

---

## 5. Empacotamento e Distribuição (Build)

O empacotamento é configurado via [electron-builder.yml](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/electron-builder.yml).

### Comandos de Compilação

- **Gerar Instalador de Produção:**
  ```bash
  npm run build
  ```
  O instalador final e seus respectivos artefatos serão gerados no diretório `release/`.

- **Gerar Diretório Descompactado (Pack para Teste Rápido):**
  ```bash
  npm run pack
  ```
  Empacota os arquivos na pasta `release/win-unpacked/` (ou equivalente no SO) sem criar o instalador NSIS.

### Configurações da Plataforma

- **Windows:**
  - Formato: Instalador assistido **NSIS** (`.exe`).
  - Arquitetura: `x64`.
  - Nome do arquivo: `ClipDrop-Setup-<versao>.exe`.
  - Permite ao usuário escolher o diretório de destino na instalação.

---

## 6. Fluxo de Trabalho para Novas Features

Ao estender o ClipDrop com novos recursos, siga as seguintes diretrizes arquiteturais:

### 1. Adicionar uma Nova Opção de Download
1. **Defina a constante:** Adicione o formato ou chave em `src/shared/constants/mediaFormats.js`.
2. **Atualize o Construtor de Argumentos:** Em `src/main/argsBuilder.js`, adicione as flags correspondentes do `yt-dlp` e escreva o caso de teste em `test/argsBuilder.test.js`.
3. **Atualize o Estado da UI:** Adicione o valor padrão em `DEFAULT_SETTINGS` no arquivo `src/renderer/js/uiState.js`.
4. **Exponha na Interface:** Utilize os helpers modulares de `src/renderer/js/utils.js` (`toggleHtml`, `selectHtml`, `segmentedHtml`) dentro de `audioView.js` ou `videoView.js`.

### 2. Criar um Novo Canal de Comunicação IPC
1. Registre o novo identificador em `src/shared/constants/ipcChannels.js`.
2. Implemente a regra de negócio na camada `src/main/services/`.
3. Crie ou estenda o handler correspondente em `src/main/ipc/` e registre-o em `src/main/ipc/index.js`.
4. Exponha a função segura no Preload (`src/preload/index.js`).
5. Invoque o método no Renderer via `window.clipdropAPI.seuNovoMetodo()`.

### 3. Criar uma Nova Tela / Visão
1. Crie o arquivo do componente em `src/renderer/js/components/suaNovaView.js`.
2. Inclua o script e a seção `<section class="view" id="suaNovaView" hidden></section>` no arquivo `src/renderer/index.html`.
3. Registre a rota e o ciclo de transição no roteador em `src/renderer/js/app.js`.

---

## Licença

Este projeto é distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.
