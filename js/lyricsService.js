import { LYRIC_API_BASE, POPCAT_LYRICS_URL, YTMUSIC_SERVER_URL, SUGGESTION_LIMIT, REQUEST_TIMEOUT_MS, CACHE_TTL_MS, MAX_LYRIC_CANDIDATES } from './constants.js';

const searchCache = new Map();
const lyricsCache = new Map();
const inFlightSearch = new Map();
const inFlightLyrics = new Map();

function getCachedValue(cache, key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedValue(cache, key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS
  });
}

function createCacheKey(...parts) {
  return parts.map(part => (part || '').toString().trim().toLowerCase()).join('|');
}

function promiseAny(promises) {
  if (Promise.any) return Promise.any(promises);

  return new Promise((resolve, reject) => {
    const errors = [];
    let remaining = promises.length;

    if (remaining === 0) {
      reject(new Error('No hay promesas para resolver.'));
      return;
    }

    promises.forEach(promise => {
      Promise.resolve(promise).then(resolve, error => {
        errors.push(error);
        remaining -= 1;
        if (remaining === 0) {
          const aggregate = new Error('Todas las promesas fallaron.');
          aggregate.errors = errors;
          reject(aggregate);
        }
      });
    });
  });
}

async function fetchWithTimeout(url, options = {}) {
  const { timeout = REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('La petición tardó demasiado y fue cancelada.');
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
}

export async function searchSongs(query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const cacheKey = normalizedQuery.toLowerCase();
  const cached = getCachedValue(searchCache, cacheKey);
  if (cached) return cached;

  if (inFlightSearch.has(cacheKey)) {
    return inFlightSearch.get(cacheKey);
  }

  const promise = (async () => {
    const response = await fetchWithTimeout(`${LYRIC_API_BASE}/suggest/${encodeURIComponent(normalizedQuery)}`);
    if (!response.ok) throw new Error('No se pudo obtener resultados.');

    const data = await response.json();
    const results = (data.data || []).slice(0, SUGGESTION_LIMIT).map(item => ({
      artist: item.artist.name,
      title: item.title,
      titleShort: item.title_short || '',
      titleVersion: item.title_version || '',
      album: item.album?.title || '',
      preview: item.preview || ''
    }));

    setCachedValue(searchCache, cacheKey, results);
    return results;
  })();

  inFlightSearch.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightSearch.delete(cacheKey);
  }
}

export async function getLyrics(artist, title, titleShort = '', titleVersion = '') {
  const cacheKey = createCacheKey(artist, title, titleShort, titleVersion);
  const cached = getCachedValue(lyricsCache, cacheKey);
  if (cached) return cached;

  if (inFlightLyrics.has(cacheKey)) {
    return inFlightLyrics.get(cacheKey);
  }

  const promise = (async () => {
    const candidates = getUniqueCandidates(artist, title, titleShort, titleVersion).slice(0, MAX_LYRIC_CANDIDATES);
    const candidateRequests = candidates.map(candidate => fetchLyricsFromLyricApi(candidate).catch(error => {
      throw error;
    }));

    const fallbackRequests = [getLyricsFromFallback(artist, title), getLyricsFromYtMusic(artist, title)];
    const allRequests = [...candidateRequests, ...fallbackRequests];

    try {
      const lyrics = await promiseAny(allRequests);
      setCachedValue(lyricsCache, cacheKey, lyrics);
      return lyrics;
    } catch (aggregateError) {
      const errors = aggregateError.errors || [];
      const detail = errors.map(err => err?.message).filter(Boolean).join(' | ');
      throw new Error(`Letra no encontrada en ninguna fuente.${detail ? ' ' + detail : ''}`);
    }
  })();

  inFlightLyrics.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    inFlightLyrics.delete(cacheKey);
  }
}

async function fetchLyricsFromLyricApi(candidate) {
  const response = await fetchWithTimeout(`${LYRIC_API_BASE}/v1/${encodeURIComponent(candidate.artist)}/${encodeURIComponent(candidate.title)}`);
  if (!response.ok) {
    throw new Error('No se pudo obtener letra en la API principal.');
  }

  const data = await response.json();
  if (data.lyrics) {
    return data.lyrics.trim();
  }

  throw new Error('La API principal no devolvió letra para este candidato.');
}

async function getLyricsFromYtMusic(artist, title) {
  if (!YTMUSIC_SERVER_URL) {
    throw new Error('YTMUSIC server URL no configurada.');
  }
  const url = `${YTMUSIC_SERVER_URL}?artist=${encodeURIComponent(artist)}&title=${encodeURIComponent(title)}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error('No se pudo obtener la letra desde el servidor YTMusic.');
  }

  const data = await response.json();
  if (data.lyrics) return data.lyrics.trim();
  throw new Error('Servidor YTMusic no devolvió letra.');
}

async function getLyricsFromFallback(artist, title) {
  const url = `${POPCAT_LYRICS_URL}?song=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
  const response = await fetchWithTimeout(url);
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
