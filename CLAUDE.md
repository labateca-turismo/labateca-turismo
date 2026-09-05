# Labateca · Volcanes de Dios — cómo está hecho este sitio

Guía turística del municipio de **Labateca, Norte de Santander (Colombia)**.
Bilingüe español/inglés. Sin frameworks, sin bundler, sin paso de compilación.

> Este archivo se carga solo como contexto al abrir el proyecto. Si algo de
> aquí no coincide con el código, **el código manda y este archivo hay que
> corregirlo**. Estuvo desactualizado desde junio hasta el 2 de septiembre de
> 2026 y en ese lapso hizo más daño que bien.

**Estado al 5 de septiembre de 2026 (v202):** 116 lugares · 610 fotos ·
6 rutas temáticas · 12 conductores · 2 videos · 292 páginas HTML · 286 URLs
en el sitemap. **8 fichas pendientes**, todas de naturaleza.

---

## 1. Lo primero: cómo se despliega

El sitio vive en **Cloudflare Workers** (no Pages) y está **conectado a
GitHub: se despliega solo al empujar a `main`**. Tarda de segundos a varios
minutos; si no aparece, esperar, no re-empujar.

**El orden correcto, siempre:**

```bash
python subir_version.py NNN     # desde la carpeta del proyecto, no desde files/
node gen_seo.js
cd files && git add -A && git commit -m "vNNN: ..." && git push origin main
```

`subir_version.py` toca **tres sitios que tienen que ir sincronizados**:
`CACHE_VERSION` en `sw.js`, el precache de `/styles.css?v=NNN` dentro de
`sw.js`, y el `<link>` de las 25 páginas escritas a mano.

> ⚠️ **Nunca subir la versión con `sed`.** Un `sed 's/labateca-v182/v183/'`
> solo cambia `CACHE_VERSION` y deja el CSS de las 25 páginas en la versión
> anterior: el visitante sigue viendo la hoja de estilos vieja. Ya pasó.

**Los tres workers NO se despliegan con el sitio.** `.assetsignore` los
excluye a propósito. Se actualizan **pegando el `.js` en el panel de
Cloudflare**:

| Worker | Qué hace | Ojo |
|---|---|---|
| `worker-chat.js` | Asistente de IA (Workers AI, Llama 3.1) | Usa la vinculación `env.AI`. Desplegarlo por CLI sin declarar `[ai] binding = "AI"` **la borra y rompe el chat** |
| `worker-reviews.js` | Reseñas + visitas + eventos (D1) | Panel `/moderar?key=…` y `/stats?key=…` |
| `worker-cms-auth.js` | OAuth del panel Sveltia | |

---

## 2. Cómo está organizado

```
labateca proyect/
├─ files/              ← ESTO es el repo git y lo que se publica
│  ├─ index.html, lugares.html, pueblo.html, viva.html, libro.html…
│  ├─ historia/        ← 17 páginas de fuentes históricas (a mano)
│  ├─ lugar/           ← 111 fichas ES   ┐
│  ├─ en/place/        ← 111 fichas EN   │ GENERADAS: no editar a mano,
│  ├─ categoria/       ← 6 categorías ES │ se reescriben en cada corrida
│  ├─ en/category/     ← 6 categorías EN ┘
│  ├─ ruta/            ← 6 páginas de ruta ES  ┐ GENERADAS
│  ├─ en/route/        ← 6 páginas de ruta EN  ┘
│  ├─ data/places.json ← FUENTE ÚNICA de los lugares
│  ├─ data/rutas.json  ← FUENTE ÚNICA de las rutas
│  ├─ media/           ← el MP3 del himno y los dos videos (35 MB)
│  ├─ app.js, styles.css, sw.js
│  └─ worker-*.js      ← no se publican (.assetsignore)
└─ *.js, *.py          ← generadores y scripts de lote (fuera del repo)
```

**Generadores** (se corren desde la carpeta del proyecto, no desde `files/`):

- **`gen_seo.js`** — el importante. De `places.json` y `rutas.json` escribe
  las 246 páginas de lugar, categoría y ruta en los dos idiomas, el
  `sitemap.xml` y el directorio de `lugares.html`. Se puede correr siempre.
- **`check_rutas.js`** — valida `rutas.json`. **Correrlo ANTES de `gen_seo.js`.**
- `gen_pueblo.js`, `gen_libro.js`, `gen_biblioteca.js`, `gen_antiguas.js`,
  `gen_anexos.js` — cada uno arma su página.
- **`gen_qr.js`** — el código QR del sitio (SVG y PNG) y su sección en la
  portada. Usa `files/qr-encoder.js` (codificador propio, sin dependencias,
  que también sirve a `/qr`) y `png.js` (escribe PNG con el zlib de Node).
