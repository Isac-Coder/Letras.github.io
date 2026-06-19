import {
  resultsList,
  messageEl,
  lyricsTitle,
  lyricsArtist,
  lyricsSource,
  lyricsBlock,
  copyButton
} from './dom.js';


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

    item.querySelector('button').addEventListener('click', () => onSelect(song));
    resultsList.appendChild(item);
  });
}

export function showMessage(text) {
  messageEl.textContent = text;
}

export function showLyrics(song, text, source = 'Original') {
  lyricsTitle.textContent = song.title;
  lyricsArtist.textContent = song.artist;
  lyricsSource.textContent = source;
  lyricsBlock.textContent = text;
}

// Translation UI removed: setTranslateButtonText disabled

export function setCopyButtonState(enabled) {
  copyButton.disabled = !enabled;
}
export function resetUiAfterLoad() {
  setCopyButtonState(true);
}

export function resetUiBeforeSearch() {
  resultsList.innerHTML = '';
}
