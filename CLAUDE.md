# Proyecto: Sitio web turístico de Labateca — Brief para Claude Code

> **Cómo usar este archivo:** colócalo en la raíz del proyecto (junto a `index.html`). Si trabajas con **Claude Code**, puedes renombrarlo a `CLAUDE.md` y lo cargará automáticamente como contexto. Luego pídele a Code que vaya resolviendo las tareas de la sección 6 en orden.

---

## 1. Objetivo del proyecto

Sitio web turístico **bilingüe (Español / Inglés)** del municipio de **Labateca, Norte de Santander (Colombia)**. La meta es conectar a los turistas —antes y durante su visita— con información práctica de cada lugar: ubicación, clima, distancias, tiempos de recorrido, cómo llegar (Google Maps), teléfonos y recomendaciones.

**Identidad:** "Labateca · Volcanes de Dios" (el nombre significa "volcanes de Dios" en lengua chitarera). Tono cálido, de montaña, editorial.

---

## 2. Estado actual

Ya existe un archivo **`index.html`** completo y funcional (un solo archivo, sin frameworks ni paso de compilación). Funciones ya implementadas:

- Encabezado fijo con logo SVG, menú responsive (hamburguesa en móvil) y selector de idioma ES/EN.
- **Hero** con clima en vivo (API Open-Meteo, sin clave), datos clave y **distancia dinámica** desde la ubicación del visitante (Geolocation API + fórmula de Haversine) con botón a la ruta real en Google Maps.
- Sección "El pueblo" con historia y datos.
- **Lugares filtrables** por categoría, con favoritos (♥) y planificador de rutas (drawer "Mi ruta" que genera enlace multi-parada de Google Maps).
- **Mapa interactivo** (Leaflet + OpenStreetMap) con marcadores y respaldo si no carga.
- **Galería** (actualmente con placeholders elegantes, pendiente de fotos reales).
- **Formulario de contacto** que envía por Web3Forms y, si no hay clave configurada, cae automáticamente a WhatsApp.
- **SEO**: title, meta description, Open Graph, Twitter Card, datos estructurados JSON-LD (TouristDestination), favicon SVG en línea, HTML semántico.
- Animaciones suaves (reveal al hacer scroll, hover, etc.) y `prefers-reduced-motion` respetado.

---

## 3. Stack técnico

- **HTML5 + CSS3 + JavaScript vanilla.** Sin frameworks, sin build step, sin dependencias de NPM en el sitio. Mantener así (simplicidad y portabilidad).
- **Tipografía:** Fraunces (display) + Hanken Grotesk (cuerpo), vía Google Fonts.
- **Estilos:** CSS con variables (`:root`). Paleta: verde bosque (`--forest`), terracota/café (`--clay`), dorado (`--gold`), crema (`--cream`/`--paper`).
- **APIs externas (todas gratis, sin backend):**
  - Open-Meteo → clima en vivo (sin API key).
  - Leaflet 1.9.4 + OpenStreetMap → mapa (CDN).
  - Web3Forms → formulario de contacto (requiere `access_key` gratuita).
- **Geolocation API** + Haversine → distancia desde el visitante.
- **localStorage** (con respaldo en memoria mediante el helper `store`) → favoritos, ruta e idioma.

---

## 4. Estructura del código (NO romper estos contratos)

Todo el JavaScript está dentro de `index.html`, al final, en un único bloque `<script>`. Piezas clave:

### `CONFIG` (al inicio del script — lo único que el dueño edita a mano)
```js
const CONFIG = {
  whatsapp: "573000000000",     // WhatsApp en formato internacional, sin "+"
  email: "hola@labateca-turismo.co",
  web3formsKey: "TU_ACCESS_KEY",// si está sin configurar, el formulario usa WhatsApp
  townCoords: { lat: 7.3167, lng: -72.4833 }, // Parque Principal de Labateca
  social: { instagram:"#", facebook:"#", tiktok:"#" }
};
```

