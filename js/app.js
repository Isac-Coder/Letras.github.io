import {
  searchForm,
  queryInput,
  artistInput,
  clearButton,
  copyButton,
  playButton,
  topSongsToggleButton,
  topSongsPanel,
  topSongsOverlay,
  closeTopSongsButton
} from './dom.js';
import { searchSongs, getLyrics, getSongPreview } from './lyricsService.js';
import { recordSongSearch, fetchTopSongs } from './searchStorage.js';
import {
  renderSuggestions,
  renderTopSongs,
  showMessage,
  showLyrics,
  showProviderNotice,
  setCopyButtonState,
  setPlayButtonState,
  resetUiAfterLoad,
  resetUiBeforeSearch,
  setSearchState,
  showLoadingSkeleton,
  clearLoadingSkeleton
} from './ui.js';


let currentLyrics = '';
let currentSong = null;
let audioPlayer = null;
let isPlayingPreview = false;
let previewTimerId = null;
let topSongsLoaded = false;
let topSongsRefreshTimer = null;

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
  showLoadingSkeleton(4);
  setSearchState('loading');

  const recordPromise = recordSongSearch({ title: query, artist: artistQuery })
    .catch(err => {
      console.warn('No se pudo registrar la búsqueda:', err);
      return null;
    });

  try {
    if (artistQuery) {
      const suggestionsPromise = searchSongs(query, artistQuery);
      const lyricsPromise = getLyrics(artistQuery, query);

      const [lyricsResult, suggestionsResult] = await Promise.allSettled([lyricsPromise, suggestionsPromise]);

      const suggestions = suggestionsResult.status === 'fulfilled' ? suggestionsResult.value : [];
      if (suggestions.length) {
        clearLoadingSkeleton();
        renderSuggestions(suggestions, loadLyrics);
        setSearchState('success');
        const providerMessage = getProviderNotice(suggestions);
        if (providerMessage) showProviderNotice(providerMessage);
      }

      if (lyricsResult.status === 'fulfilled') {
        const lyrics = lyricsResult.value;
        currentLyrics = lyrics;
        const previewSong = { artist: artistQuery, title: query, titleShort: '', titleVersion: '' };
        const previewUrl = await getSongPreview(artistQuery, query);
        currentSong = previewUrl ? { ...previewSong, preview: previewUrl } : previewSong;

        showLyrics(currentSong, lyrics, 'Original');
        resetUiAfterLoad();
        configurePreviewButton(currentSong);
        return;
      }
    }

    const suggestions = await searchSongs(query, artistQuery);
    if (suggestions.length === 0) {
      clearLoadingSkeleton();
      setSearchState('no-results');
      showMessage(`No se encontraron canciones con ese nombre. Prueba otra búsqueda.${await getSearchCountMessage(recordPromise)}`);
      return;
    }

    clearLoadingSkeleton();
    renderSuggestions(suggestions, loadLyrics);
    setSearchState('success');
    const providerMessage = getProviderNotice(suggestions);
    if (providerMessage) showProviderNotice(providerMessage);
    const correctionHint = getCorrectionHint(query, artistQuery, suggestions[0]);
    showMessage(`${correctionHint} Mostrando ${suggestions.length} resultados. Haz clic en "Ver letra".${await getSearchCountMessage(recordPromise)}`);
  } catch (error) {
    clearLoadingSkeleton();
    setSearchState('error');
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
    const lyrics = await getLyrics(
      song.artist,
      song.title,
      song.titleShort,
      song.titleVersion,
      song.id || null,
      song.plainLyrics || ''
    );
    currentLyrics = lyrics;
    const previewUrl = song.preview || await getSongPreview(song.artist, song.title);
    currentSong = previewUrl ? { ...song, preview: previewUrl } : song;

    showLyrics(currentSong, lyrics, 'Original');
    resetUiAfterLoad();
    configurePreviewButton(currentSong);
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
  stopPreview();
  setSearchState(null);
  showMessage('Búsqueda reiniciada.');
});

if (topSongsToggleButton) {
  topSongsToggleButton.addEventListener('click', async () => {
    openTopSongsPanel();
    if (!topSongsLoaded) {
      await loadTopSongs();
    }
  });
}

if (closeTopSongsButton) {
  closeTopSongsButton.addEventListener('click', closeTopSongsPanel);
}

if (topSongsOverlay) {
  topSongsOverlay.addEventListener('click', closeTopSongsPanel);
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeTopSongsPanel();
  }
});

playButton.addEventListener('click', () => {
  if (!currentSong || !audioPlayer) return;
  if (audioPlayer.paused) {
    startPreview();
  } else {
    pausePreview();
  }
});

function openTopSongsPanel() {
  document.body.classList.add('top-songs-open');
  if (topSongsToggleButton) {
    topSongsToggleButton.setAttribute('aria-expanded', 'true');
  }
  if (topSongsPanel) {
    topSongsPanel.setAttribute('aria-hidden', 'false');
  }
  if (topSongsOverlay) {
    topSongsOverlay.setAttribute('aria-hidden', 'false');
  }
}

function closeTopSongsPanel() {
  document.body.classList.remove('top-songs-open');
  if (topSongsToggleButton) {
    topSongsToggleButton.setAttribute('aria-expanded', 'false');
  }
  if (topSongsPanel) {
    topSongsPanel.setAttribute('aria-hidden', 'true');
  }
  if (topSongsOverlay) {
    topSongsOverlay.setAttribute('aria-hidden', 'true');
  }
}

