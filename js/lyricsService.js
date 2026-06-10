import { LYRIC_API_BASE, POPCAT_LYRICS_URL, YTMUSIC_SERVER_URL, SUGGESTION_LIMIT } from './constants.js';

export async function searchSongs(query) {
  const response = await fetch(`${LYRIC_API_BASE}/suggest/${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error('No se pudo obtener resultados.');
  const data = await response.json();

  if (!data.data || data.data.length === 0) return [];

  return data.data.slice(0, SUGGESTION_LIMIT).map(item => ({
    artist: item.artist.name,
    title: item.title,
    titleShort: item.title_short || '',
    titleVersion: item.title_version || '',
    album: item.album?.title || '',
    preview: item.preview || ''
  }));
}

export async function getLyrics(artist, title, titleShort = '', titleVersion = '') {
  const candidates = getUniqueCandidates(artist, title, titleShort, titleVersion);

  for (const candidate of candidates) {
    try {
      const response = await fetch(`${LYRIC_API_BASE}/v1/${encodeURIComponent(candidate.artist)}/${encodeURIComponent(candidate.title)}`);
      if (!response.ok) {
        continue;
      }

      const data = await response.json();
      if (data.lyrics) {
        return data.lyrics.trim();
      }
    } catch (error) {
      console.warn('Lyrics.ovh lookup failed for candidate:', candidate, error);
      continue;
    }
  }

  try {
    return await getLyricsFromFallback(artist, title);
  } catch (error) {
    console.warn('Fallback lyrics provider failed:', error);
  }

  // Intentar servidor local que use ytmusicapi (opcional)
  try {
    const ytm = await getLyricsFromYtMusic(artist, title);
    if (ytm) return ytm;
  } catch (err) {
    console.warn('YTMUSIC server lookup failed:', err);
  }

  throw new Error('Letra no encontrada en la API de letras. Prueba con otra canción o selecciona otro resultado.');
}

async function getLyricsFromYtMusic(artist, title) {
  if (!YTMUSIC_SERVER_URL) throw new Error('YTMUSIC server URL no configurada.');
  const url = `${YTMUSIC_SERVER_URL}?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('No se pudo obtener la letra desde el servidor YTMusic.');
  }
  const data = await response.json();
  if (data.lyrics) return data.lyrics.trim();
  throw new Error('Servidor YTMusic no devolvió letra.');
}

async function getLyricsFromFallback(artist, title) {
  const url = `${POPCAT_LYRICS_URL}?song=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('No se pudo obtener la letra del proveedor de respaldo.');
  }

  const data = await response.json();
  if (data.lyrics) {
    return data.lyrics.trim();
  }

  throw new Error('Proveedor de respaldo no devolvió la letra.');
}

function getUniqueCandidates(artist, title, titleShort, titleVersion) {
  const artistVariants = [artist, normalizeArtist(artist), simplifyArtist(artist)]
    .filter(Boolean);

  const titleVariants = [title, titleShort, titleVersion]
    .filter(Boolean)
    .flatMap(t => [t, normalizeTitle(t), simplifyTitle(t)])
    .filter(Boolean);

  const rawCandidates = [];
  for (const candidateArtist of artistVariants) {
    for (const candidateTitle of titleVariants) {
      rawCandidates.push({ artist: candidateArtist, title: candidateTitle });
    }
  }

  const seen = new Set();
  return rawCandidates.filter(candidate => {
    const key = `${candidate.artist.toLowerCase()}|${candidate.title.toLowerCase()}`;
    if (seen.has(key) || !candidate.artist || !candidate.title) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function normalizeArtist(artist) {
  return artist
    .replace(/\s*\(.*\)\s*/g, '')
    .replace(/feat\.?|ft\.?/gi, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeTitle(title) {
  return title
    .replace(/\s*\(.*\)\s*/g, '')
    .replace(/\s*\[.*\]\s*/g, '')
    .replace(/\s+-\s+.*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function simplifyArtist(artist) {
  return artist
    .split(/,|&|feat\.?|ft\.?/i)[0]
    .trim();
}

function simplifyTitle(title) {
  return title
    .split(/\(|\[/)[0]
    .replace(/\s+-\s+.*$/g, '')
    .trim();
}
