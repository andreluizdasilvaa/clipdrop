/**
 * Utilitários para higienização, identificação e formatação de links e mídias.
 */

/**
 * Remove parâmetros de rastreamento do YouTube (?si, ?feature, etc.)
 * e listas automáticas de rádio que sobrecarregam requisições.
 * @param {string} rawUrl
 * @returns {string}
 */
function sanitizeUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  try {
    const u = new URL(rawUrl.trim());
    const host = u.hostname.toLowerCase();
    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      u.searchParams.delete('si');
      u.searchParams.delete('feature');
      u.searchParams.delete('pp');
      // Se for vídeo individual com mix automático (RD...), remove o mix para não carregar rádio inteira
      if (u.searchParams.has('v') && u.searchParams.get('list')?.startsWith('RD')) {
        u.searchParams.delete('list');
        u.searchParams.delete('start_radio');
        u.searchParams.delete('index');
      }
    }
    return u.toString();
  } catch (_) {
    return rawUrl.trim();
  }
}

/**
 * Detecta se a URL aponta para um vídeo individual do YouTube.
 * @param {string} urlStr
 * @returns {boolean}
 */
function isSingleYouTubeVideo(urlStr) {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (u.pathname === '/playlist' && u.searchParams.has('list')) {
      return false;
    }
    if (host.includes('youtu.be') && u.pathname.length > 1) {
      return true;
    }
    if (host.includes('youtube.com')) {
      if (u.pathname.startsWith('/shorts/') && u.pathname.length > 8) {
        return true;
      }
      if (u.searchParams.has('v')) {
        return !u.searchParams.has('list');
      }
    }
    return false;
  } catch (_) {
    return false;
  }
}

/**
 * Formata segundos em string amigável HH:MM:SS ou MM:SS.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!seconds || isNaN(seconds)) return '--:--';
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

module.exports = {
  sanitizeUrl,
  isSingleYouTubeVideo,
  formatDuration
};