- `poner_beacon.py` — el beacon de analítica en las páginas a mano.
- `add_loteNN` / `bake_loteNN` / `subir_*` — carga de lotes de lugares y fotos.

---

## 3. Contratos que no se rompen

### `data/places.json`

```json
{ "id":"templo", "categoria":"cultura", "verified":true, "pendiente":false,
  "coordsApprox":false, "lat":7.29, "lng":-72.49, "mapaX":513, "mapaY":355,
  "telefono":"57...", "nombre":{"es":"","en":""}, "desc":{"es":"","en":""},
  "comoLlegar":{}, "dist":{}, "tiempo":{}, "dificultad":{}, "recomendacion":{},
  "fotos":["labateca/templo-01"], "fotosCap":[{"es":"","en":""}] }
```

Categorías: `naturaleza · cultura · gastronomia · hospedaje · comercio · servicios`.
Opcionales: `telFijo`, `correo`, `track`, `trailhead`, `wikiloc`, `fotosAviso`,
`mapaFuera`.

- **`pendiente: true`** = ficha reportada pero **sin levantar en campo**. Entra
  **sin `lat`/`lng`, sin `mapaX`/`mapaY` y con `fotos: []` a propósito**: poner
  la coordenada del pueblo mandaría a la gente al parque a buscar una cascada.
  El código ya lo soporta en los dos lados. Hoy hay 9.
- **`verified: false`** pinta la etiqueta amarilla «por verificar».
- **`mapaX` / `mapaY` NO se escriben a mano.** Los calcula `pines_mapa.js`
  desde `lat`/`lng` con la misma proyección con la que se dibujó el mapa
  (ver «El mapa ilustrado» más abajo). Después de agregar lugares:
  `node gen_mapa.js && node pines_mapa.js`.
- **`mapaFuera: true`** = el lugar tiene `lat`/`lng` de verdad pero **cae
  fuera del lienzo**, que cubre 1.200 × 1.050 m alrededor del casco. Lo pone
  y lo quita `pines_mapa.js`; **no se edita a mano**. Hoy son once, y la
  página los lista debajo del mapa con su distancia real.
- **`telefono` es opcional.** La Personería tachó la casilla del teléfono en su
  formato y su ficha va sin él: `gen_seo.js` simplemente no pinta la fila de
  WhatsApp. No hay que inventar un número para llenar el hueco.
- **`desc` admite párrafos**, separándolos con una **línea en blanco**.
  `gen_seo.js` los parte (`parrafos()`); el primero lleva `class="lead"`. Se
  usa cuando después de la descripción va texto que no es nuestro —la misión
  de la Personería, por ejemplo—. El resto de los campos es un solo párrafo.

### `data/conductores.json`

Alimenta a la vez `/transporte` y `/en/transport`, que **no cargan `app.js`**:
cada página trae su propio lector, su propio `escHtml()` y su propio `T()`.

```json
{ "id":"motilones", "tipo":"intermunicipal", "nombre":"Los Motilones",
  "whatsapp":"573112001221", "foto":"labateca/transporte-motilones",
  "vehiculo":{"es":"","en":""}, "rutas":{"es":"","en":""},
  "horario":{"es":"","en":""}, "notas":{"es":"","en":""} }
```

- **`tipo`** vale `"intermunicipal"` o `"municipal"`, escrito así exactamente:
  de eso depende en qué sección cae la tarjeta.
- **`whatsapp`** son 12 dígitos, `57` + los diez del celular. Sin espacios ni
  `+`; el lector limpia lo que no sea dígito, pero el dato entra limpio.
- **Los campos de texto aceptan cadena suelta o `{es,en}`.** `T()` escoge el
  idioma en cada página. Un nombre propio va como cadena; «bus naranja» va
  bilingüe, porque en la página inglesa se lee.
- **`vehiculo` es para reconocer el carro en la plaza**, no para el registro:
  marca, color y seña. **La placa solo se escribe si se lee sin duda** en una
  foto del vehículo o en el formato. Dos de las del registro quedaron
  ilegibles y se dejaron por fuera: una placa equivocada es peor que ninguna.
- **`foto` es opcional** y es el `public_id` de Cloudinary. Hay **dos clases
  de imagen y no se pintan igual**:
  - **`foto` sola** (`labateca/transporte-…`) = fotografía real del vehículo.
    Se recorta a 16:9 y llena el ancho de la tarjeta.
  - **`foto` + `fotoTipo:"aviso"`** (`labateca/aviso-…`) = la pieza
    publicitaria de la propia empresa, que los transportistas entregaron para
    salir en la guía. Va **completa y con su propia forma** (`aspect-ratio:
    auto`), porque lo útil de ella son los horarios impresos y cualquier
    recorte los corta. Y lleva **pie —«Aviso de la propia empresa»—** para que
    no se lea como foto nuestra del bus.

  Las capturas de WhatsApp traen bandas negras; `bake_avisos.py` las recorta
  por detección de filas oscuras. La del 034 tenía 222 px, casi un tercio.

  La tarjeta sin imagen simplemente empieza por el título.
