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
  assert.equal(valueAfter(args, '--download-archive'), path.join('/dl', '.archive.txt'));
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

test('áudio com SponsorBlock remove sponsor,intro,outro', () => {
  const args = buildDownloadArgs({ ...base, mode: 'audio', audio: { sponsorblock: true } });
  assert.equal(valueAfter(args, '--sponsorblock-remove'), 'sponsor,intro,outro');
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
  assert.equal(valueAfter(pt, '--sub-langs'), 'pt.*');
  assert.ok(pt.includes('--embed-subs'));

  const en = buildDownloadArgs({
    ...base, mode: 'video', video: { subtitles: { enabled: true, lang: 'en' } }
  });
  assert.equal(valueAfter(en, '--sub-langs'), 'en.*');
});

test('vídeo: SponsorBlock remove vs marcar e categorias', () => {
  const remove = buildDownloadArgs({
    ...base, mode: 'video',
    video: { sponsorblock: { sponsor: true, introOutro: true, selfpromo: true, mode: 'remove' } }
  });
  assert.equal(valueAfter(remove, '--sponsorblock-remove'), 'sponsor,intro,outro,selfpromo');

  const mark = buildDownloadArgs({
    ...base, mode: 'video',
    video: { sponsorblock: { selfpromo: true, mode: 'mark' } }
  });
  assert.equal(valueAfter(mark, '--sponsorblock-mark'), 'selfpromo');
  assert.ok(!mark.includes('--sponsorblock-remove'));

  const none = buildDownloadArgs({ ...base, mode: 'video', video: { sponsorblock: { mode: 'remove' } } });
  assert.ok(!none.includes('--sponsorblock-remove'));
  assert.ok(!none.includes('--sponsorblock-mark'));
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