function clearTopSongsRefreshTimer() {
  if (topSongsRefreshTimer) {
    window.clearTimeout(topSongsRefreshTimer);
    topSongsRefreshTimer = null;
  }
}

async function loadTopSongs() {
  renderTopSongs([], 'Cargando canciones más escuchadas...');

  try {
    const songs = await fetchTopSongs();
    renderTopSongs(songs);
    topSongsLoaded = true;
    scheduleTopSongsRefresh(songs);
  } catch (error) {
    console.error(error);
    renderTopSongs([], 'No se pudieron cargar las canciones más escuchadas.');
  }
}

function scheduleTopSongsRefresh(songs) {
  if (topSongsRefreshTimer) {
    window.clearTimeout(topSongsRefreshTimer);
  }

  const hasTies = songs.some((song, index) => songs.slice(index + 1).some(other => other.count === song.count));
  if (!hasTies) {
    return;
  }

  topSongsRefreshTimer = window.setTimeout(async () => {
    await loadTopSongs();
  }, 15_000);
}

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
  setPlayButtonState(false);
}

function configurePreviewButton(song) {
  const hasPreview = Boolean(song.preview);
  setPlayButtonState(hasPreview);
  if (hasPreview) {
    if (!audioPlayer || audioPlayer.src !== song.preview) {
      stopPreview();
      audioPlayer = new Audio(song.preview);
      audioPlayer.preload = 'metadata';
      audioPlayer.addEventListener('ended', handlePreviewEnded);
      audioPlayer.addEventListener('pause', () => {
        isPlayingPreview = false;
        playButton.textContent = 'Reproducir preview';
        clearPreviewTimeout();
      });
      audioPlayer.addEventListener('loadedmetadata', () => {
        if (isPlayingPreview) {
          schedulePreviewTimeout();
        }
      });
    }
  } else {
    stopPreview();
  }
}

function startPreview() {
  if (!audioPlayer) return;
  audioPlayer.play().then(() => {
    isPlayingPreview = true;
    playButton.textContent = 'Pausar preview';
    schedulePreviewTimeout();
  }).catch(err => {
    console.warn('No se pudo reproducir el preview:', err);
    showMessage('No se pudo reproducir el preview de audio.');
  });
}

function pausePreview() {
  if (!audioPlayer) return;
  audioPlayer.pause();
  isPlayingPreview = false;
  playButton.textContent = 'Reproducir preview';
  clearPreviewTimeout();
}

function stopPreview() {
  if (!audioPlayer) return;
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  isPlayingPreview = false;
  playButton.textContent = 'Reproducir preview';
  clearPreviewTimeout();
}

function schedulePreviewTimeout() {
  clearPreviewTimeout();
  const maxDuration = 30;
  const duration = Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0 ? Math.min(audioPlayer.duration, maxDuration) : maxDuration;
  const remaining = Math.max(0, duration - audioPlayer.currentTime);
  previewTimerId = window.setTimeout(() => {
    stopPreview();
  }, remaining * 1000);
}

function clearPreviewTimeout() {
  if (previewTimerId) {
    window.clearTimeout(previewTimerId);
    previewTimerId = null;
  }
}


function handlePreviewEnded() {
  isPlayingPreview = false;
  playButton.textContent = 'Reproducir preview';
  clearPreviewTimeout();
}

function getCorrectionHint(query, artist, firstSuggestion) {
  if (!firstSuggestion) return '';

  const normalizedQuery = normalizeText(query);
  const normalizedSuggestion = normalizeText(firstSuggestion.title);
  const normalizedArtist = normalizeText(artist);
  const normalizedArtistSuggestion = normalizeText(firstSuggestion.artist);

  const titleDistance = computeLevenshteinDistance(normalizedQuery, normalizedSuggestion);
  const artistDistance = artist ? computeLevenshteinDistance(normalizedArtist, normalizedArtistSuggestion) : 0;

  const titleHint = titleDistance > 0 && titleDistance <= 4 && normalizedQuery !== normalizedSuggestion
    ? `¿Querías decir "${firstSuggestion.title}"?`
    : '';

  const artistHint = artist && artistDistance > 0 && artistDistance <= 4 && normalizedArtist !== normalizedArtistSuggestion
    ? ` Artista sugerido: "${firstSuggestion.artist}".`
    : '';

  return titleHint || artistHint ? `${titleHint}${artistHint}` : '';
}

function normalizeText(text) {
  return (text || '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/g, ' ')
    .replace(/\s+/g, ' ');
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

function getProviderNotice(suggestions) {
  const providers = Array.from(new Set(suggestions
    .filter(song => song.provider)
    .map(song => song.provider)));

  if (providers.length === 0) return null;

  const providerLabels = providers.map(provider => {
    if (provider === 'popcat') return 'PopCat';
    if (provider === 'deezer') return 'Deezer';
    if (provider === 'itunes') return 'iTunes';
    return provider;
  });

  return `Resultados obtenidos desde ${providerLabels.join(', ')}.`;
}

window.addEventListener('DOMContentLoaded', () => {
  clearLyrics();
  showMessage('Escribe una canción o nombre de artista y presiona Buscar.');
});

window.addEventListener('beforeunload', clearTopSongsRefreshTimer);