- En cuanto haya un `"municipal"`, el aviso de «esta parte la estamos
  levantando» se apaga solo y aparece `#condMunNota` en su lugar.

### `data/rutas.json`

Sigue la metodología de guiones temáticos de Fontur/MinCIT: una ruta no es
una lista de ids, es un producto con **idea fuerza**, **tema central** y
**paradas ordenadas con un rol**.

```json
{ "id":"fe", "estado":"activa", "modo":"autoguiada",
  "icono":"🕊️", "color":"#3f5b8f", "colorSoft":"#e3e9f4",
  "nombre":{}, "ideaFuerza":{}, "desc":{}, "temaCentral":{},
  "duracion":{}, "dificultad":{}, "inicio":{}, "cuando":{}, "recomendacion":{},
  "paradas":[ {"id":"templo","rol":"focal","guion":{"es":"","en":""}} ],
  "lecturas":["virgen-angustias"], "alojamiento":["la-pena"],
  "paginas":[{"url":"/historia/…","titulo":{}}] }
```

Roles: `focal` · `principal` · `complementario`. `estado`: `activa` o
`preparacion` (sin paradas, remite al guía local).

Las tres listas de apoyo **no son paradas** y por eso van aparte:

- **`lecturas`** — fichas que se leen, no puntos que se visitan. `templo` y
  `virgen-angustias` comparten coordenadas: si la patrona fuera parada, la
  ruta mandaría a Google Maps el mismo punto dos veces.
- **`alojamiento`** — dónde dormir. La Peña es cabaña con vista al cañón,
  no una parada del recorrido.
- **`paginas`** — fuentes históricas del propio sitio.

### Traducción

Los textos de interfaz llevan `data-i18n` (o `-ph` / `-aria`) y viven en
`I18N.es` / `I18N.en` en `app.js`. **Toda cadena nueva va en los dos idiomas.**

> `applyI18n()` **reescribe el `innerHTML`** de todo lo que lleva `data-i18n`.
> Cualquier cosa que se inyecte dentro de esos elementos hay que repintarla
> DESPUÉS —es lo que hace `marcarSoloES()` al final de `setLang()`—.

### Qué es bilingüe de verdad y qué no

- **Sí:** `index.html` (159 claves) y `lugares.html` (60). Con `?lang=en`
  salen enteras en inglés. Las 111 fichas, las 6 categorías y las 6 rutas
  tienen su gemela en `/en/`. **`/transporte` tiene gemela traducida a mano
  en `/en/transport`** (v191): es prosa, no interfaz, así que no se resolvió
  con `data-i18n` sino con una página aparte, igual que las fichas. Las dos se
  declaran mutuamente con `hreflang` y `enrutarTransporte()` en `app.js`
  reescribe los enlaces al idioma activo.
- **No:** `pueblo`, `viva`, `libro`, `biblioteca`, las legales y
  16 de las 17 de historia. Tienen el armazón traducido y **el cuerpo en
  español**. Se enlazan igual, pero marcados con la etiqueta `ES` y
  `hreflang="es"` (`marcarSoloES()` en `app.js`, `marcaES()` en `gen_seo.js`).

### Otros

- `store.get/set` para `localStorage`, nunca directo (tiene respaldo en
  memoria). Claves: `lab_favs`, `lab_route`, `lab_lang`, `lab_visit_day`.
- Sin frameworks ni dependencias en el sitio publicado.

---

## 4. Reglas duras, aprendidas a golpes

**Encabezado.** Los controles llevan `min-width:44px` por **WCAG 2.5.8** (área
táctil mínima) y **no se encogen**. Cuando el encabezado no cuadre: medir
(`ancho − padding − nav-tools − gap`) y sacar el espacio quitando o fusionando
controles, **nunca recortando el nombre del sitio**. Así se resolvió: el icono
del bus se oculta bajo 430px (su destino está en el menú) y el par ES/EN se
volvió **un solo botón bajo 760px** ocultando el activo.

**`styles.css` tiene reglas duplicadas.** `.nav-bus` se declara en cuatro
sitios; una regla puesta antes de la línea ~1366 la pierde por orden de
aparición. Lo que tenga que ganar seguro, **al final del archivo**.

**La marca del encabezado.** Entre el nombre y «Volcanes de Dios» hay un
`<br>`, y el alto de esas dos líneas lo manda el **interlineado heredado del
padre**, no el de cada `span`. Por eso `.brand>span` es una columna flex con
el `<br>` oculto.

