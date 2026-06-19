YTMusic local lyrics server 

This optional small Flask server uses `ytmusicapi` to try and fetch lyrics from YouTube Music.

Setup

1. Create a virtual environment (recommended):

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\Activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

Run

```bash
python ytmusic_server.py
```

The server listens on `http://127.0.0.1:5000` and exposes `/ytlyrics?artist=...&title=...`.

Notes

- `ytmusicapi` works without authentication for many endpoints, but in some cases you might need to provide browser headers or an authenticated setup. Check https://ytmusicapi.readthedocs.io/ for details.
- This server is optional; the client will call it only if configured and only after other providers fail.
