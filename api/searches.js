import 'dotenv/config';
import pkg from 'pg';

const { Pool } = pkg;

const connectionString = process.env.SUPABASE_CONNECTION_STRING || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Falta la variable de entorno SUPABASE_CONNECTION_STRING o DATABASE_URL.');
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

function jsonResponse(res, statusCode, body) {
  res.status(statusCode).json(body);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET' && (req.url || '').includes('/top')) {
    try {
      const query = `
        select titulo, artista, n_reproducciones, lastsearchedat
        from public.canciones
        where (coalesce(trim(titulo), '') <> ''
           or coalesce(trim(artista), '') <> '')
           or artista is null
           or lower(coalesce(artista, '')) = 'empty'
        order by coalesce(n_reproducciones, 0) desc, coalesce(lastsearchedat, '1970-01-01T00:00:00Z') desc
      `;

      const { rows } = await pool.query(query);
      const normalized = rows.map((row, index) => ({
        id: index + 1,
        title: row.titulo,
        count: row.n_reproducciones ?? 0
      }));

      return jsonResponse(res, 200, normalized);
    } catch (error) {
      console.error('Error al consultar canciones más escuchadas:', error);
      return jsonResponse(res, 500, { error: 'No se pudo consultar el ranking.' });
    }
  }

  if (req.method === 'GET') {
    const titleLower = (req.query.titleLower || '').toString().trim().toLowerCase();
    const artistLower = (req.query.artistLower || '').toString().trim().toLowerCase();

    try {
      const query = `
        select *
        from public.canciones
        where lower(titulo) = $1
          and lower(artista) = $2
        order by lastsearchedat desc
        limit 1
      `;

      const { rows } = await pool.query(query, [titleLower, artistLower]);
      const normalized = rows.map(row => ({
        id: row.id_cancion,
        title: row.titulo,
        artist: row.artista,
        count: row.n_reproducciones ?? 0,
        lastSearchedAt: row.lastsearchedat,
        query: `${row.titulo}${row.artista ? ` - ${row.artista}` : ''}`.trim()
      }));
      return jsonResponse(res, 200, normalized);
    } catch (error) {
      console.error('Error al consultar búsquedas:', error);
      return jsonResponse(res, 500, { error: 'No se pudo consultar el historial.' });
    }
  }

  if (req.method === 'POST') {
    const { title, artist, count, lastSearchedAt } = req.body || {};

    try {
      const insertQuery = `
        insert into public.canciones (titulo, artista, n_reproducciones, lastsearchedat)
        values ($1, $2, $3, $4)
        returning id_cancion, titulo, artista, n_reproducciones, lastsearchedat
      `;

      const timestamp = lastSearchedAt || new Date().toISOString();
      const { rows } = await pool.query(insertQuery, [
        title?.trim() || '',
        artist?.trim() || '',
        Number(count || 1),
        timestamp
      ]);

      const created = rows[0];
      return jsonResponse(res, 201, {
        id: created.id_cancion,
        title: created.titulo,
        artist: created.artista,
        count: created.n_reproducciones ?? 0,
        lastSearchedAt: created.lastsearchedat,
        query: `${created.titulo}${created.artista ? ` - ${created.artista}` : ''}`.trim()
      });
    } catch (error) {
      console.error('Error al crear registro:', error);
      return jsonResponse(res, 500, { error: 'No se pudo guardar la búsqueda.' });
    }
  }

  if (req.method === 'PATCH') {
    const id = Number(req.query.id || req.params?.id || 0);
    const { count, lastSearchedAt } = req.body || {};

    if (!Number.isFinite(id)) {
      return jsonResponse(res, 400, { error: 'ID inválido.' });
    }

    try {
      const updateQuery = `
        update public.canciones
        set n_reproducciones = $1,
            lastsearchedat = $2
        where id_cancion = $3
        returning id_cancion, titulo, artista, n_reproducciones, lastsearchedat
      `;

      const { rows } = await pool.query(updateQuery, [Number(count || 0), lastSearchedAt || new Date().toISOString(), id]);
      if (rows.length === 0) {
        return jsonResponse(res, 404, { error: 'Registro no encontrado.' });
      }

      const updated = rows[0];
      return jsonResponse(res, 200, {
        id: updated.id_cancion,
        title: updated.titulo,
        artist: updated.artista,
        count: updated.n_reproducciones ?? 0,
        lastSearchedAt: updated.lastsearchedat,
        query: `${updated.titulo}${updated.artista ? ` - ${updated.artista}` : ''}`.trim()
      });
    } catch (error) {
      console.error('Error al actualizar registro:', error);
      return jsonResponse(res, 500, { error: 'No se pudo actualizar la búsqueda.' });
    }
  }

  return jsonResponse(res, 405, { error: 'Método no permitido.' });
}