**Las rutas se pudren solas.** En junio `rutas.json` citaba 13 lugares; en
septiembre 9 ya no existían y nadie se dio cuenta, porque `renderDrawer`
hacía `.filter(Boolean)` y los huérfanos desaparecían callados: la tarjeta
prometía 4 paradas, el cajón entregaba 2 y la Ruta del Café entregaba 0.
Peor: una ficha **pendiente** entra sin `lat`, así que la URL salía
`…/dir/7.29,-72.49/undefined,undefined`. Por eso existe `check_rutas.js` y
por eso el contador de la tarjeta cuenta paradas **resueltas**, no las que
declara el JSON. **Correr `node check_rutas.js` antes de cada despliegue.**

**El QR impreso ata el sitio a esta dirección.** Un QR no caduca: es la
dirección escrita en cuadritos. Lo que muere es la dirección. Hay carteles
pegados en el pueblo con `labateca-turismo.labatecacolombia.workers.dev`
dentro, así que **esa dirección no se puede borrar nunca**. Si algún día hay
dominio propio, el worker viejo se deja vivo redirigiendo al nuevo.

**La CSP solo deja scripts de `'self'` y de Cloudflare.** `/qr` cargaba la
librería de QR desde cdnjs y por eso nunca pintó un solo código en
producción. Nada de CDN: lo que haga falta, servido desde el sitio.

**El `<title>` vive en el `<head>`,** así que el barrido de `[data-i18n]` no
lo alcanza. Cada página bilingüe declara `data-title-key` en su `<body>` y
`applyI18n()` lo cambia. Sin eso, `?lang=en` dejaba la pestaña en español.

**Cloudinary va sin credenciales.** Ni el sitio, ni los tres `subir_*.py`,
ni los workers usan `api_key` o `api_secret`: todo sube por el preset **sin
firma** `labateca_visitantes` y se entrega por URL pública. Por eso rotar la
clave (hecho el 2 de septiembre de 2026, la filtrada quedó en *Disabled*) no
rompió nada. Si algún día hace falta una API key, que **no** sea Master Admin.

**En `places.json` no cabe una sola etiqueta HTML.** Todos los textos salen
escapados: `gen_seo.js` pasa `desc`, `comoLlegar`, `recomendacion` y también
el **pie de foto** por `esc()`, y `app.js` pinta el pie con `textContent`.
Un `<b>` puesto en un `fotosCap` se lee **literal** en la página. Pasó en el
lote 15-b con los correos del directorio de la Alcaldía y se quitó en v192.
Si algo tiene que ir en negrita o ser un enlace, se cambia la plantilla, no
el dato. Lo único que el dato puede pedir es un **salto de párrafo en `desc`**,
con una línea en blanco, y eso porque `gen_seo.js` lo entiende a propósito.

**Hay dos bares llamados «La Barra» y no tienen nada que ver.**
`teca-bar-la-barra` (Dioselina Vera, mural y mesas de billar) y
`disco-bar-la-barra` (María Segura, sobre el Parque Principal) están a unos
300 m, con dueñas y teléfonos distintos. Las dos fichas se avisan la una de
la otra en la recomendación: si alguien «unifica» los duplicados, rompe eso.

**`pines_lote15.js` y `fix_pines.js` quedaron obsoletos en la v198** y
arrancan con un `process.exit(1)`. Ponían los pines «artísticamente» y los
separaban a empujones cuando se encimaban; correrlos hoy movería los puntos
de su sitio real. Antes de eso dieron dos regresiones seguidas: a las fichas
**pendientes** les escribían `"mapaX": null` (que no es lo mismo que no tener
la clave), y a los lugares lejanos les devolvían un pin dentro del pueblo
porque quitárselo era un paso **manual** —y un paso manual se olvida: se
olvidó en el lote 16 y salió publicado en la v192—. Hoy no hay paso manual:
`pines_mapa.js` calcula el punto o marca `mapaFuera`, y no hay tercera opción.

### El mapa ilustrado (v198)

Ya no es un dibujo inventado. `mapa/osm_labateca.json` son los datos reales de
**OpenStreetMap** descargados el 3 de septiembre de 2026: las carreras 1 a 12,
las calles 1 a 5, el Parque Principal, la parroquia, la alcaldía, el puesto de
salud, el cementerio, la cancha Jesús Núñez, la plaza de toros, los colegios,
las manchas de bosque y el río Culagá.

```
mapa_proj.js     la proyección: (lat,lng) -> (x,y). Un solo sitio decide.
gen_mapa.js      dibuja  files/images/mapa-labateca.svg + data/mapa.json
pines_mapa.js    recalcula mapaX/mapaY de TODOS los lugares
```

