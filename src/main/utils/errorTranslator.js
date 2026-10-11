const SUBTITLE_ERROR_MESSAGE =
  'Não foi possível obter legendas para este vídeo (o YouTube restringiu as legendas automáticas temporariamente). O download continuará sem elas.';

/**
 * Traduz saídas de erro brutas do yt-dlp em mensagens amigáveis em português para o usuário.
 * @param {string|Buffer} stderr
 * @returns {string}
 */
function translateError(stderr) {
  const full = (stderr || '').toString();
  // Avisos (WARNING) também citam 429 em falhas de legenda; classifica só pelas linhas ERROR.
  const errorLines = full.split(/\r?\n/).filter((l) => l.startsWith('ERROR:'));
  const raw = errorLines.length ? errorLines.join('\n') : full;
  if (full.trim()) console.error('[yt-dlp stderr]', full.trim());
  if (!raw.trim()) return 'Ocorreu um erro inesperado durante a operação.';

  if (raw.includes('Unable to download video subtitles')) {
    return SUBTITLE_ERROR_MESSAGE;
  }
  if (raw.includes('Private video') || raw.includes('This video is private')) {
    return 'Este vídeo é privado e requer autorização para ser acessado.';
  }
  if (raw.includes('Video unavailable') || raw.includes('has been removed')) {
    return 'Este conteúdo não está mais disponível ou foi removido da plataforma.';
  }
  if (raw.includes('Sign in to confirm your age') || raw.includes('age-gated')) {
    return 'Este vídeo requer autenticação de idade na plataforma.';
  }
  if (raw.includes('is not a valid URL') || raw.includes('Unsupported URL')) {
    return 'O link informado é inválido ou não pertence a uma plataforma suportada.';
  }
  if (raw.includes('Geo-restricted') || raw.includes('not available in your country')) {
    return 'Este conteúdo possui restrição geográfica para a sua região.';
  }
  if (raw.includes('HTTP Error 429') || raw.includes('Too Many Requests')) {
    return 'Muitas requisições enviadas à plataforma. Aguarde alguns minutos e tente novamente.';
  }
  if (raw.includes('Unable to download API page') || raw.includes('Network is unreachable')) {
    return 'Falha na conexão com a internet ou servidor do serviço indisponível.';
  }
  if (raw.includes('ffmpeg not found') || raw.includes('ffprobe not found')) {
    return 'O conversor multimídia (ffmpeg) está ausente e não foi possível instalá-lo automaticamente. Verifique sua conexão com a internet ou tente instalá-lo manualmente.';
  }
  if (raw.includes('WinError 32') || raw.includes('used by another process') || raw.includes('sendo usado por outro processo')) {
    return 'O arquivo temporário estava em uso pelo sistema operacional ou antivírus. Tente novamente em instantes.';
  }
  if (raw.includes('Requested format is not available')) {
    return 'A qualidade ou formato solicitado não está disponível nesta plataforma para este vídeo. Tente selecionar "Melhor qualidade" ou alterar o formato.';
  }

  // Se houver uma linha iniciada por "ERROR:", extrai o resumo limpo
  const errorMatch = raw.match(/ERROR:\s*([^\r\n]+)/);
  if (errorMatch && errorMatch[1]) {
    return `Erro: ${errorMatch[1].trim()}`;
  }

  return 'Não foi possível processar este link. Verifique se o endereço está correto e ativo.';
}

module.exports = {
  SUBTITLE_ERROR_MESSAGE,
  translateError
};
