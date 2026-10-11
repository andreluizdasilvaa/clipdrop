const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { buildDownloadArgs } = require('../src/main/argsBuilder');

const base = { url: 'https://example.com/v', outputDir: '/dl', binDir: '/bin' };

const valueAfter = (args, flag) => args[args.indexOf(flag) + 1];

test('rejeita modo inválido e URL vazia', () => {
  assert.throws(() => buildDownloadArgs({ ...base, mode: 'preset' }), /inválido/);
  assert.throws(() => buildDownloadArgs({ ...base, mode: 'audio', url: '  ' }), /link válido/);
});

test('argumentos comuns: progresso, ffmpeg, archive e paths', () => {
  const args = buildDownloadArgs({ ...base, mode: 'audio' });
  assert.ok(args.includes('--newline'));
  assert.match(valueAfter(args, '--progress-template'), /^download:/);
  assert.equal(valueAfter(args, '--ffmpeg-location'), '/bin');
  assert.equal(valueAfter(args, '--download-archive'), path.join('/dl', '.archive-audio.txt'));
  const video = buildDownloadArgs({ ...base, mode: 'video' });
  assert.equal(valueAfter(video, '--download-archive'), path.join('/dl', '.archive.txt'));
  assert.equal(valueAfter(args, '--paths'), '/dl');
  assert.equal(args[args.length - 1], 'https://example.com/v');
});

test('áudio padrão: MP3 com capa e metadados, sem SponsorBlock', () => {
  const args = buildDownloadArgs({ ...base, mode: 'audio', audio: {} });
  assert.equal(valueAfter(args, '--audio-format'), 'mp3');
  assert.ok(args.includes('-x'));
  assert.ok(args.includes('--embed-thumbnail'));
  assert.ok(args.includes('--embed-metadata'));
  assert.ok(!args.includes('--sponsorblock-remove'));
});

test('áudio FLAC sem capa e sem metadados', () => {
  const args = buildDownloadArgs({
    ...base, mode: 'audio',
    audio: { format: 'flac', embedCover: false, embedMetadata: false }
  });
  assert.equal(valueAfter(args, '--audio-format'), 'flac');
  assert.ok(!args.includes('--embed-thumbnail'));
  assert.ok(!args.includes('--embed-metadata'));
});



test('vídeo: qualidade melhor, 1080 e 720', () => {
  const best = buildDownloadArgs({ ...base, mode: 'video', video: { quality: 'best' } });
  assert.equal(valueAfter(best, '-f'), 'bv*+ba/b');
  assert.equal(valueAfter(best, '--merge-output-format'), 'mp4');

  const hd = buildDownloadArgs({ ...base, mode: 'video', video: { quality: '1080' } });
  assert.match(valueAfter(hd, '-f'), /height<=1080/);

  const sd = buildDownloadArgs({ ...base, mode: 'video', video: { quality: '720' } });
  assert.match(valueAfter(sd, '-f'), /height<=720/);

  const unknown = buildDownloadArgs({ ...base, mode: 'video', video: { quality: '4k' } });
  assert.equal(valueAfter(unknown, '-f'), 'bv*+ba/b');
});

test('vídeo: legendas desligadas por padrão e idioma PT/EN quando ligadas', () => {
  const off = buildDownloadArgs({ ...base, mode: 'video', video: {} });
  assert.ok(!off.includes('--write-subs'));

  const pt = buildDownloadArgs({
    ...base, mode: 'video', video: { subtitles: { enabled: true, lang: 'pt' } }
  });
  assert.equal(valueAfter(pt, '--sub-langs'), 'pt,pt-BR,pt-PT');
  assert.equal(valueAfter(pt, '--sleep-subtitles'), '3');
  assert.ok(pt.includes('--embed-subs'));

  const en = buildDownloadArgs({
    ...base, mode: 'video', video: { subtitles: { enabled: true, lang: 'en' } }
  });
  assert.equal(valueAfter(en, '--sub-langs'), 'en,en-US,en-GB');
});



test('vídeo único usa --no-playlist e template simples', () => {
  const args = buildDownloadArgs({ ...base, mode: 'video' });
  assert.ok(args.includes('--no-playlist'));
  assert.equal(valueAfter(args, '-o'), '%(title)s.%(ext)s');
  assert.ok(!args.includes('-I'));
});

test('playlist inteira: sem -I e com subpasta', () => {
  const args = buildDownloadArgs({ ...base, mode: 'audio', isPlaylist: true, selectedIndices: null });
  assert.ok(!args.includes('-I'));
  assert.ok(!args.includes('--no-playlist'));
  assert.equal(valueAfter(args, '-o'), '%(playlist_title)s/%(title)s.%(ext)s');
});

test('playlist parcial usa -I com os índices marcados', () => {
  const args = buildDownloadArgs({
    ...base, mode: 'video', isPlaylist: true, selectedIndices: [1, 3, 7]
  });
  assert.equal(valueAfter(args, '-I'), '1,3,7');
});

