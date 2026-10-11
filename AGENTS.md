# Diretrizes para Agentes de IA — ClipDrop

> Este documento serve como manual operacional, arquitetural e comportamental para qualquer agente de IA (ou desenvolvedor automatizado) que realize tarefas de manutenção, refatoração, correção ou evolução nesta base de código.

---

## 1. Visão Geral do Projeto

O **ClipDrop** é uma aplicação desktop desenvolvida para Windows em **Electron**. Seu propósito fundamental é fornecer uma interface gráfica moderna, amigável, rápida e minimalista para download, extração de áudio, conversão e corte de mídias da web utilizando **yt-dlp** e **FFmpeg**.

### Arquitetura Central
O sistema é estruturado em três camadas estritamente isoladas para máxima segurança e manutenibilidade:

1. **Processo Principal (`src/main`):**
   - Ciclo de vida da janela (`BrowserWindow`).
   - Serviços de negócio (`DownloadService`, `MediaInspector`, `DuplicateManager`, `DependencyManager`).
   - Orquestração de processos filhos (`spawn`) para `yt-dlp`, `ffmpeg`, `ffprobe` e `deno`.
   - Handlers IPC desacoplados e organizados por domínio em `src/main/ipc/`.

2. **Preload / Context Bridge (`src/preload`):**
   - Isolamento total de segurança: `contextIsolation: true` e `nodeIntegration: false`.
   - Não expõe bibliotecas nativas do Node (`fs`, `child_process`, `os`) diretamente à interface.
   - Fornece a API de comunicação segura `window.clipdropAPI` via `contextBridge`.

3. **Processo de Renderização (`src/renderer`):**
   - Frontend puro com HTML5 semântico, JavaScript modular e Vanilla CSS com Design System baseado em tokens.
   - Gerenciamento de estado reativo e persistente (`localStorage`) através de `uiState.js` (Observer / Pub-Sub).
   - Componentes modulares de interface em `src/renderer/js/components/`.

---

## 2. Stack Tecnológica

