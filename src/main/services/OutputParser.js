const path = require('path');

/**
 * Parser especializado no processamento de saídas (stdout) do yt-dlp,
 * extraindo progresso, velocidade, ETA, caminhos de destino e status de pós-processamento.
 */
class OutputParser {
  /**
   * Extrai o caminho do arquivo final quando o yt-dlp emite mensagens de destino.
   * @param {string} line
   * @param {string} destDir
   * @returns {string|null}
   */
  static extractDestinationPath(line, destDir) {
    const destMatch = line.match(/(?:Destination:\s*|Merging formats into\s*["']?|Moving to\s*["']?)(.+?)(?:["']?\s*$)/i);
    if (destMatch && destMatch[1]) {
      const candidate = destMatch[1].replace(/["']/g, '').trim();
      if (
        !candidate.includes('.temp.') &&
        !candidate.includes('.part.') &&
        !candidate.endsWith('.temp') &&
        !candidate.endsWith('.part') &&
        !candidate.endsWith('.ytdl') &&
        !candidate.endsWith('.webp')
      ) {
        return path.isAbsolute(candidate) ? candidate : path.resolve(destDir, candidate);
      }
    }

    if (line.includes('has already been downloaded')) {
      const alreadyMatch = line.match(/\[download\]\s+(.+?)\s+has already been downloaded/i);
      if (alreadyMatch && alreadyMatch[1]) {
        const candidate = alreadyMatch[1].trim();
        return path.isAbsolute(candidate) ? candidate : path.resolve(destDir, candidate);
      }
    }

    return null;
  }

  /**
   * Extrai dados de progresso de uma linha de saída.
   * @param {string} line
   * @returns {{ percentNum: number|null, speed: string, eta: string, totalBytes: string } | null}
   */
  static parseProgressMetrics(line) {
    let percentNum = null;
    let speed = '--';
    let eta = '--';
    let totalBytes = '';

    // 1. Parser com prefixo customizado clipdrop_progress: ou download:
    if (line.includes('clipdrop_progress:') || line.startsWith('download:')) {
      const cleanLine = line.replace('clipdrop_progress:', '').replace('download:', '').trim();
      const parts = cleanLine.split('|');
      if (parts.length >= 3) {
        percentNum = parseFloat(parts[0].replace('%', '').trim());
        speed = parts[1].trim() || '--';
        eta = parts[2].trim() || '--';
        if (parts[3]) totalBytes = parts[3].trim();
      }
    } else {
      // 2. Parser padrão yt-dlp (ex.: 50.0%| 4.2MiB/s| 00:15 ou [download] 50.0% of ...)
      const pipeMatch = line.match(/^\s*(\d+(?:\.\d+)?)%\s*\|\s*([^|]+)\s*\|\s*([^|\r\n]+)(?:\|\s*([^|\r\n]+))?/);
      if (pipeMatch) {
        percentNum = parseFloat(pipeMatch[1]);
        speed = pipeMatch[2].trim() || '--';
        eta = pipeMatch[3].trim() || '--';
        if (pipeMatch[4]) totalBytes = pipeMatch[4].trim();
      } else {
        const stdMatch = line.match(/\[download\]\s+(\d+(?:\.\d+)?)%\s*(?:of\s+([^\s]+))?\s*(?:at\s+([^\s]+))?\s*(?:ETA\s+([^\s]+))?/i);
        if (stdMatch) {
          percentNum = parseFloat(stdMatch[1]);
          totalBytes = stdMatch[2] || '';
          speed = stdMatch[3] || '--';
          eta = stdMatch[4] || '--';
        }
      }
    }

    if (percentNum !== null && !isNaN(percentNum)) {
      return { percentNum, speed, eta, totalBytes };
    }
    return null;
  }

  /**
   * Identifica eventos de pós-processamento do ffmpeg/yt-dlp.
   * @param {string} line
   * @returns {{ status: string, percent: number, message: string } | null}
   */
  static parsePostProcessingStage(line) {
    if (line.includes('[ExtractAudio]')) {
      return { status: 'postprocessing', percent: 94, message: 'Convertendo e extraindo áudio...' };
    }
    if (line.includes('[EmbedThumbnail]') || line.includes('Converting thumbnail')) {
      return { status: 'postprocessing', percent: 97, message: 'Embutindo capa oficial...' };
    }
    if (line.includes('[Metadata]') || line.includes('Adding metadata')) {
      return { status: 'postprocessing', percent: 98, message: 'Gravando tags de metadados...' };
    }
    if (line.includes('[Merger]') || line.includes('Merging formats')) {
      return { status: 'merging', percent: 95, message: 'Unificando vídeo e áudio em alta qualidade...' };
    }
    if (line.includes('[EmbedChapters]') || line.includes('Adding chapters')) {
      return { status: 'postprocessing', percent: 97, message: 'Incrustando capítulos no vídeo...' };
    }
    if (line.includes('[EmbedSubtitle]') || line.includes('Embedding subtitles')) {
      return { status: 'postprocessing', percent: 96, message: 'Embutindo faixas de legendas...' };
    }
    if (line.includes('[VideoConvertor]') || line.includes('[VideoRemuxer]')) {
      return { status: 'postprocessing', percent: 95, message: 'Recodificando formato de vídeo...' };
    }
    if (line.includes('Downloading section')) {
      return { status: 'downloading', percent: 30, message: 'Baixando trecho selecionado (trim)...' };
    }
    return null;
  }
}

module.exports = OutputParser;
