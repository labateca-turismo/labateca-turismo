# Labateca · Volcanes de Dios — cómo está hecho este sitio

Guía turística del municipio de **Labateca, Norte de Santander (Colombia)**.
Bilingüe español/inglés. Sin frameworks, sin bundler, sin paso de compilación.

> Este archivo se carga solo como contexto al abrir el proyecto. Si algo de
> aquí no coincide con el código, **el código manda y este archivo hay que
> corregirlo**. Estuvo desactualizado desde junio hasta el 2 de septiembre de
> 2026 y en ese lapso hizo más daño que bien.

**Estado al 2 de septiembre de 2026 (v194):** 116 lugares · 600 fotos ·
6 rutas temáticas · 292 páginas HTML · 286 URLs en el sitemap.

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
│  ├─ media/           ← el MP3 del himno
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
- **`mapaFuera: true`** = tiene `lat`/`lng` de verdad, pero **no va en el mapa
  ilustrado**, que solo dibuja el casco urbano. Su pin caería en un punto del
  pueblo donde el lugar no está. Hoy son cinco: La Peña, Bike Rafa, Soma,
  el Chorrerón y el Supermercado La Y. `pines_lote15.js` los respeta.
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
  "whatsapp":"573112001221",
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

**`pines_lote15.js` salta a las pendientes y a las `mapaFuera`.** Dos veces
seguidas metió a quien no debía. Con las **pendientes**, que entran sin
coordenadas, `fx()`/`fy()` devolvían `NaN` → `JSON.stringify` lo escribe como
`null` → quedaban con `"mapaX": null`, que **no** es lo mismo que no tener la
clave. Y a **La Peña, Bike Rafa, Soma y el Chorrerón** les volvió a poner pin
del mapa ilustrado: en el lote 15 se les había quitado **a mano**, y un paso
manual se olvida —se olvidó en el 16 y salió publicado en la v192—. Por eso
ahora la decisión vive en el dato (`mapaFuera: true`) y no en la memoria de
nadie. Si vuelve a aparecer un `"mapaX": null`, o un pin del casco urbano
sobre un lugar que está a kilómetros, es esto.

**El service worker sirve archivos viejos al probar en local.** Si un cambio
en `app.js` o `styles.css` «no aparece», casi siempre es eso: hay que
desregistrar el SW y borrar los cachés, o subir la versión.

**Cloudflare no sirve peticiones `Range`** para archivos estáticos: no manda
`Accept-Ranges` y responde 200 en vez de 206. Por eso el audio del himno se
oye pero **no se puede adelantar**.

**`gen_seo.js` con fichas sin fotos ni coordenadas:** omite `geo` e `image`
del JSON-LD y las metas `geo.position`/`ICBM`, cambia «Cómo llegar» por
«Preguntarle al guía local», oculta la sección de fotos, y la portada social
de cada categoría toma **el primer lugar que sí tenga foto**.

**En este PC:** los heredocs de bash se comen las barras invertidas — para
scripts largos, usar la herramienta Write. Y `io.open(p,"w")` **trunca antes
de escribir**: si el `.write()` falla, el archivo queda en cero bytes. Escribir
a temporal y `os.replace`.

---

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
- **El bus de la Providencia —«Goyo», placa XHB-489— tiene foto pero no tiene
  datos:** no aparece en las hojas escaneadas. Sin teléfono ni horario no
  entra.
- **Una cifra por confirmar:** el WhatsApp de Javier Arturo Montañez
  (`3118898958`) lleva el último dígito corregido a mano en el formato.
- **El formulario no llega por correo:** `web3formsKey` sigue en
  `"TU_ACCESS_KEY"`, así que `app.js` cae al respaldo de WhatsApp.
- **Reseñas en cero.** El sistema funciona; falta pedirlas. Revisar `/moderar`
  por si hay enviadas y sin aprobar.
- **Hospedaje: solo 3**, y el hotel principal dijo que no. Es el hueco de
  producto más grande de la guía.
- **69 fotos antiguas retenidas** esperando firmas de Ley 1581.


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
Pueblo», que lo imprime con sus créditos al pie), interpretación del profesor
Iván Delgado, estrenado el 21 de noviembre de 1997. El libro atribuía la
música a *Luis Raúl* Vera Bastos, el número 17 de la promoción de 1968: esa
anotación se quitó del manuscrito v24, el nombre del graduado se dejó como lo
trae el mosaico.

Historia documentada por **Silvano Pabón Villamizar** (UIS). Las fuentes están
transcritas en `LIBRO LABATECA/` y publicadas en `/historia/` y `/biblioteca`.
