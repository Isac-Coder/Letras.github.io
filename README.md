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

## Google Sheets search logging

This project stores search counts locally and can send data to a webhook URL if configured.

The published sheet URL is:

https://docs.google.com/spreadsheets/d/e/2PACX-1vRASbktVFnrv6HXhblAdgadtj8JlFpHuMypx3A8_A0fi2dZHES5LXCbn4n61XRryOl8AgtHc3nM7cGd/pub?output=csv

That URL is a deploy/read-only link and cannot be written to directly from the browser.

To actually save search data to the spreadsheet, create a webhook with Google Apps Script:

1. Open the spreadsheet in Google Sheets.
2. Go to Extensions > Apps Script.
3. Create a new script with this code:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents || '{}');
  sheet.appendRow([
    new Date(),
    data.title || '',
    data.artist || '',
    data.count || '',
    data.timestamp || ''
  ]);
  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Deploy the script as a web app and allow anyone, even anonymous, to access it.
5. Copy the deployment URL and paste it into `js/constants.js` as `SEARCH_STORAGE_URL`.

Once configured, the app will send each search to that webhook and track counts locally if the webhook is unavailable.

## License

This project is available under the BSD 3-Clause license. See [LICENSE](LICENSE) for details.