### `PLACES` (array de lugares). Esquema de cada elemento:
```js
{
  id:"templo",                 // identificador único (string)
  cat:"cultura",               // naturaleza | cultura | gastronomia | hospedaje
  verified:true,               // true = dato confirmado | false = "por verificar"
  coordsApprox:false,          // true = la ubicación GPS es aproximada
  lat:7.3167, lng:-72.4833,    // coordenadas (mapa y Google Maps)
  phone:"",                    // teléfono internacional sin "+", o "" si no aplica
  name:{ es:"...", en:"..." },
  desc:{ es:"...", en:"..." },
  dist:{ es:"...", en:"..." },
  time:{ es:"...", en:"..." },
  diff:{ es:"...", en:"..." },
  rec:{ es:"...", en:"..." },
  img:""                       // (actual) URL única de foto; "" = placeholder
}
```

### `I18N` (diccionario ES/EN)
- Patrón: los textos estáticos del HTML llevan `data-i18n="clave"` (o `data-i18n-ph` para placeholders). La función `applyI18n()` los reemplaza, y `setLang(l)` re-renderiza todo.
- **Regla de oro:** cualquier texto nuevo de interfaz debe agregarse a `I18N.es` y `I18N.en`. Nada de texto "quemado" en un solo idioma.

### Helpers y funciones (no cambiar sus nombres/contratos)
- `store.get/set` → localStorage con respaldo en memoria (`memStore`). Claves: `lab_favs`, `lab_route`, `lab_lang`.
- Render: `renderFilters()`, `renderPlaces()`, `renderGallery()`, `renderDrawer()`.
- Favoritos/ruta: `toggleFav(id)`, `toggleRoute(id)`, `clearRoute()`, `updateBadges()`.
- Distancia: `calcDistance()`, `haversineKm(...)`.
- Clima: `loadWeather()`, `paintWeather()` (con respaldo a ~20 °C si falla la API).
- Mapa: `initMap()` (con respaldo visual si Leaflet no carga).
- `init()` arranca todo al final del script.

---

## 5. Principios y decisiones (respetar siempre)

1. **Datos de campo y comunidad, NO de la web.** La información en línea sobre Labateca está desactualizada. Lo no confirmado se marca con `verified:false` y/o `coordsApprox:true` (la interfaz ya muestra una etiqueta amarilla "por verificar").
2. **No inventar coordenadas GPS.** Si no se conocen, dejar aproximadas y marcarlas. Las exactas se levantan en campo con el celular.
3. **Optimización de imágenes obligatoria.** Nunca servir fotos de 8 MB. Objetivo: ~1600 px de ancho, formato WebP, ~200–300 KB por foto. Usar carga diferida (`loading="lazy"`, ya presente).
4. **Privacidad primero.** La geolocalización se pide SOLO cuando el usuario hace clic, nunca al cargar la página.
5. **Sin frameworks ni build step.** Mantener vanilla y portátil.
6. **Bilingüe completo.** Toda nueva cadena va en ES y EN.
7. **Hosting decidido:** fotos en **Cloudinary** (gratis, auto-optimiza, ~25 GB) + sitio en **Cloudflare Pages** (gratis, transferencia ilimitada). Requiere **HTTPS** (lo dan ambos), que es lo que activa geolocalización, mapa y clima.

---

## 6. Tareas pendientes (en orden de prioridad)

### 🔴 Prioridad alta

