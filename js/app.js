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

  let searchCountMessage = '';
  try {
    const count = await recordSongSearch({ title: query, artist: artistQuery });
    searchCountMessage = ` Esta búsqueda se ha realizado ${count} vez${count === 1 ? '' : 'es'}.`;
  } catch (err) {
    console.warn('No se pudo registrar la búsqueda:', err);
  }

  showMessage('Buscando canciones…');
  resetUiBeforeSearch();
  clearLyrics();

  try {
    // Si se proporcionó artista, intentamos obtener la letra directamente primero
    if (artistQuery) {
      try {
        const lyrics = await getLyrics(artistQuery, query);
        currentLyrics = lyrics;
        currentSong = { artist: artistQuery, title: query, titleShort: '', titleVersion: '' };

        showLyrics(currentSong, lyrics, 'Original');
        resetUiAfterLoad();
        showMessage(`Letra encontrada para "${query}" — mostrando opciones.${searchCountMessage}`);

        // Aun así mostramos sugerencias para que el usuario pueda elegir otras versiones
        const suggestions = await searchSongs(combinedQuery);
        if (suggestions.length) {
          renderSuggestions(suggestions, loadLyrics);
        }
        return;
      } catch (err) {
        // No se encontró letra con artista dado; continuamos con la búsqueda de sugerencias
      }
    }

    const suggestions = await searchSongs(combinedQuery);
    if (suggestions.length === 0) {
      showMessage(`No se encontraron canciones con ese nombre. Prueba otra búsqueda.${searchCountMessage}`);
      return;
    }

    renderSuggestions(suggestions, loadLyrics);
    showMessage(`Mostrando ${suggestions.length} resultados. Haz clic en "Ver letra".${searchCountMessage}`);
  } catch (error) {
    showMessage('Error al buscar canciones. Intenta más tarde.');
    console.error(error);
  }
});

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
