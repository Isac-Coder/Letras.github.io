import { SEARCH_STORAGE_URL } from './constants.js';

export async function recordSongSearch(song) {
  if (!SEARCH_STORAGE_URL) {
    return null;
  }

  const title = song.title?.trim() || '';
  const artist = song.artist?.trim() || '';
  const titleLower = title.toLowerCase();
  const artistLower = artist.toLowerCase();
  const timestamp = new Date().toISOString();

  const queryParams = new URLSearchParams({ titleLower, artistLower });
  const searchUrl = `${SEARCH_STORAGE_URL}?${queryParams}`;
  const response = await fetch(searchUrl);
  if (!response.ok) {
    throw new Error('No se pudo leer el archivo de búsqueda.');
  }

  const existing = await response.json();
  if (existing.length > 0) {
    const record = existing[0];
    const nextCount = (record.count || 0) + 1;
    const patchResponse = await fetch(`${SEARCH_STORAGE_URL}/${record.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: nextCount, lastSearchedAt: timestamp })
    });

    if (!patchResponse.ok) {
      throw new Error('No se pudo actualizar el conteo de búsqueda.');
    }

    return nextCount;
  }

  const newRecord = {
    title,
    artist,
    query: `${title}${artist ? ` - ${artist}` : ''}`.trim(),
    titleLower,
    artistLower,
    count: 1,
    lastSearchedAt: timestamp
  };

  const postResponse = await fetch(SEARCH_STORAGE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newRecord)
  });

  if (!postResponse.ok) {
    throw new Error('No se pudo crear el registro de búsqueda.');
  }

  const created = await postResponse.json();
  return created.count || 1;
}