**Las tres piezas comparten `mapa_proj.js`.** Si no compartieran la cuenta, los
puntos caerían al lado de la calle que les toca. El lienzo son 1.200 × 1.050 px
= 1.200 × 1.050 m, **1 px = 1 m**, centrado en 7.29835 / −72.49520.

Control de que la cuenta cierra: el pin de la **alcaldía** queda a 9 m del
polígono del edificio en OSM, el de la **Virgen de las Angustias** a 22 m de la
parroquia y el del **cementerio** a 23 m. Y `ferre-agro-tk`, cuya ficha dice «a
unos 500 metros del parque», cae a 509 m medidos. Si algún día un control de
estos se dispara, es que se movió la proyección.

- **`data/mapa.json`** lo escribe `gen_mapa.js` y lo lee `app.js`: medidas del
  lienzo y encuadre inicial. Antes esos números estaban a mano en `app.js`
  (1000 × 700) y el día que el dibujo cambió de tamaño nadie los actualizó.
- **El SVG se carga con `L.imageOverlay`, o sea como imagen**: adentro no corre
  JavaScript, no entra CSS de fuera y **no cargan tipografías web**. Solo
  familias que ya estén en el equipo (Georgia, system-ui).
- **La página agrupa los pines.** 74 de los 96 puntos tienen un vecino a menos
  de 16 px: sueltos, el centro del pueblo es una mancha. La rejilla es propia,
  de unas 30 líneas —`markercluster` es un script de CDN y el CSP no lo deja—.
- **Atribución obligatoria.** Los datos son de OpenStreetMap bajo **ODbL**: el
  crédito va escrito en el propio SVG y en la nota bajo el mapa. No se quita.
- Para volver a bajar los datos de OSM (si el pueblo cambia en el mapa), la
  consulta a Overpass está anotada en la cabecera de `mapa/osm_labateca.json`.

### El clima dice si llueve (v198)

El widget mostraba «Nublado / 0 mm» y con eso no se sabía lo único que importa
antes de subir a una cascada. Ahora Open-Meteo entrega también `hourly` y
`daily`, y la tarjeta pinta tres cosas: si **llueve ahora**, **a qué hora
empieza** si no llueve todavía, y una tira de **12 barras** con la probabilidad
hora por hora. El respaldo de met.no arma la misma tira con sus propios campos.

### Los dos videos de «Cómo usar la app» (v199)

`/media/recorrido-por-la-guia.mp4` (1:05) y `/media/como-crear-tu-ruta.mp4`
(1:24), grabados por José con la pantalla del celular y su voz.

**Los originales pesaban 202 y 276 MB**: el celular graba a 27 Mbps. Quedaron
en 15 y 19 MB con `ffmpeg`, **sin bajar la resolución** —el contenido es texto
de pantalla y encogerlo le quita lo único que importa—. Se les recortó la barra
de estado del teléfono, donde el cronómetro rojo de la grabación corría durante
todo el video, y la barra de navegación de abajo: quedan en **1080 × 2180**.

```bash
# lo que se corrió (ffmpeg vino de: pip install imageio-ffmpeg)
ffmpeg -i original.mp4 \n  -vf "crop=1080:2180:0:112,fps=30" \n  -c:v libx264 -preset medium -crf 26 -pix_fmt yuv420p \n  -c:a aac -b:a 80k -ac 1 -movflags +faststart  salida.mp4
```

- **`-movflags +faststart` no es opcional**: sin él el índice del MP4 queda al
  final del archivo y el navegador tiene que bajarlo entero antes de pintar el
  primer fotograma.
- **Cloudflare tiene un tope de 25 MiB por archivo estático.** El de «crear tu
  ruta» salió en 27 MB con CRF fijo, así que va a **bitrate objetivo en dos
  pasadas** (1700 kbps), que sí garantiza el tamaño.
- **Van servidos desde el propio sitio**, como el MP3 del himno y por el mismo
  motivo: nadie de fuera cuenta quién los vio. La **regla 3-bis del service
  worker deja pasar `/media/` sin interceptar**, que es justo lo que un
  `<video>` necesita.
- **La tarjeta entiende dos orígenes**: `data-video` (public_id de Cloudinary,
  que saca la portada del primer fotograma) o `data-video-src` (archivo
  nuestro, que necesita `data-video-poster` hecho a mano). `data-video-dur`
  pinta la duración sobre la portada.
- **La portada se escoge, no se toma del segundo cero.** Los dos videos
  arrancan en la portada del sitio, así que sus miniaturas salían idénticas.
  La de «crear tu ruta» se sacó del segundo 62, donde se ve el cajón de la
  ruta con sus cuatro paradas.
- Los **botones de Wikiloc de las fichas** (Cascada de Siscata, Mirador El
  Pedregal) no tienen nada que ver con esto y siguen funcionando. Lo que se
  quitó fue la **tarjeta de video** de Wikiloc, que nunca tuvo video.