| Componente | Tecnologia | Versão / Padrão | Finalidade |
| :--- | :--- | :--- | :--- |
| **Runtime Desktop** | [Electron](https://www.electronjs.org/) | `^33.2.0` | Container desktop seguro e gerenciador de janelas |
| **Ambiente Node** | Node.js | `>= 18.0.0` (LTS 20+) | Execução do processo principal e scripts |
| **Frontend Core** | HTML5 / CSS3 / ES2022+ | Nativo (Vanilla) | Interface de usuário sem frameworks pesados |
| **Estilização** | Vanilla CSS com Design System | CSS Custom Properties | Variáveis CSS, temas claro/escuro, microinterações |
| **Motor de Download**| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Latest Standalone | Extração de áudio/vídeo e metadados de plataformas |
| **Motor de Mídia** | [FFmpeg / FFprobe](https://github.com/ffbinaries/ffbinaries-prebuilt) | v6.1 | Conversão de contêineres, fusão de streams e metadados |
| **JS Engine Auxiliar**| [Deno](https://github.com/denoland/deno) | Latest Standalone | Resolução de desafios antibot/JS do YouTube |
| **Descompressão** | [adm-zip](https://www.npmjs.com/package/adm-zip) | `^0.5.16` | Extração de binários compactados no setup inicial |
| **Test Runner** | Node.js Test Runner (`node:test`) | Nativo | Execução rápida de testes unitários sem dependências externas |
| **Empacotador** | [electron-builder](https://www.electron.build/) | `^25.1.8` | Geração de instaladores (NSIS no Windows) |

---

## 3. Estrutura de Pastas

```
clipdrop/
├── .gitignore
├── AGENTS.md                  # Manual e diretrizes operacionais para agentes de IA
├── LICENSE                    # Licença MIT
├── README.md                  # Documentação do projeto
├── electron-builder.yml       # Configuração de build e instalador
├── package.json               # Dependências, metadados e scripts
│
├── src/
│   ├── main/                  # BACKEND / PROCESSO PRINCIPAL
│   │   ├── index.js           # Ponto de entrada do Electron e criação de janela
│   │   ├── argsBuilder.js     # Construtor de argumentos do yt-dlp (funções puras)
│   │   ├── dependencyManager.js # Download, auto-update e validação de binários
│   │   │
│   │   ├── ipc/               # Controladores IPC agrupados por domínio
│   │   │   ├── index.js       # Registro unificado de todos os handlers
│   │   │   ├── dependencies.ipc.js # Status e progresso das dependências
│   │   │   ├── download.ipc.js     # Início, cancelamento e eventos de download
│   │   │   ├── media.ipc.js        # Inspeção prévia de URLs
│   │   │   └── system.ipc.js       # Diretórios nativos, temas e explorador
│   │   │
│   │   ├── services/          # Camada de serviços e regras de negócio
│   │   │   ├── DownloadService.js  # Gerenciador de ciclo de vida de downloads
│   │   │   ├── DuplicateManager.js # Cache inteligente e duplicação incremental
│   │   │   ├── MediaInspector.js   # Extração de metadados em segundo plano
│   │   │   ├── OutputParser.js     # Parser das saídas de texto do yt-dlp
│   │   │   ├── PostProcessor.js    # Hardsub e operações complementares de vídeo
│   │   │   └── SystemService.js    # Utilitários de sistema e integração com SO
│   │   │
│   │   └── utils/             # Utilitários puros de backend
│   │       ├── errorTranslator.js  # Tradução amigável de erros para português
│   │       ├── pathUtils.js        # Resolução segura de caminhos e arquivos
│   │       └── urlSanitizer.js     # Higienização de links e remoção de tracking
│   │
│   ├── preload/               # CONTEXT BRIDGE (Isolamento de Segurança)
│   │   └── index.js           # Exposição de APIs em window.clipdropAPI
│   │
│   ├── shared/                # CÓDIGO COMPARTILHADO (Main, Preload, Renderer)
│   │   └── constants/
│   │       ├── ipcChannels.js # Catálogo único e imutável de canais IPC
│   │       └── mediaFormats.js# Constantes de formatos, qualidades e idiomas
│   │
│   └── renderer/              # FRONTEND / INTERFACE DE USUÁRIO
│       ├── index.html         # Documento base da aplicação
│       ├── css/
│       │   └── style.css      # Design System, variáveis CSS e temas
│       ├── assets/            # Logos, favicons e recursos gráficos estáticos
│       └── js/
│           ├── app.js         # Inicializador do frontend e roteamento
│           ├── uiState.js     # Estado reativo e persistência local
│           ├── utils.js       # Componentes HTML utilitários e ícones SVG
│           └── components/    # Componentes desacoplados de tela
│               ├── splashScreen.js # Checklist inicial e verificação de ferramentas
│               ├── homeView.js     # Tela inicial e seleção de modo
│               ├── modeView.js     # Classe abstrata/base para telas de modo
│               ├── audioView.js    # Tela e configurações do modo Áudio
│               ├── videoView.js    # Tela e configurações do modo Vídeo
│               ├── urlBar.js       # Input de link com colar inteligente
│               ├── playlistView.js # Seleção e paginação de playlists
│               └── downloadList.js # Monitor de downloads em tempo real
│
└── test/                      # TESTES AUTOMATIZADOS (node:test)
    ├── argsBuilder.test.js    # Validação do construtor de argumentos CLI
    └── services.test.js       # Validação de parsers, duplicatas e sanitização
```

### Onde criar cada tipo de arquivo:
- **Novos canais IPC:** Declare o nome do canal em [ipcChannels.js](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/src/shared/constants/ipcChannels.js).
- **Novas regras de download/conversão:** Crie ou modifique serviços em [src/main/services/](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/src/main/services/).
- **Novos componentes visuais:** Crie em [src/renderer/js/components/](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/src/renderer/js/components/).
- **Novos testes:** Adicione casos em [test/](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/test/).

---

## 4. Convenções de Código

### Padrões Gerais e Formatação
- **Linguagem:** JavaScript moderno (ES2022+ / CommonJS no Backend e Preload; ES Modules/Vanilla Scripts no Renderer).
- **Indentação:** 2 espaços, sem tabs.
- **Ponto e vírgula:** Obrigatório ao final de declarações.
- **Aspas:** Aspas simples (`'`) para strings literais; template literals (`` ` ``) para interpolação.

### Nomenclatura
- **Arquivos:**
  - Classes de serviço e componentes: `PascalCase.js` (ex: `DownloadService.js`, `AudioView.js`).
  - Módulos auxiliares, utilitários e IPC: `camelCase.js` ou `dominio.ipc.js` (ex: `argsBuilder.js`, `download.ipc.js`).
- **Funções e Variáveis:** `camelCase` (ex: `downloadMedia`, `destDir`).
- **Constantes:** `UPPER_SNAKE_CASE` (ex: `IPC_CHANNELS`, `DEFAULT_SETTINGS`).
- **IDs e Classes no HTML/CSS:** `kebab-case` (ex: `app-version`, `download-card`, `btn-primary`).

### Tipagem e Validação
- Utilize anotações **JSDoc** (`/** @param ... */`) em classes e funções públicas para documentar parâmetros e retornos.
- Funções críticas que recebem dados de fora (ex: URLs, caminhos de arquivo, opções do renderer) devem validar tipos e formatos defensivamente antes de repassar a subprocessos.

### Tratamento de Erros
- **Nunca exponha erros crus ou stack traces diretamente para o usuário na interface.**
- Utilize sempre o módulo [`errorTranslator.js`](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/src/main/utils/errorTranslator.js) para mapear saídas do `stderr` do yt-dlp em mensagens legíveis e explicativas em português.
- Falhas de rede transitórias ou concorrência de arquivos devem ter tratamento de retry transparente.

---

## 5. Comandos Essenciais

### Instalação de Dependências
```bash
npm install
```

### Executar em Desenvolvimento
```bash
npm start
```

### Executar a Suíte de Testes
```bash
npm test
# ou diretamente via node:
node --test
```
> **Nota para ambiente Windows / PowerShell:** Se houver bloqueio de execução de scripts (`PSSecurityException` em `npm.ps1`), execute via prompt de comando nativo:
> ```bash
> cmd.exe /c "npm test"
> ```

### Empacotamento / Compilação
```bash
# Teste local descompactado (rápido):
npm run pack

# Build final de produção:
npm run build
```

---

## 6. Regras e Restrições Críticas (O que NÃO fazer)

1. **PROIBIDO quebrar o isolamento do Electron:**
   - Nunca altere `contextIsolation: true` para `false` em `src/main/index.js`.
   - Nunca ative `nodeIntegration: true`.
   - Nunca importe `child_process`, `fs` ou módulos do Node diretamente no código do `renderer`. Toda comunicação com o sistema DEVE passar por canais catalogados em `src/preload/index.js`.

2. **PROIBIDO usar "Magic Strings" em chamadas IPC:**
   - Nunca use strings manuais como `ipcRenderer.invoke('meu-canal')`.
   - Todo canal deve ser referenciado a partir do objeto imutável `IPC_CHANNELS` definido em [ipcChannels.js](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/src/shared/constants/ipcChannels.js).

3. **PROIBIDO introduzir frameworks desnecessários ou TailwindCSS:**
   - O projeto utiliza **Vanilla CSS** e Vanilla JavaScript para máxima performance, leveza e ausência de etapas pesadas de bundling. Não instale frameworks como React, Vue, TailwindCSS ou jQuery a menos que explicitamente solicitado pelo usuário.

4. **PROIBIDO utilizar a flag `--download-archive` (.archive.txt):**
   - O ClipDrop gerencia arquivos duplicados e links repetidos de forma nativa através do `DuplicateManager`. A flag `--download-archive` foi descontinuada no app porque bloqueava novos downloads e poluía o diretório do usuário com arquivos ocultos indesejados.

5. **PROIBIDO disparar processos de terminal visíveis:**
   - Todas as chamadas para `child_process.spawn` devem incluir `windowsHide: true` para que janelas pretas de prompt de comando do Windows nunca pisquem na tela do usuário.

6. **PROIBIDO exigir permissões de Administrador para binários:**
   - Os executáveis baixados (`yt-dlp`, `ffmpeg`, etc.) devem permanecer sempre no diretório do usuário (`userData/bin`), sem tocar em pastas protegidas do sistema (como `Program Files` ou `System32`).

---

## 7. Instruções e Checklist Operacional para Agentes de IA

Sempre que receber uma tarefa ou realizar alterações no repositório, o agente deve seguir rigorosamente o seguinte fluxo de trabalho:

### Checklist Passo a Passo:

1. **Compreensão e Localização:**
   - Identifique em qual camada a alteração pertence (Main, Preload, Shared ou Renderer).
   - Verifique se a mudança afeta contratos compartilhados (ex: [ipcChannels.js](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/src/shared/constants/ipcChannels.js) ou [uiState.js](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/src/renderer/js/uiState.js)).

2. **Edição Segura e Mínima:**
   - Modifique apenas as seções necessárias, preservando o estilo, indentação e comentários existentes.
   - Ao alterar o construtor de argumentos CLI ([argsBuilder.js](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/src/main/argsBuilder.js)), garanta que funções puras continuem sem efeitos colaterais.

3. **Validação Obrigatória dos Testes:**
   - **SEMPRE execute a suíte de testes antes de considerar a tarefa finalizada:**
     ```bash
     cmd.exe /c "npm test"
     ```
   - Todos os 24 testes unitários existentes DEVEM passar com 100% de sucesso (`pass: 24, fail: 0`).
   - Se uma alteração alterar contratos de saída de argumentos CLI ou lógica de serviços, atualize ou adicione testes equivalentes em [test/](file:///c:/Users/man0b/OneDrive/Documentos/GitHub/clipdrop/test/).

4. **Verificação de Regressão e Git Status:**
   - Rode `git status` para garantir que arquivos temporários, lixos de build ou arquivos não intencionais não foram deixados no diretório de trabalho.

5. **Resumo Claro ao Usuário:**
   - Ao finalizar, forneça uma explicação concisa e objetiva das alterações realizadas, referenciando os arquivos alterados com links markdown navegáveis.
