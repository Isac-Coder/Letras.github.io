# Letras.github.io

A simple local web interface for searching song lyrics and copying them with timestamps.

## Link of the deploymend page

```
https://isac-coder.github.io/Letras.github.io/
```

## Overview

- Search by song title and/or artist.
- View available song matches before loading lyrics.
- Copy lyrics with formatted timestamps.

## Getting started

1. Clone or download this repository.
2. Open `index.html` in your browser.

If you prefer a local web server, run this from the project folder:

```bash
npx vite
```

Then visit `http://127.0.0.1:5173`.

## Project structure


```
.
│   db.json
│   index.html
│   LICENSE
│   package.json
│   README.md
│   
├───css
│       styles.css
│       
└───js
        app.js
        constants.js
        dom.js
        lyricsService.js
        searchStorage.js
        ui.js
```

## Usage

1. Enter the song title and/or artist.
2. Click the search button.
3. Choose a listed result.
4. Click to view lyrics and copy if needed.

## Notes

- The app works with public lyrics APIs and a small local helper service when available.
- Search metadata is stored locally for better behavior over time.

## License

BSD 3-Clause. See [LICENSE](LICENSE).
