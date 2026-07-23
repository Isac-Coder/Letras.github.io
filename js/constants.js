// Translation providers removed from this project per request
export const LYRIC_API_BASE = 'https://api.lyrics.ovh';
export const POPCAT_LYRICS_URL = 'https://api.popcat.xyz/lyrics';
export const LRCLIB_API_BASE = 'https://lrclib.net';
const defaultSearchStorageUrl = import.meta.env.DEV
  ? 'http://127.0.0.1:3001/searches'
  : '/api/searches';
export const SEARCH_STORAGE_URL = import.meta.env.VITE_SEARCH_STORAGE_URL || defaultSearchStorageUrl;
export const SUGGESTION_LIMIT = 8;
export const REQUEST_TIMEOUT_MS = 10000;
export const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos 
export const MAX_LYRIC_CANDIDATES = 5;