**T1. Integración de imágenes con Cloudinary.**
- Agregar `cloudName: "TU_CLOUD_NAME"` a `CONFIG`.
- Crear un helper para construir URLs optimizadas, p. ej.:
  ```js
  function cldUrl(publicId, transform){
    return `https://res.cloudinary.com/${CONFIG.cloudName}/image/upload/${transform}/${publicId}`;
  }
  // Miniatura tarjeta: "w_640,h_400,c_fill,f_auto,q_auto"
  // Foto grande (lightbox): "w_1600,f_auto,q_auto"
  ```
- Extender el esquema de `PLACES`: cambiar `img:""` por **`photos: ["public_id_1", "public_id_2", ...]`** (varios IDs de Cloudinary por lugar). Mantener compatibilidad: si `photos` está vacío, mostrar el placeholder actual.
- Las tarjetas usan la primera foto como miniatura optimizada.

**T2. Galería tipo *lightbox*.**
- Al hacer clic en una miniatura, abrir un overlay a pantalla completa con la foto grande.
- Navegación anterior/siguiente, leyenda (bilingüe), botón cerrar, soporte de teclado (Esc, ← →) y swipe en móvil.
- Vanilla, accesible (focus trap, `aria-*`), sin librerías. Reusar las variables CSS de la paleta.
- La sección "Galería" debe alimentarse de las fotos de `PLACES` (no de placeholders fijos).

**T3. Cargar los ~50 sitios reales.**
- Ampliar `PLACES` con los datos reales (los proveerá el dueño). Respetar el esquema y las banderas `verified`/`coordsApprox`.
- A 50 sitios conviene **externalizar los datos**: mover `PLACES` (y opcionalmente `I18N`) a un archivo aparte, p. ej. `data/places.js`, e incluirlo con `<script src>`. Mantiene `index.html` manejable.

### 🟡 Prioridad media

**T4. Script de optimización en lote** (para preparar las fotos antes de subirlas a Cloudinary).
- Crear un script Node con **sharp** que lea una carpeta `fotos-originales/`, redimensione a 1600 px de ancho máx., convierta a WebP (calidad ~80) y escriba en `fotos-web/`.
- Incluir instrucciones de uso (`npm i sharp` → `node optimize.js`). Alternativa sin Node: comando de ImageMagick.

**T5. Despliegue en Cloudflare Pages.**
- El sitio es estático: basta con desplegar la carpeta. Documentar los pasos (arrastrar/soltar o conectar repositorio Git) y la opción de dominio propio.

**T6. Secciones nuevas (opcionales).**
- "Eventos y fiestas" (calendario anual del municipio).
- "Cómo llegar paso a paso" desde Cúcuta, Pamplona y Bucaramanga.

### 🟢 Futuro / opcional

**T7. Tiempo de manejo dentro de la página** (sin abrir Google Maps), usando OpenRouteService (clave gratuita) en `calcDistance()`.

**T8. Aportes de la comunidad/negocios** — definir un flujo sencillo (por ahora, el formulario; a futuro, un mini-panel).

---

## 7. Cómo correr y probar localmente

- No hay build. Para que **geolocalización, mapa y clima** funcionen, servir por HTTP local o HTTPS (no abrir como `file://`):
  ```bash
  python3 -m http.server 8000
  # luego abrir http://localhost:8000
  ```
- Probar: cambio de idioma ES/EN, favoritos, "Mi ruta", botón de distancia (pide permiso de ubicación), formulario (debe caer a WhatsApp si no hay `web3formsKey`).

---

## 8. Restricciones para Claude Code

- **No** introducir frameworks, bundlers ni dependencias en el sitio en producción (sharp es solo para el script de build de imágenes, fuera del sitio).
- **No** usar `localStorage` sin el patrón `store` con respaldo en memoria.
- **No** romper el patrón `data-i18n` ni dejar texto en un solo idioma.
- **No** quitar los respaldos (fallback) de mapa, clima y geolocalización.
- **No** inventar datos ni coordenadas; respetar las banderas `verified`/`coordsApprox`.
- Mantener accesibilidad y responsive en todo lo nuevo.

---

## 9. Datos verificados de Labateca (referencia)

- Significado: "volcanes de Dios" (lengua chitarera). Municipio desde 1930.
- Altitud ~1.566 m s. n. m., clima templado ~20 °C. A ~113 km de Cúcuta (~3,5 h en bus).
- Coordenadas del casco urbano: ~7.3167, -72.4833.
- Atractivos: Templo Nuestra Señora de las Angustias (lienzo original de la Virgen + pila bautismal de piedra colonial), Parque Principal, Casa de la Cultura, Cascada La Lirgua, Laguna Negra, Páramo de Santurbán (>2.000 hectáreas del municipio).
- Gastronomía típica: arequipe de café, quesillo de ahuyama, bocadillos, guarapo de frutas, hayacas de maíz.
- *(Las coordenadas de cascadas, Laguna Negra y páramo están como aproximadas: verificar en campo.)*