**El service worker sirve archivos viejos al probar en local.** Si un cambio
en `app.js` o `styles.css` «no aparece», casi siempre es eso: hay que
desregistrar el SW y borrar los cachés, o subir la versión.

**Cloudflare no sirve peticiones `Range`** para archivos estáticos: no manda
`Accept-Ranges` y responde 200 en vez de 206. Comprobado otra vez el 3 de
septiembre de 2026 pidiendo `bytes=1000000-1000999` de un video: contestó 200
con los 19 MB enteros. Por eso el himno y **los dos videos se reproducen pero
no se pueden adelantar**: el navegador solo puede ir de corrido desde el
principio. Con `+faststart` arrancan rápido y duran poco más de un minuto, así
que se aguanta; si algún día entra un video largo, hay que servirlo desde un
sitio que sí responda 206.

**`gen_seo.js` con fichas sin fotos ni coordenadas:** omite `geo` e `image`
del JSON-LD y las metas `geo.position`/`ICBM`, cambia «Cómo llegar» por
«Preguntarle al guía local», oculta la sección de fotos, y la portada social
de cada categoría toma **el primer lugar que sí tenga foto**.

**En este PC:** los heredocs de bash se comen las barras invertidas — para
scripts largos, usar la herramienta Write. Y `io.open(p,"w")` **trunca antes
de escribir**: si el `.write()` falla, el archivo queda en cero bytes. Escribir
a temporal y `os.replace`.

---

### Las coordenadas del pueblo: una sola cifra (v200)

**7.29968 / −72.49452.** Es el Parque Principal, medido. Va en tres sitios y
tienen que decir lo mismo:

```
files/index.html   JSON-LD  TouristDestination.geo   <- lo que lee Google
files/pueblo.html  JSON-LD  Place.geo
files/data/guia.json  ES y EN                        <- lo que lee el modelo
```

Hasta la v200 los tres decían **7.3167 / −72.4833**, que es la cifra
redondeada de los directorios genéricos y cae **2,4 km** fuera del pueblo.
Ese es el punto con el que Google arma el panel del municipio y lo ubica en
el mapa de resultados, y era el que el asistente le daba al visitante. Este
archivo ya traía la buena en «Datos del municipio»; nadie las comparó.
**Si se toca una, se tocan las tres.**

### Ninguna cifra en el hero sin ficha que la respalde (v200)

El hero y el `og:description` decían «Cascadas de hasta 100 metros». Ninguna
de las 116 fichas menciona una altura: la única del sitio son los 25 metros
de la copa del samán. Se quitó. **Antes de escribir un número en la portada,
tiene que estar primero en la ficha del lugar, con su fuente.** La portada es
lo único que ve quien comparte el enlace por WhatsApp; si ahí hay un dato
inventado, el sitio entero deja de merecer confianza.

### El candado del chat (v200)

`worker-chat.js` corría `env.AI.run` **sin ningún límite de peticiones**. Lo
único que lo protegía era comparar el `Origin`, y un `Origin` se escribe a
mano con una línea de `curl`. Peor: la guía del municipio y los lugares
llegaban **desde el navegador** y se pegaban tal cual en las instrucciones
del modelo, así que con el `Origin` puesto cualquiera mandaba su propio
contexto y su propia pregunta. Era una IA gratis a cuenta de la factura.

Tres cerrojos, todos dentro del worker:

- **`dentroDelCupo(ip)`** — 8 preguntas por minuto y 60 por hora, contadas en
  la memoria del isolate. No hay nada que configurar. No es global (Cloudflare
  puede levantar varios isolates), pero como cada visitante cae casi siempre
  en el mismo centro de datos, ataja el abuso real. Si además se crea el
  binding **`RATE_LIMITER`** en el panel, el código lo usa y el límite pasa a
  ser global de verdad.
- **`guiaDelSitio(lang)`** — la guía maestra ya no viene del cliente: el
  worker lee `/data/guia.json` del propio sitio y la cachea una hora. El
  cliente sigue mandando `body.guia` y el worker **la ignora**; se dejó así a
  propósito para que nada se rompa mientras el worker no esté pegado.
- **`MAX_CTX_CHARS = 34000`** — el sitio se autolimita a 30.000 caracteres
  (`CTX_PRESUPUESTO` en `app.js`), pero el worker aceptaba hasta 468.000
  (130 lugares × 6 campos × 600). Eso no era un prompt, era una factura.

**Los tres workers se pegan a mano en el panel de Cloudflare** (están en
`.assetsignore`, no se despliegan con el sitio). Un cambio en `worker-chat.js`
no llega solo por hacer push.

