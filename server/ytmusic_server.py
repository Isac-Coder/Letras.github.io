from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from ytmusicapi import YTMusic

app = Flask(__name__)
# Allow cross-origin requests from local dev (Live Server on different port)
CORS(app)

yt = YTMusic()

@app.route('/ytlyrics')
def ytlyrics():
    artist = request.args.get('artist', '')
    title = request.args.get('title', '')
    if not title:
        return jsonify({'error': 'title is required'}), 400

    query = f"{artist} {title}".strip()
    try:
        results = yt.search(query, filter='songs', limit=5)
        if not results:
            return jsonify({'error': 'No results'}), 404

        # Tomar el primer resultado válido y obtener detalles
        for r in results:
            video_id = r.get('videoId') or r.get('browseId')
            from flask import Flask, request, jsonify
            from ytmusicapi import YTMusic

            app = Flask(__name__)

            yt = YTMusic()

            @app.route('/ytlyrics')
            def ytlyrics():
                artist = request.args.get('artist', '')
                title = request.args.get('title', '')
                if not title:
                    return jsonify({'error': 'title is required'}), 400

                query = f"{artist} {title}".strip()
                try:
                    results = yt.search(query, filter='songs', limit=5)
                    if not results:
                        return jsonify({'error': 'No results'}), 404

                    # Tomar el primer resultado válido y obtener detalles
                    for r in results:
                        video_id = r.get('videoId') or r.get('browseId')
                        if not video_id:
                            continue
                        try:
                            song = yt.get_song(video_id)
                            # ytmusicapi puede devolver 'lyrics' o 'lyrics' dentro de 'lyrics'
                            lyrics = None
                            if song:
                                if 'lyrics' in song and song['lyrics']:
                                    # La estructura puede variar
                                    if isinstance(song['lyrics'], dict):
                                        lyrics = song['lyrics'].get('lyrics') or song['lyrics'].get('lines')
                                        if isinstance(lyrics, list):
                                            lyrics = '\n'.join([l.get('text','') for l in lyrics])
                                    else:
                                        lyrics = song['lyrics']

                                # Algunas versiones devuelven 'lyrics' en 'microformat' o 'captions'
                                if not lyrics and 'captions' in song and song['captions']:
                                    captions = song['captions'].get('lyrics') or song['captions']
                                    if isinstance(captions, list):
                                        lyrics = '\n'.join(captions)

                            if lyrics:
                                return jsonify({'lyrics': lyrics}), 200
                        except Exception:
                            continue

                    return jsonify({'error': 'No lyrics found'}), 404
                except Exception as e:
                    return jsonify({'error': str(e)}), 500

            if __name__ == '__main__':
                app.run(host='127.0.0.1', port=5000)
                    if translated:
