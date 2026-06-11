import { SEARCH_STORAGE_URL } from './constants.js';

const STORAGE_KEY_PREFIX = 'search-count:';

export async function recordSongSearch(song) {
  const title = song.title?.trim() || '';
  const artist = song.artist?.trim() || '';
  const key = `${STORAGE_KEY_PREFIX}${title.toLowerCase()}|${artist.toLowerCase()}`;

  let count = Number(localStorage.getItem(key) || 0) + 1;
  localStorage.setItem(key, String(count));

  if (!SEARCH_STORAGE_URL) {
    return count;
  }

  try {
    const response = await fetch(SEARCH_STORAGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        artist,
        timestamp: new Date().toISOString(),
        count
      })
    });

    if (!response.ok) {
      console.warn('No se pudo enviar la búsqueda al webhook de hoja de cálculo.', response.status);
      return count;
    }

    const data = await response.json().catch(() => null);
    if (data?.count && Number(data.count) > count) {
      count = Number(data.count);
      localStorage.setItem(key, String(count));
    }
  } catch (error) {
    console.warn('Error al enviar búsqueda al webhook de hoja de cálculo.', error);
  }

  return count;
}