### Una ficha puede estar completa y no tener punto en el mapa (v201)

El **Centro de Rehabilitación** entró completo —diez fotos, descripción larga,
datos oficiales— y **sin coordenada**, porque nadie había ido a la puerta a
tomarla. Estuvo así un día: José la levantó y en la v202 ya tiene su pin
(7.299937 / −72.493739, a 41 m del templo). La regla se queda escrita porque
volverá a pasar, y porque el código ya la soportaba:

- `pendiente: true` significa **no hay contenido**. Pinta el aviso «ficha
  pendiente», esconde el bloque de reseñas y `check_rutas.js` prohíbe usarla
  como parada. Se quita cuando hay contenido, no cuando hay pin.
- **Sin `lat`/`lng`** el generador ya se protege solo: `tieneCoord` cambia el
  botón «Cómo llegar» por «Preguntarle al guía local», omite `geo.position` y
  el `GeoCoordinates` del JSON-LD, y `pines_mapa.js` **no la toca**. El botón
  «Verlo en el mapa» sigue sirviendo: `?lugar=ID` abre el visor de fotos, no
  el mapa, así que no depende de la coordenada.

No inventes una coordenada «aproximada» para que no quede el hueco. Eso es
justo lo que se corrigió en la v198 y en la v200. **Esperar un día a que
alguien camine hasta la puerta cuesta menos que un pin equivocado.**

Lo mismo con las horas. El Centro abre «lunes a viernes, en horario de
oficina» y así quedó escrito, sin inventar el 8:00–12:00 y 2:00–5:00 que uno
supondría: es lo que se confirmó y no más. Y a Ateca se le había caído la hora
de cierre en la v201 justamente por eso; volvió en la v202 cuando el negocio
la confirmó.

### Fotos de pacientes en la puerta de un centro de salud (v201)

De las once fotos del Centro de Rehabilitación se publicaron diez. La que
falta es la única toma del edificio completo, y se cayó porque en la entrada
hay dos personas sentadas, de frente, reconocibles. Son pacientes en la puerta
de un servicio de salud: publicarlas es publicar **quién fue a terapia**, que
bajo la Ley 1581 es dato sensible. No hay consentimiento firmado. El letrero
se ve igual de bien en la foto del muro.

La regla de siempre —revisar cada foto a tamaño completo antes de hornear—
aquí tiene un filo extra: en salud no basta con que la persona no sea el tema
de la foto.

### Textos que manda el propio negocio (v201)

Ateca y EXCII mandaron su propio texto y se cambió la ficha. Dos cosas que
**no** se borran cuando eso pasa:

1. **Lo que las fotos ya dicen.** El texto nuevo de EXCII es de moda y
   accesorios, y no menciona los trámites de documentos; pero dos de sus once
   fotos son el cartel de la fachada con la lista de trámites, y sus pies los
   nombran. Se conservó el párrafo. Una ficha no puede contradecir sus propias
   fotos.
2. **Los datos ya verificados que el texto nuevo no contradice** — el nombre
   de quien atiende, por ejemplo.

Y al revés: lo que el texto nuevo **sí** contradice, manda el texto nuevo. La
hora de cierre de Ateca desapareció porque el negocio confirmó la de apertura
y no la de cierre; se prefiere el dato faltante al dato viejo.

Los emojis y el formato de pieza publicitaria no entran en `desc`: esa cadena
va literal al `<meta name="description">`, al `og:description` y al prompt del
asistente.

## 5. Principios del proyecto

1. **Datos de campo y de la comunidad, no de internet.** Lo que hay en línea
   sobre Labateca está desactualizado o mal.
2. **No inventar nada.** Ni coordenadas, ni horarios, ni nombres de lugares.
   Si no se sabe, se marca como pendiente o se dice que no se sabe. La IA del
   chat tiene esta regla en su prompt y una guarda dura que la obliga.
3. **Si el dueño no firmó, no entra.** Los negocios están porque quisieron.
   Ver `NO_AUTORIZADOS.md` (fuera de `files/`, no se publica) y las fotos
   retenidas en `notas_rest/`.
4. **Sin fotos de menores identificables** ni de terceros sin consentimiento.
5. **Nunca publicar cédulas.** Están en los formatos de Ley 1581, no en el sitio.
6. La salida cuando falta un dato es siempre **el guía local: 321 273 7469**.

---

## 6. Pendiente de verdad

- **Dominio propio.** Sigue en `labateca-turismo.labatecacolombia.workers.dev`.
  Al comprarlo: cambiar `SITIO` en `gen_seo.js`, `ALLOWED_ORIGINS` en los
  workers, y volver a correr los generadores.
