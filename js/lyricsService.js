import { LYRIC_API_BASE, POPCAT_LYRICS_URL, LRCLIB_API_BASE, SUGGESTION_LIMIT, REQUEST_TIMEOUT_MS, CACHE_TTL_MS, MAX_LYRIC_CANDIDATES } from './constants.js';

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

async function fetchJsonWithRetries(url, options = {}, retries = 2, backoff = 300) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (!response.ok) {
        const message = `HTTP ${response.status} ${response.statusText}`;
        throw new Error(message);
      }
      const data = await response.json();
      console.debug('fetchJsonWithRetries success', { url, attempt });
      return data;
    } catch (err) {
      console.warn(`fetchJsonWithRetries attempt ${attempt + 1} failed for ${url}:`, err.message);
      if (attempt === retries) throw err;
      await new Promise(res => setTimeout(res, backoff * (attempt + 1)));
    }
  }
}

export async function searchSongs(query, artist = '') {
  const normalizedQuery = query.trim();
  const normalizedArtist = artist.trim();
  if (!normalizedQuery) return [];

  const cacheKey = [normalizedQuery, normalizedArtist].filter(Boolean).join('|').toLowerCase();
  const cached = getCachedValue(searchCache, cacheKey);
  if (cached) return cached;

  if (inFlightSearch.has(cacheKey)) {
    return inFlightSearch.get(cacheKey);
  }

  const promise = (async () => {
    const lrclibResults = await searchLrclib(normalizedQuery, normalizedArtist);
    if (lrclibResults.length) {
      setCachedValue(searchCache, cacheKey, lrclibResults);
      return lrclibResults;
    }

    let data;
    try {
      data = await fetchJsonWithRetries(`${LYRIC_API_BASE}/suggest/${encodeURIComponent(normalizedQuery)}`);
    } catch (err) {
      console.error('searchSongs: fallo al obtener sugerencias desde el proveedor principal:', err.message);
      const fallback = await fallbackSuggest(normalizedQuery);
      if (fallback && fallback.length) {
        console.info('searchSongs: usando sugerencia de fallback', { query: normalizedQuery });
        setCachedValue(searchCache, cacheKey, fallback);
        return fallback;
      }
      return [];
    }

    const rawResults = (data.data || []).map(item => ({
      artist: item.artist.name,
      title: item.title,
      titleShort: item.title_short || '',
      titleVersion: item.title_version || '',
      album: item.album?.title || '',
      preview: item.preview || '',
      provider: 'lyricsovh'
    }));

    const results = rawResults
      .map(item => ({
        ...item,
        score: getSuggestionScore(normalizedQuery, item)
      }))
      .sort((a, b) => a.score - b.score)
      .slice(0, SUGGESTION_LIMIT)
      .map(({ score, ...item }) => item);

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

async function searchLrclib(query, artist = '') {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (artist) params.set('artist_name', artist);

  const url = `${LRCLIB_API_BASE}/api/search?${params.toString()}`;
  try {
    const data = await fetchJsonWithRetries(url);
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    return data.slice(0, SUGGESTION_LIMIT).map(item => ({
      id: item.id,
      artist: item.artistName || '',
      title: item.trackName || '',
      titleShort: '',
      titleVersion: '',
      album: item.albumName || '',
      preview: '',
      provider: 'lrclib',
      duration: item.duration || 0,
      plainLyrics: item.plainLyrics || '',
      syncedLyrics: item.syncedLyrics || ''
    }));
  } catch (error) {
    console.warn('searchLrclib: fallo al consultar LRCLIB', error.message);
    return [];
  }
}

async function fallbackSuggest(query) {
  // Helper: try POPCAT lyrics provider for a specific artist/title
  const tryPopcat = async (artist, title) => {
    const url = `${POPCAT_LYRICS_URL}?song=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist || '')}`;
    try {
      const data = await fetchJsonWithRetries(url);
      if (data && data.lyrics) {
        return [{
          artist: artist || '',
          title: title,
          titleShort: '',
          titleVersion: '',
          album: '',
          preview: '',
          provider: 'popcat'
        }];
      }
    } catch (err) {
      // ignore
    }
    return null;
  };

  // Helper: query Deezer search API
  const tryDeezer = async q => {
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(q)}&limit=${SUGGESTION_LIMIT}`;
    try {
      const data = await fetchJsonWithRetries(url);
      const list = (data && data.data) || [];
      if (!list.length) return null;
      return list.map(item => ({
        artist: item.artist?.name || '',
        title: item.title || item.track_title || '',
        titleShort: '',
        titleVersion: '',
        album: item.album?.title || '',
        preview: item.preview || '',
        provider: 'deezer'
      }));
    } catch (err) {
      return null;
    }
  };

  // Helper: query iTunes Search API
  const tryItunes = async q => {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=${SUGGESTION_LIMIT}`;
    try {
      const data = await fetchJsonWithRetries(url);
      const list = (data && data.results) || [];
      if (!list.length) return null;
      return list.map(item => ({
        artist: item.artistName || '',
        title: item.trackName || '',
        titleShort: '',
        titleVersion: '',
        album: item.collectionName || '',
        preview: item.previewUrl || '',
        provider: 'itunes'
      }));
    } catch (err) {
      return null;
    }
  };

  // Try structured forms first (common separators)
  const tryStructured = async (a, t) => {
    const pop = await tryPopcat(a, t);
    if (pop && pop.length) return pop;
    const dee = await tryDeezer(`${a} ${t}`);
    if (dee && dee.length) return dee;
    const it = await tryItunes(`${a} ${t}`);
    if (it && it.length) return it;
    return null;
  };

  // split on ' - ' which is common format
  if (query.includes(' - ')) {
    const parts = query.split(' - ').map(p => p.trim());
    if (parts.length === 2) {
      let res = await tryStructured(parts[0], parts[1]);
      if (res) return res;
      res = await tryStructured(parts[1], parts[0]);
      if (res) return res;
    }
  }

  // Try ' by ' pattern: "Title by Artist"
  if (query.toLowerCase().includes(' by ')) {
    const parts = query.split(/ by /i).map(p => p.trim());
    if (parts.length === 2) {
      const res = await tryStructured(parts[1], parts[0]);
      if (res) return res;
    }
  }

  try {
    const pop = await tryPopcat('', query);
    if (pop && pop.length) return pop;
  } catch (e) {}

  const dee = await tryDeezer(query);
  if (dee && dee.length) return dee;

  const it = await tryItunes(query);
  if (it && it.length) return it;

  return [];
}

export async function getLyrics(artist, title, titleShort = '', titleVersion = '', lrclibId = null, lrclibPlainLyrics = '') {
  const cacheKey = createCacheKey(artist, title, titleShort, titleVersion, lrclibId);
  const cached = getCachedValue(lyricsCache, cacheKey);
  if (cached) return cached;

  if (inFlightLyrics.has(cacheKey)) {
    return inFlightLyrics.get(cacheKey);
  }

  const promise = (async () => {
    if (lrclibId && lrclibPlainLyrics) {
      const lyrics = lrclibPlainLyrics.trim();
      setCachedValue(lyricsCache, cacheKey, lyrics);
      return lyrics;
    }

    const candidates = getUniqueCandidates(artist, title, titleShort, titleVersion).slice(0, MAX_LYRIC_CANDIDATES);
    const candidateRequests = candidates.map(candidate => fetchLyricsFromLyricApi(candidate).catch(error => {
      throw error;
    }));

    const fallbackRequests = [
      ...(lrclibId ? [getLyricsFromLrclibById(lrclibId)] : []),
      getLyricsFromFallback(artist, title)
    ];
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

async function getLyricsFromLrclibById(id) {
  if (!id) {
    throw new Error('No se proporcionó ID de LRCLIB.');
  }
  const response = await fetchWithTimeout(`${LRCLIB_API_BASE}/api/get/${encodeURIComponent(id)}`);
  if (!response.ok) {
    throw new Error('No se pudo obtener la letra desde LRCLIB.');
  }

  const data = await response.json();
  if (data && data.plainLyrics) {
    return data.plainLyrics.trim();
  }
  throw new Error('LRCLIB no devolvió letra.');
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

function normalizeText(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function getSuggestionScore(query, song) {
  const normalizedQuery = normalizeText(query);
  const normalizedTitle = normalizeText(song.title);
  const normalizedArtist = normalizeText(song.artist);
  const combined = normalizeText(`${song.artist} ${song.title}`);

  const queryDistance = computeLevenshteinDistance(normalizedQuery, combined);
  const titleDistance = computeLevenshteinDistance(normalizedQuery, normalizedTitle);
  const artistDistance = computeLevenshteinDistance(normalizedQuery, normalizedArtist);

  return Math.min(queryDistance, titleDistance + 1, artistDistance + 1);
}

function computeLevenshteinDistance(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}
