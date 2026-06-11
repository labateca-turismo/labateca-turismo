# Tracks GPS de los senderos

Aquí van los archivos **.gpx** grabados en campo con Wikiloc u OsmAnd.

## Cómo agregar un sendero al mapa

1. Graba el recorrido con la app (el GPS funciona sin señal — descarga el mapa offline antes y usa modo avión).
2. Exporta la ruta como archivo **GPX** y guárdalo en esta carpeta.
   Nombre sugerido: el mismo ID del lugar. Ej: `cascada-lirgua.gpx`
3. En `data/places.json`, agrega al lugar el campo:
   ```json
   "track": "data/tracks/cascada-lirgua.gpx"
   ```
4. Listo: el sendero se dibuja automáticamente sobre el mapa real como
   línea punteada terracota, con su distancia calculada en el popup.