- **Ruta del Café.** La cadena está completa y es caminable —Comité de
  Cafeteros, Cooperacafé (pesan, trillan y pagan de contado), Café BTK
  (tostión y empaque) y los cafés que la sirven—, y los horarios dejan una
  sola ventana: **sábado en la mañana**. Falta la ficha de una **finca
  cafetera**; sin ella la ruta no se publica. Es la ficha con más retorno
  del proyecto.
- **Levantar el páramo en campo.** La ruta existe como tarjeta «en
  preparación» y remite al guía. Laguna Negra y La Ovejera siguen sin
  coordenadas.
- **`/pueblo` lleva desde la v197 un aviso de «a la espera de verificación
  oficial»**, arriba del todo. No dice que la historia sea dudosa —las fuentes
  están enlazadas— sino que **ninguna entidad la ha revisado ni certificado**,
  que es distinto. Si algún día la Alcaldía o una academia lo revisa, se quita.
- **Traducir el cuerpo** de `pueblo`, `viva`, `libro`, `biblioteca` e
  historia. Es traducción real, no enrutado. `/transporte` ya está hecha
  (v191) y sirve de molde: página gemela bajo `/en/`, `hreflang` en las dos,
  su entrada en el sitemap de `gen_seo.js`, y salir de `SOLO_ES`.
- **`guias.json` sigue vacío.** La sección existe y se enciende sola cuando el
  archivo tenga entradas. Falta el **nombre** del guía local —en el proyecto
  solo está el teléfono— y su consentimiento.
- **Falta la firma de los siete intermunicipales** de `conductores.json`
  (hoja 2 del registro). José decidió publicarlos igual: son empresas y rutas
  cuyos teléfonos y horarios ellas mismas hacen circular en avisos. Conviene
  recogerlas, y quedan dos hojas del registro (3 y 4) sin escanear.
- **Quedan las hojas 3 y 4 del registro sin escanear.** La 1 llegó dos veces:
  la segunda vez traía la fila 7 llena, que era Goyo. Vale la pena volver a
  pedirlas cuando se llenen más filas.
- **Los cinco avisos de Cotranal son provisionales.** José los publicó para
  que la tarjeta no quedara vacía, con el plan de **reemplazarlos por fotos
  de verdad del bus**. Cuando lleguen: hornear con `bake_transporte.py`,
  subir como `labateca/transporte-…`, cambiar el `foto` y **quitar el
  `fotoTipo`** —con eso el pie desaparece solo—. Falta también la del carro
  de Javier Arturo, que es el único sin imagen.
- **El formulario no llega por correo:** `web3formsKey` sigue en
  `"TU_ACCESS_KEY"`, así que `app.js` cae al respaldo de WhatsApp.
- **Reseñas en cero.** El sistema funciona; falta pedirlas. Revisar `/moderar`
  por si hay enviadas y sin aprobar.
- **Hospedaje: solo 3**, y el hotel principal dijo que no. Es el hueco de
  producto más grande de la guía.
- **71 fotos antiguas retenidas** esperando firmas de Ley 1581 —11 del primer
  lote y 60 del segundo—. Las 60 del segundo están listadas una por una en
  `notas_rest/retenidas.txt`: 22 con menores y 38 con adultos identificables.
  (Aquí decía 69, que eran las líneas del archivo, no las fotos.)


---

## 7. Datos del municipio (verificados)

Labateca, «volcanes de Dios» en lengua chitarera. Poblada como **pueblo de
indios el 19 de julio de 1623** por el oidor Juan de Villabona y Zubiaurre,
juntando trece capitanías indígenas; municipio desde **1930**. **7.123
habitantes** (DANE 2023), 253 km², **1.566 m s. n. m.**, ~20 °C, a 113 km de
Cúcuta (~3,5 h). Más de 2.000 ha en el **Páramo de Santurbán**. Patrona:
**Nuestra Señora de las Angustias**, aparecida en **Bochagá, vereda de
Toledo**. Casco urbano: 7.2996816, −72.49452.

**Himno:** letra de Adolfo León Capacho Peñaloza, música de **Pedro Rafael
Vera Bastos** (confirmado por José, sept. 2026; coincide con «Vivencias en mi
Pueblo», que lo imprime con sus créditos al pie), **interpretación de Carlos
Alberto Rojas** (corregido por José el 3 sep 2026; antes decía «profesor Iván
Delgado», que era el dato equivocado —no volver a ponerlo—), estrenado el 21 de
noviembre de 1997. El libro atribuía la
música a *Luis Raúl* Vera Bastos, el número 17 de la promoción de 1968: esa
anotación se quitó del manuscrito v24, el nombre del graduado se dejó como lo
trae el mosaico.

Historia documentada por **Silvano Pabón Villamizar** (UIS). Las fuentes están
transcritas en `LIBRO LABATECA/` y publicadas en `/historia/` y `/biblioteca`.
