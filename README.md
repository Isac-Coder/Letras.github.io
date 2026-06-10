# Letras.github.io

Song lyrics finder. Search for songs and copy lyrics with automatic timestamps.

## What can you do?

- Search for songs by title and/or artist.
- View the lyrics of the found song.
- Copy lyrics to clipboard with automatic timestamps.

## Getting started

1. Download or clone this repository.
2. Open `index.html` in your browser (you can right-click and "Open with", or drag the file to the browser).

**Alternative**: if you have Python installed, open a terminal in the project folder and run:

```bash
python -m http.server 5500
```

Then open `http://127.0.0.1:5500` in your browser.

## Project structure

```
.
│   index.html
│   LICENSE
│   package.json
│   README.md
│   
├───css
│       styles.css
│       
├───js
│       app.js
│       constants.js
│       dom.js
│       lyricsService.js
│       ui.js
│       
└───server
        requirements.txt
        ytmusic_server.py
```

## Usage

1. Enter the song title and/or artist name.
2. Click "Search songs".
3. Select the result you want and click "View lyrics".
4. Press "Copy lyrics with timestamps" to copy to clipboard.

## License

This project is available under the BSD 3-Clause license. See [LICENSE](LICENSE) for details.