test('vídeo: qualidade 480p e modo apenas vídeo (sem áudio)', () => {
  const q480 = buildDownloadArgs({ ...base, mode: 'video', video: { quality: '480' } });
  assert.equal(valueAfter(q480, '-f'), 'bv*[height<=480]+ba/b[height<=480]');

  const videoOnly = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { quality: '1080', advanced: { videoOnly: true } }
  });
  assert.equal(valueAfter(videoOnly, '-f'), 'bv*[height<=1080]');
  assert.ok(!valueAfter(videoOnly, '-f').includes('+ba/b'));
});

test('vídeo: container customizado e recodificação forçada', () => {
  const mkv = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { advanced: { container: 'mkv', recodeVideo: true } }
  });
  assert.equal(valueAfter(mkv, '--merge-output-format'), 'mkv');
  assert.equal(valueAfter(mkv, '--recode-video'), 'mkv');
});

test('vídeo: legendas avançadas (auto-subs, ambas, método separado e idioma espanhol)', () => {
  const autoSubs = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { subtitles: { enabled: true, lang: 'es', type: 'auto', method: 'softsub' } }
  });
  assert.ok(autoSubs.includes('--write-auto-subs'));
  assert.ok(!autoSubs.includes('--write-subs'));
  assert.equal(valueAfter(autoSubs, '--sub-langs'), 'es,es-419,es-ES');
  assert.ok(autoSubs.includes('--embed-subs'));

  const bothSubsSeparate = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { subtitles: { enabled: true, lang: 'pt', type: 'both', method: 'separate', format: 'srt' } }
  });
  assert.ok(bothSubsSeparate.includes('--write-subs'));
  assert.ok(bothSubsSeparate.includes('--write-auto-subs'));
  assert.ok(bothSubsSeparate.includes('--no-embed-subs'));
  assert.equal(valueAfter(bothSubsSeparate, '--convert-subs'), 'srt');
});

test('vídeo: capítulos, metadados e miniatura como capa', () => {
  const withCover = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { advanced: { embedChapters: true, embedThumbnail: true, embedMetadata: true } }
  });
  assert.ok(withCover.includes('--embed-chapters'));
  assert.ok(withCover.includes('--embed-metadata'));
  assert.ok(withCover.includes('--embed-thumbnail'));
  assert.equal(valueAfter(withCover, '--convert-thumbnails'), 'jpg');

  const withoutChapters = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { advanced: { embedChapters: false, embedMetadata: false } }
  });
  assert.ok(withoutChapters.includes('--no-embed-chapters'));
  assert.ok(withoutChapters.includes('--no-embed-metadata'));
});

test('vídeo: corte por intervalo de tempo (trim)', () => {
  const range = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { advanced: { trim: { enabled: true, start: '00:01:30', end: '00:05:00' } } }
  });
  assert.equal(valueAfter(range, '--download-sections'), '*00:01:30-00:05:00');

  const startOnly = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { advanced: { trim: { enabled: true, start: '00:02:00', end: '' } } }
  });
  assert.equal(valueAfter(startOnly, '--download-sections'), '*00:02:00-inf');
});

test('vídeo: paralelismo (-N 4), ignoreExisting desativado e playlistRange textual', () => {
  const multiFrag = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { advanced: { concurrentFragments: true, ignoreExisting: false } }
  });
  assert.equal(valueAfter(multiFrag, '-N'), '4');
  assert.ok(!multiFrag.includes('--download-archive'));

  const playlistRange = buildDownloadArgs({
    ...base,
    mode: 'video',
    isPlaylist: true,
    video: { advanced: { playlistRange: '1-10' } }
  });
  assert.equal(valueAfter(playlistRange, '-I'), '1-10');
});

test('desempenho: ativa -N 4 por padrão, --http-chunk-size 10M, --buffer-size 1024K e filtro ba/b em áudio', () => {
  const audioArgs = buildDownloadArgs({ ...base, mode: 'audio', audio: { format: 'mp3' } });
  assert.equal(valueAfter(audioArgs, '-N'), '4');
  assert.equal(valueAfter(audioArgs, '--http-chunk-size'), '10M');
  assert.equal(valueAfter(audioArgs, '--buffer-size'), '1024K');
  assert.equal(valueAfter(audioArgs, '-f'), 'ba/b');

  const m4aArgs = buildDownloadArgs({ ...base, mode: 'audio', audio: { format: 'm4a' } });
  assert.equal(valueAfter(m4aArgs, '-f'), 'ba[ext=m4a]/ba/b');

  const disabledFrag = buildDownloadArgs({
    ...base,
    mode: 'video',
    video: { advanced: { concurrentFragments: false } }
  });
  assert.ok(!disabledFrag.includes('-N'));
});

test('resiliência a WinError 32: file-access-retries, retry-sleep e isolamento de tempDir', () => {
  const defaultArgs = buildDownloadArgs({ ...base, mode: 'audio' });
  assert.equal(valueAfter(defaultArgs, '--file-access-retries'), '10');
  assert.ok(defaultArgs.includes('file_access:linear=1::2'));

  const isolatedArgs = buildDownloadArgs({ ...base, mode: 'audio', tempDir: '/custom_temp' });
  assert.ok(isolatedArgs.includes('home:/dl'));
  assert.ok(isolatedArgs.includes('temp:/custom_temp'));
});


