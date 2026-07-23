import express from 'express';
import pkg from 'pg';

const { Pool } = pkg;
const app = express();
const port = process.env.PORT || 3001;

const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING || 'postgresql://postgres.fhqlbhwvotvxhmkbzwfn:Yosoyblaki2005.@aws-1-us-east-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

app.use(express.json());
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/searches', async (req, res) => {
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
    res.json(normalized);
  } catch (error) {
    console.error('Error al consultar búsquedas:', error);
    res.status(500).json({ error: 'No se pudo consultar el historial.' });
  }
});

app.post('/searches', async (req, res) => {
  const { title, artist, titleLower, artistLower, count, lastSearchedAt } = req.body;

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
    res.status(201).json({
      id: created.id_cancion,
      title: created.titulo,
      artist: created.artista,
      count: created.n_reproducciones ?? 0,
      lastSearchedAt: created.lastsearchedat,
      query: `${created.titulo}${created.artista ? ` - ${created.artista}` : ''}`.trim()
    });
  } catch (error) {
    console.error('Error al crear registro:', error);
    res.status(500).json({ error: 'No se pudo guardar la búsqueda.' });
  }
});

app.patch('/searches/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { count, lastSearchedAt } = req.body;

  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: 'ID inválido.' });
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
      return res.status(404).json({ error: 'Registro no encontrado.' });
    }

    const updated = rows[0];
    res.json({
      id: updated.id_cancion,
      title: updated.titulo,
      artist: updated.artista,
      count: updated.n_reproducciones ?? 0,
      lastSearchedAt: updated.lastsearchedat,
      query: `${updated.titulo}${updated.artista ? ` - ${updated.artista}` : ''}`.trim()
    });
  } catch (error) {
    console.error('Error al actualizar registro:', error);
    res.status(500).json({ error: 'No se pudo actualizar la búsqueda.' });
  }
});

app.listen(port, () => {
  console.log(`Servidor de historial escuchando en http://localhost:${port}`);
});
