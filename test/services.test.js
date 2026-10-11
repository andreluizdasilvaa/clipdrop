const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const OutputParser = require('../src/main/services/OutputParser');
const { sanitizeUrl, isSingleYouTubeVideo, formatDuration } = require('../src/main/utils/urlSanitizer');
const { translateError, SUBTITLE_ERROR_MESSAGE } = require('../src/main/utils/errorTranslator');
const { getUserDataDir, resolveOutputDir, findMostRecentFile } = require('../src/main/utils/pathUtils');
const DuplicateManager = require('../src/main/services/DuplicateManager');

test('OutputParser: extrai métricas de progresso com precisão', () => {
  // Parser customizado
  const resCustom = OutputParser.parseProgressMetrics('download:clipdrop_progress:45.5%|5.2MiB/s|00:12|25.0MiB');
  assert.ok(resCustom);
  assert.strictEqual(resCustom.percentNum, 45.5);
  assert.strictEqual(resCustom.speed, '5.2MiB/s');
  assert.strictEqual(resCustom.eta, '00:12');
  assert.strictEqual(resCustom.totalBytes, '25.0MiB');

  // Parser com pipe padrão
  const resPipe = OutputParser.parseProgressMetrics('  75.2% | 10.1MiB/s | 00:03 | 100MiB');
  assert.ok(resPipe);
  assert.strictEqual(resPipe.percentNum, 75.2);
  assert.strictEqual(resPipe.speed, '10.1MiB/s');

  // Parser padrão yt-dlp [download]
  const resStd = OutputParser.parseProgressMetrics('[download]  50.0% of  20.00MiB at   4.00MiB/s ETA 00:02');
  assert.ok(resStd);
  assert.strictEqual(resStd.percentNum, 50.0);
  assert.strictEqual(resStd.totalBytes, '20.00MiB');
  assert.strictEqual(resStd.speed, '4.00MiB/s');
  assert.strictEqual(resStd.eta, '00:02');
});

test('OutputParser: detecta estágios de pós-processamento', () => {
  assert.deepStrictEqual(OutputParser.parsePostProcessingStage('[ExtractAudio] Destination: song.mp3'), {
    status: 'postprocessing',
    percent: 94,
    message: 'Convertendo e extraindo áudio...'
  });

  assert.deepStrictEqual(OutputParser.parsePostProcessingStage('[Merger] Merging formats into "video.mp4"'), {
    status: 'merging',
    percent: 95,
    message: 'Unificando vídeo e áudio em alta qualidade...'
  });
});

test('OutputParser: extrai caminho de destino e ignora temporários', () => {
  const destDir = 'C:\\Downloads';
  const normalPath = OutputParser.extractDestinationPath('[download] Destination: C:\\Downloads\\video.mp4', destDir);
  assert.strictEqual(normalPath, 'C:\\Downloads\\video.mp4');

  const tempPath = OutputParser.extractDestinationPath('[download] Destination: C:\\Downloads\\video.temp.mp4', destDir);
  assert.strictEqual(tempPath, null);
});

test('urlSanitizer: sanitiza parâmetros e identifica vídeos do YouTube', () => {
  const clean = sanitizeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=12345&feature=shared');
  assert.strictEqual(clean, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

  assert.strictEqual(isSingleYouTubeVideo('https://youtu.be/dQw4w9WgXcQ'), true);
  assert.strictEqual(isSingleYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
  assert.strictEqual(isSingleYouTubeVideo('https://www.youtube.com/playlist?list=PL12345'), false);
  assert.strictEqual(isSingleYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL12345'), false);

  assert.strictEqual(formatDuration(125), '2:05');
  assert.strictEqual(formatDuration(3665), '1:01:05');
});

test('errorTranslator: traduz códigos e mensagens comuns em português amigável', () => {
  assert.ok(translateError('ERROR: HTTP Error 429: Too Many Requests').includes('Muitas requisições enviadas à plataforma'));
  assert.ok(translateError('ERROR: [WinError 32] O arquivo já está sendo usado por outro processo').includes('estava em uso pelo sistema operacional'));
  assert.ok(translateError('ERROR: Video unavailable').includes('não está mais disponível'));
  assert.strictEqual(translateError('Unable to download video subtitles'), SUBTITLE_ERROR_MESSAGE);
});

test('DuplicateManager: gera caminhos incrementais protegidos', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clipdrop-test-'));
  try {
    const file1 = path.join(tmp, 'Musica.mp3');
    fs.writeFileSync(file1, 'teste');

    const dm = new DuplicateManager(tmp);
    const dup1 = dm.getDuplicateFilePath(file1);
    assert.strictEqual(dup1, path.join(tmp, 'Musica (1).mp3'));

    fs.writeFileSync(dup1, 'teste');
    const dup2 = dm.getDuplicateFilePath(file1);
    assert.strictEqual(dup2, path.join(tmp, 'Musica (2).mp3'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('pathUtils: resolve diretórios e encontra arquivos recentes', () => {
  const userDir = getUserDataDir();
  assert.ok(typeof userDir === 'string' && userDir.length > 0);

  const custom = resolveOutputDir('C:\\CustomPath');
  assert.strictEqual(custom, 'C:\\CustomPath');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'clipdrop-path-test-'));
  try {
    const older = path.join(tmp, 'antigo.mp4');
    const newer = path.join(tmp, 'novo.mp4');
    const ignored = path.join(tmp, 'temp.temp');

    fs.writeFileSync(older, '1');
    fs.writeFileSync(ignored, '2');
    fs.writeFileSync(newer, '3');

    const found = findMostRecentFile(tmp);
    assert.strictEqual(found, newer);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

