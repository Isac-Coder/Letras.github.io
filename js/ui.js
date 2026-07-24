import {
  resultsList,
  messageEl,
  providerNotice,
  searchStatus,
  searchCard,
  lyricsTitle,
  lyricsArtist,
  lyricsSource,
  lyricsBlock,
  playButton,
  copyButton,
  topSongsList
} from './dom.js';

const stateClasses = [
  'search-state--loading',
  'search-state--success',
  'search-state--no-results',
  'search-state--error',
  'search-state--fallback',
  'search-state--cached'
];

export function renderSuggestions(suggestions, onSelect) {
  resultsList.innerHTML = '';
  suggestions.forEach(song => {
    const item = document.createElement('li');
    item.innerHTML = `
      <div>
        <strong>${song.title}</strong>
        <div class="meta">${song.artist}${song.album ? ' · ' + song.album : ''}</div>
      </div>
      <button type="button">Ver letra</button>
    `;

    if (song.provider) {
      const badge = document.createElement('span');
      const provider = String(song.provider).toLowerCase();
      badge.className = `source-badge source-badge--${provider}`;
      const label = {
        'popcat': 'PopCat',
        'deezer': 'Deezer',
        'itunes': 'iTunes',
        'lrclib': 'LRCLIB',
        'lyrics.ovh': 'Lyrics.ovh',
        'genius': 'Genius'
      }[provider] || provider.charAt(0).toUpperCase() + provider.slice(1);
      badge.textContent = label;
      item.querySelector('div').appendChild(badge);
    }

    item.querySelector('button').addEventListener('click', () => onSelect(song));
    resultsList.appendChild(item);
  });
}

export function showLoadingSkeleton(count = 3) {
  resultsList.innerHTML = '';
  for (let i = 0; i < count; i += 1) {
    const li = document.createElement('li');
    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton';
    li.appendChild(skeleton);
    resultsList.appendChild(li);
  }
}

export function clearLoadingSkeleton() {
  // remove any skeleton nodes
  Array.from(resultsList.children).forEach(child => {
    if (child.querySelector('.skeleton')) child.remove();
  });
}

export function setSearchState(state) {
  if (!searchCard) return;
  // remove all
  stateClasses.forEach(c => searchCard.classList.remove(c));
  stateClasses.forEach(c => document.body.classList.remove(c));
  
  if (state && stateClasses.includes(`search-state--${state}`)) {
    searchCard.classList.add(`search-state--${state}`);
    document.body.classList.add(`search-state--${state}`);
  }

  // update aria status text
  if (searchStatus) {
    switch (state) {
      case 'loading':
        searchStatus.textContent = 'Buscando…';
        searchStatus.classList.remove('visually-hidden');
        break;
      case 'success':
        searchStatus.textContent = 'Resultados listados';
        searchStatus.classList.add('visually-hidden');
        break;
      case 'no-results':
        searchStatus.textContent = 'No se encontraron resultados';
        searchStatus.classList.remove('visually-hidden');
        break;
      case 'error':
        searchStatus.textContent = 'Error al realizar la búsqueda';
        searchStatus.classList.remove('visually-hidden');
        break;
      default:
        searchStatus.textContent = '';
        searchStatus.classList.add('visually-hidden');
    }
  }
}

export function showMessage(text) {
  messageEl.textContent = text;
}

export function renderTopSongs(songs, emptyMessage = 'No hay canciones registradas aún.') {
  if (!topSongsList) return;

  topSongsList.innerHTML = '';

  if (!songs?.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'top-songs-empty';
    emptyItem.textContent = emptyMessage;
    topSongsList.appendChild(emptyItem);
    return;
  }

  songs.forEach((song, index) => {
    const item = document.createElement('li');
    item.className = 'top-songs-item';

    const rank = document.createElement('span');
    rank.className = 'top-songs-rank';
    rank.textContent = `#${index + 1}`;

    const info = document.createElement('div');
    info.className = 'top-songs-info';

    const title = document.createElement('strong');
    title.textContent = song.title;

    const count = document.createElement('span');
    count.textContent = `${song.count ?? 0} veces`;

    info.appendChild(title);
    info.appendChild(count);

    item.appendChild(rank);
    item.appendChild(info);
    topSongsList.appendChild(item);
  });
}

export function showProviderNotice(text) {
  providerNotice.textContent = text;
  providerNotice.classList.remove('hidden');
}

export function clearProviderNotice() {
  providerNotice.textContent = '';
  providerNotice.classList.add('hidden');
}

export function showLyrics(song, text, source = 'Original') {
  lyricsTitle.textContent = song.title;
  lyricsArtist.textContent = song.artist;
  lyricsSource.textContent = source;
  lyricsBlock.textContent = text;
  
  // Add synced badge if lyrics are synced
  if (song.syncedLyrics && song.syncedLyrics.trim()) {
    const syncedBadge = document.createElement('span');
    syncedBadge.className = 'source-badge source-badge--synced';
    syncedBadge.textContent = 'Sincronizada';
    lyricsSource.appendChild(syncedBadge);
  }
}

// Translation UI removed: setTranslateButtonText disabled

export function setCopyButtonState(enabled) {
  copyButton.disabled = !enabled;
}

export function setPlayButtonState(enabled) {
  playButton.disabled = !enabled;
}

export function resetUiAfterLoad() {
  setCopyButtonState(true);
  setSearchState('success');
}

export function resetUiBeforeSearch() {
  resultsList.innerHTML = '';
  clearProviderNotice();
  setSearchState('loading');
}
