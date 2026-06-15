import { searchForm, queryInput, artistInput, clearButton, copyButton } from './dom.js';
import { searchSongs, getLyrics } from './lyricsService.js';
import { recordSongSearch } from './searchStorage.js';
import {
  renderSuggestions,
  showMessage,
  showLyrics,
  setCopyButtonState,
  resetUiAfterLoad,
  resetUiBeforeSearch
} from './ui.js';

let currentLyrics = '';
let currentSong = null;

searchForm.addEventListener('submit', async event => {
  event.preventDefault();
  const query = queryInput.value.trim();
  const artistQuery = artistInput.value.trim();
  const combinedQuery = artistQuery ? `${query} ${artistQuery}` : query;

  if (!query) {
    showMessage('Escribe el nombre de una canción o artista para buscar.');
    return;
  }

  showMessage('Buscando canciones…');
  resetUiBeforeSearch();
  clearLyrics();

  const recordPromise = recordSongSearch({ title: query, artist: artistQuery })
    .catch(err => {
      console.warn('No se pudo registrar la búsqueda:', err);
      return null;
    });

  try {
    if (artistQuery) {
      const suggestionsPromise = searchSongs(combinedQuery);
      const lyricsPromise = getLyrics(artistQuery, query);

      const [lyricsResult, suggestionsResult] = await Promise.allSettled([lyricsPromise, suggestionsPromise]);

      const suggestions = suggestionsResult.status === 'fulfilled' ? suggestionsResult.value : [];
      if (suggestions.length) {
        renderSuggestions(suggestions, loadLyrics);
      }

      if (lyricsResult.status === 'fulfilled') {
        const lyrics = lyricsResult.value;
        currentLyrics = lyrics;
        currentSong = { artist: artistQuery, title: query, titleShort: '', titleVersion: '' };

        showLyrics(currentSong, lyrics, 'Original');
        resetUiAfterLoad();
        showMessage(`Letra encontrada para "${query}" — mostrando opciones.${await getSearchCountMessage(recordPromise)}`);
        return;
      }

      if (suggestions.length) {
        showMessage(`No se encontró la letra exacta, pero hay opciones relacionadas.${await getSearchCountMessage(recordPromise)}`);
        return;
      }
    }

    const suggestions = await searchSongs(combinedQuery);
    if (suggestions.length === 0) {
      showMessage(`No se encontraron canciones con ese nombre. Prueba otra búsqueda.${await getSearchCountMessage(recordPromise)}`);
      return;
    }

    renderSuggestions(suggestions, loadLyrics);
    showMessage(`Mostrando ${suggestions.length} resultados. Haz clic en "Ver letra".${await getSearchCountMessage(recordPromise)}`);
  } catch (error) {
    showMessage('Error al buscar canciones. Intenta más tarde.');
    console.error(error);
  }
});

async function getSearchCountMessage(recordPromise) {
  const count = await recordPromise;
  if (!count) return '';
  return ` Esta búsqueda se ha realizado ${count} vez${count === 1 ? '' : 'es'}.`;
}

async function loadLyrics(song) {
  showMessage(`Cargando letra de "${song.title}"...`);

  try {
    const lyrics = await getLyrics(song.artist, song.title, song.titleShort, song.titleVersion);
    currentLyrics = lyrics;
    currentSong = song;

    showLyrics(song, lyrics, 'Original');
    resetUiAfterLoad();
    showMessage('Letra cargada. Usa el botón copiar para guardar la letra en el portapapeles.');
  } catch (error) {
    currentLyrics = '';
    currentSong = null;
    showMessage('No se encontró la letra de esa canción.');
    if (!error.message.includes('Letra no encontrada')) {
      console.error(error);
    }
  }
}

copyButton.addEventListener('click', async () => {
  const source = currentLyrics;
  if (!source) return;

  const formatted = formatLyricsWithTimestamps(source);

  try {
    await navigator.clipboard.writeText(formatted);
    showMessage('Letra copiada con formato de timestamps.');
  } catch (error) {
    showMessage('No se pudo copiar al portapapeles. Usa Ctrl+C manualmente.');
    console.error(error);
  }
});

clearButton.addEventListener('click', () => {
  resetUiBeforeSearch();
  clearLyrics();
  queryInput.value = '';
  artistInput.value = '';
  showMessage('Búsqueda reiniciada.');
});

function formatLyricsWithTimestamps(text) {
  const lines = text.split(/\r?\n/);
  return lines.map((line, index) => `${formatTimestamp(index * 3)} ${line}`).join('\n');
}

function formatTimestamp(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const frac = Math.round((seconds - Math.floor(seconds)) * 100).toString().padStart(2, '0');
  return `[${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${frac}]`;
}

function clearLyrics() {
  currentLyrics = '';
  currentSong = null;
  showLyrics({ title: 'Sin letra cargada', artist: '' }, 'Busca una canción y haz clic en "Ver letra" para cargar la letra aquí.', 'Original');
  setCopyButtonState(false);
}

window.addEventListener('DOMContentLoaded', () => {
  clearLyrics();
  showMessage('Escribe una canción o nombre de artista y presiona Buscar.');
});
