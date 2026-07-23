# Letras.github.io

Aplicación web para buscar letras de canciones, ver resultados sugeridos y copiar la letra con marcas de tiempo.

## Enlace de la página desplegada

```text
https://isac-coder.github.io/Letras.github.io/
```

## Características

- Buscar por título y/o artista.
- Ver resultados sugeridos antes de cargar la letra.
- Copiar la letra con formato de timestamps.
- Guardar el historial de búsquedas en Supabase.

## Inicio rápido

1. Clona o descarga este repositorio.
2. Instala las dependencias:

```bash
npm install
```

3. Inicia el entorno local:

```bash
npm run dev
```

Esto levantará Vite y el servidor local encargado de guardar el historial.

## Estructura del proyecto

```text
.
├── api/
│   └── searches.js          # Endpoint serverless para Vercel que guarda el historial en Supabase
├── css/
│   ├── styles.css          # Estilos principales de la interfaz
│   └── _states.css         # Estilos para estados visuales
├── js/
│   ├── app.js              # Lógica principal de la aplicación
│   ├── constants.js        # Configuraciones y URLs base
│   ├── dom.js              # Referencias a elementos del DOM
│   ├── lyricsService.js    # Consumo de APIs de letras y sugerencias
│   ├── searchStorage.js    # Persistencia del historial de búsquedas
│   └── ui.js               # Renderizado y manejo de la interfaz
├── index.html              # Punto de entrada de la aplicación
├── package.json            # Dependencias y scripts de ejecución
├── server.js               # Servidor Express local para guardar búsquedas en Supabase
├── vercel.json             # Configuración de despliegue en Vercel
└── README.md               # Documentación del proyecto
```

## Variables de entorno

Para que el historial funcione en Vercel o en un entorno remoto, define una de estas variables:

```bash
SUPABASE_CONNECTION_STRING=postgresql://usuario:password@host:puerto/base
```

o bien:

```bash
DATABASE_URL=postgresql://usuario:password@host:puerto/base
```

## Uso

1. Escribe el título de la canción y/o el artista.
2. Haz clic en buscar.
3. Elige un resultado de la lista.
4. Visualiza la letra y cópiala si lo necesitas.

## Notas

- La aplicación usa APIs públicas de letras y, cuando es posible, un servicio auxiliar para obtener mejor información.
- El historial de búsquedas se almacena en Supabase mediante una API local o serverless.

## Licencia

BSD 3-Clause. Ver [LICENSE](LICENSE).
