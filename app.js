/* ============================================================
   ⚙️ CONFIGURACIÓN — EDITA SOLO ESTO PARA PERSONALIZAR
   ============================================================ */
const CONFIG = {
  // Número de WhatsApp en formato internacional, SIN "+" ni espacios
  whatsapp: "573209060582",
  // Correo de contacto
  email: "labatecacolombia@gmail.com",
  // Clave gratuita de Web3Forms (https://web3forms.com) para recibir el formulario por correo.
  // Mientras no la pongas, el formulario enviará por WhatsApp automáticamente.
  web3formsKey: "TU_ACCESS_KEY",
  // Cloud name de Cloudinary (https://cloudinary.com — cuenta gratuita).
  // Las fotos se suben a la carpeta "labateca" en la Media Library.
  cloudName: "dwotodtoa",
  // URL del Worker de IA (Cloudflare Workers AI)
  chatWorkerUrl: "https://labateca-chat.labatecacolombia.workers.dev",
  // URL del Worker de reseñas de visitantes (Cloudflare D1). Vacío = sección oculta.
  reviewsWorkerUrl: "https://labateca-reviews.labatecacolombia.workers.dev",
  // Upload preset SIN FIRMA de Cloudinary para fotos de visitantes (carpeta visitantes/)
  uploadPreset: "labateca_visitantes",
  // Centro del pueblo (Parque Principal) — coordenadas del casco urbano
  townCoords: { lat: 7.2996816, lng: -72.49452 },
  // Redes sociales (pon tus enlaces; deja "#" si aún no tienes)
  social: {
    instagram: "#",
    facebook: "#",
    tiktok: "#"
  }
};

/* ============================================================
   🖼️ CLOUDINARY HELPER
   cldUrl(publicId, transform) → URL optimizada lista para <img>
   Ejemplo: cldUrl("labateca/lirgua-01", "w_640,h_400,c_fill,f_auto,q_auto")
   Si cloudName está vacío o publicId es vacío, devuelve "".
   ============================================================ */
function cldUrl(publicId, transform) {
  if (!publicId || !CONFIG.cloudName) return '';
  const tr = transform || 'w_640,h_400,c_fill,f_auto,q_auto';
  return `https://res.cloudinary.com/${CONFIG.cloudName}/image/upload/${tr}/${publicId}`;
}

/* Video de Cloudinary (q_auto/f_auto entrega el formato y peso óptimo por dispositivo) */
function cldVideo(publicId, transform) {
  if (!publicId || !CONFIG.cloudName) return '';
  const tr = transform || 'q_auto,f_auto';
  return `https://res.cloudinary.com/${CONFIG.cloudName}/video/upload/${tr}/${publicId}.mp4`;
}
/* Portada del video (primer fotograma como imagen ligera) */
function cldVideoPoster(publicId) {
  if (!publicId || !CONFIG.cloudName) return '';
  return `https://res.cloudinary.com/${CONFIG.cloudName}/video/upload/so_0,w_700,c_fill,f_auto,q_auto/${publicId}.jpg`;
}
/* Convierte cada .video-card[data-video] con public_id en un video con portada
   que SOLO se descarga al dar play (no afecta la carga inicial). Si data-video
   está vacío, deja el placeholder "Video próximamente". */
function initVideos() {
  document.querySelectorAll('.video-card[data-video]').forEach(card => {
    const id = card.getAttribute('data-video');
    const ph = card.querySelector('.video-ph');
    if (!id || !ph || card.dataset.ready) return;     // sin video aún → placeholder
    card.dataset.ready = '1';
    const poster = cldVideoPoster(id);
    if (poster) { ph.style.backgroundImage = `url("${poster}")`; ph.classList.add('has-poster'); }
    ph.addEventListener('click', () => {
      const v = document.createElement('video');
      v.src = cldVideo(id);
      v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'none';
      if (poster) v.setAttribute('poster', poster);
      ph.replaceWith(v);
      try { v.play(); } catch (e) {}
    }, { once: true });
  });
}

/* ============================================================
   📍 DATOS DE LUGARES — cargados desde data/places.json
   El array se llena en init() vía fetch.
   Schema: id, categoria, verified, coordsApprox, lat, lng,
           mapaX, mapaY, telefono, nombre{es,en}, desc{es,en},
           comoLlegar{es,en}, dist{es,en}, tiempo{es,en},
           dificultad{es,en}, recomendacion{es,en}, fotos[]
   ============================================================ */
let PLACES = [];

/* ── BLOQUE ELIMINADO: los datos viven ahora en data/places.json ──
   Si necesitas un respaldo local de emergencia, copia aquí el JSON.
const _PLACES_FALLBACK = [
  {
    id:"templo", cat:"cultura", verified:true, coordsApprox:false,
    lat:7.3167, lng:-72.4833, phone:"",
    name:{es:"Templo Nuestra Señora de las Angustias", en:"Our Lady of Sorrows Church"},
    desc:{es:"Templo parroquial colonial que custodia el lienzo original de la Virgen y una pila bautismal tallada en piedra. El corazón espiritual e histórico del pueblo.",
          en:"Colonial parish church that safeguards the original canvas of the Virgin and a stone-carved baptismal font. The town's spiritual and historic heart."},
    dist:{es:"En el casco urbano", en:"In town center"},
    time:{es:"Llegada inmediata", en:"Right there"},
    diff:{es:"Acceso fácil", en:"Easy access"},
    rec:{es:"Pregunta por los horarios de misa para entrar a verlo por dentro.", en:"Ask for mass times to see the interior."}
  },
  {
    id:"parque", cat:"cultura", verified:true, coordsApprox:false,
    lat:7.3165, lng:-72.4835, phone:"",
    name:{es:"Parque Principal", en:"Main Square"},
    desc:{es:"El punto de encuentro de Labateca, rodeado de la arquitectura tradicional, el busto del Libertador y el monumento La Columna. Ideal para empezar el recorrido.",
          en:"Labateca's gathering point, surrounded by traditional architecture, the Liberator's bust and La Columna monument. The perfect place to start."},
    dist:{es:"Centro del pueblo", en:"Town center"},
    time:{es:"Punto de partida", en:"Starting point"},
    diff:{es:"Acceso fácil", en:"Easy access"},
    rec:{es:"Por las tardes es el mejor momento para tomar fotos con buena luz.", en:"Late afternoon offers the best light for photos."}
  },
  {
    id:"casa-cultura", cat:"cultura", verified:true, coordsApprox:true,
    lat:7.3169, lng:-72.4830, phone:"",
    name:{es:"Casa de la Cultura", en:"House of Culture"},
    desc:{es:"Espacio dedicado a la memoria y las tradiciones del municipio. Un buen lugar para entender la historia chitarera y la identidad labatecana.",
          en:"A space dedicated to the town's memory and traditions. A great spot to grasp the Chitarera heritage and Labateca's identity."},
    dist:{es:"A pasos del parque", en:"Steps from the square"},
    time:{es:"2 min a pie", en:"2 min walk"},
    diff:{es:"Acceso fácil", en:"Easy access"},
    rec:{es:"Verifica días de apertura con la Alcaldía antes de ir.", en:"Check opening days with the town hall first."}
  },
  {
    id:"lirgua", cat:"naturaleza", verified:true, coordsApprox:true,
    lat:7.305, lng:-72.470, phone:"",
    name:{es:"Cascada La Lirgua", en:"La Lirgua Waterfall"},
    desc:{es:"La joya ecoturística de Labateca: una imponente cascada rodeada de naturaleza exuberante. Una de las caídas de agua más fotografiadas de la región.",
          en:"Labateca's ecotourism jewel: an imposing waterfall surrounded by lush nature. One of the most photographed falls in the region."},
    dist:{es:"~7 km del pueblo", en:"~7 km from town"},
    time:{es:"Carro + caminata", en:"Car + hike"},
    diff:{es:"Dificultad media", en:"Moderate"},
    rec:{es:"Ve con guía local, lleva calzado antideslizante y sal temprano.", en:"Go with a local guide, wear non-slip shoes and start early."}
  },
  {
    id:"laguna-negra", cat:"naturaleza", verified:false, coordsApprox:true,
    lat:7.290, lng:-72.450, phone:"",
    name:{es:"Laguna Negra", en:"Black Lagoon"},
    desc:{es:"Una laguna de montaña enclavada en el entorno del páramo, de aguas oscuras y quietas. Un paraje de altura para los amantes del senderismo.",
          en:"A mountain lagoon set in the páramo, with dark, still waters. A high-altitude spot for hiking lovers."},
    dist:{es:"Zona de páramo", en:"Páramo area"},
    time:{es:"Por confirmar", en:"To be confirmed"},
    diff:{es:"Dificultad alta", en:"Challenging"},
    rec:{es:"Requiere guía y buena condición física. Clima frío del páramo.", en:"Requires a guide and good fitness. Cold páramo weather."}
  },
  {
    id:"santurban", cat:"naturaleza", verified:true, coordsApprox:true,
    lat:7.270, lng:-72.440, phone:"",
    name:{es:"Páramo de Santurbán (sector Labateca)", en:"Santurbán Páramo (Labateca sector)"},
    desc:{es:"Más de 2.000 hectáreas del municipio pertenecen a este ecosistema único, fábrica de agua de Norte de Santander, con frailejones y biodiversidad de altura.",
          en:"Over 2,000 hectares of the municipality belong to this unique ecosystem, a water factory for Norte de Santander, with frailejones and high-altitude biodiversity."},
    dist:{es:"Zona alta del municipio", en:"Upper municipality"},
    time:{es:"Excursión de día", en:"Full-day trip"},
    diff:{es:"Dificultad alta", en:"Challenging"},
    rec:{es:"Solo con guía autorizado. Abrígate: temperaturas muy bajas.", en:"Authorized guide only. Dress warm: very low temperatures."}
  },
  {
    id:"cafe", cat:"gastronomia", verified:false, coordsApprox:true,
    lat:7.320, lng:-72.490, phone:"",
    name:{es:"Ruta del Café", en:"Coffee Route"},
    desc:{es:"Labateca y Toledo son tierra de café orgánico tipo exportación. Visita una finca cafetera para vivir el proceso del grano y probarlo recién tostado.",
          en:"Labateca and Toledo are land of organic export-grade coffee. Visit a coffee farm to experience the bean's journey and taste it freshly roasted."},
    dist:{es:"Veredas cercanas", en:"Nearby countryside"},
    time:{es:"Por coordinar", en:"To arrange"},
    diff:{es:"Acceso medio", en:"Moderate access"},
    rec:{es:"Espacio para una finca de la comunidad. Coordina la visita con anticipación.", en:"Spot for a community farm. Arrange the visit in advance."}
  },
  {
    id:"dulces", cat:"gastronomia", verified:true, coordsApprox:true,
    lat:7.3166, lng:-72.4837, phone:"",
    name:{es:"Dulces y sabores típicos", en:"Local sweets & flavors"},
    desc:{es:"No te vayas sin probar el arequipe de café, el quesillo de ahuyama, los bocadillos, el guarapo de frutas y las hayacas de maíz. Pura tradición nortesantandereana.",
          en:"Don't leave without trying coffee arequipe, squash quesillo, bocadillos, fruit guarapo and corn hayacas. Pure regional tradition."},
    dist:{es:"En el pueblo", en:"In town"},
    time:{es:"Cuando quieras", en:"Anytime"},
    diff:{es:"Acceso fácil", en:"Easy access"},
    rec:{es:"Pregunta en las tiendas del parque por los productos del día.", en:"Ask the shops around the square for the day's treats."}
  },
  {
    id:"hospedaje", cat:"hospedaje", verified:false, coordsApprox:true,
    lat:7.3163, lng:-72.4832, phone:"",
    name:{es:"Hospedaje local", en:"Local lodging"},
    desc:{es:"Espacio reservado para los hospedajes, posadas y fincas turísticas de Labateca. Si tienes uno, ¡este es tu lugar en la guía!",
          en:"A space reserved for Labateca's lodges, inns and tourist farms. If you run one, this is your spot in the guide!"},
    dist:{es:"Por definir", en:"To be defined"},
    time:{es:"—", en:"—"},
    diff:{es:"—", en:"—"},
    rec:{es:"Aporte de la comunidad: agrega aquí los datos de tu negocio.", en:"Community contribution: add your business details here."}
  }
];
── FIN BLOQUE ELIMINADO ── */

/* ============================================================
   🌐 TRADUCCIONES (ES / EN)
   ============================================================ */
const I18N = {
  es:{
    brand_sub:"Volcanes de Dios",
    nav_home:"Inicio", nav_about:"El pueblo", nav_places:"Lugares", nav_map:"Mapa", nav_gallery:"Galería", nav_contact:"Contacto",
    hero_eyebrow:"Norte de Santander · Colombia",
    hero_tag:"Donde la montaña guarda volcanes de Dios",
    hero_lead:"Cascadas de hasta 100 metros, café de altura y el Páramo de Santurbán. Una perla escondida del suroriente nortesantandereano, lista para descubrirse.",
    hero_btn1:"Explorar lugares", hero_btn2:"Ver mapa",
    w_loading:"Consultando clima…", w_place:"Clima en Labateca", w_feels:"Sensación",
    stat_alt:"m.s.n.m.", stat_dist:"km a Cúcuta", stat_temp:"Promedio",
    dist_btn:"Calcular distancia desde mi ubicación",
    dist_locating:"Ubicándote…",
    dist_pre:"Estás a", dist_post:"de Labateca (en línea recta)",
    dist_route:"Ver ruta y tiempo en Google Maps",
    dist_denied:"No pudimos acceder a tu ubicación. Activa los permisos de ubicación e inténtalo de nuevo.",
    dist_unsupported:"Tu navegador no permite geolocalización. Usa el botón “Cómo llegar”.",
    dist_retry:"Reintentar",
    about_eyebrow:"El pueblo", about_title:"Una perla del suroriente",
    about_p1:"<strong>Labateca</strong> —“volcanes de Dios” en lengua chitarera— es un municipio de montaña reconocido por su café, su ganadería y unas cascadas ecoturísticas que no envidian nada a destinos más famosos.",
    about_p2:"Más de 2.000 hectáreas de su territorio forman parte del <strong>Páramo de Santurbán</strong>, una de las grandes fábricas de agua de Norte de Santander. Su templo colonial guarda el lienzo original de la Virgen de las Angustias y una pila bautismal tallada en piedra.",
    fact1_t:"Naturaleza viva", fact1_d:"Cascadas, ríos y páramo a pocos minutos del casco urbano.",
    fact2_t:"Café de altura", fact2_d:"Junto con Toledo, tierra de café orgánico tipo exportación.",
    fact3_t:"Herencia colonial", fact3_d:"Templo de Nuestra Señora de las Angustias y parque principal.",
    quote:"“De verdes altares se visten tus cerros, figurando murallas de recio color.”", quote_src:"— Himno de Labateca",
    places_eyebrow:"Qué visitar", places_title:"Lugares para descubrir",
    places_sub:"Filtra por categoría, guarda tus favoritos ♥ y arma tu ruta. Toca \"Cómo llegar\" para abrir Google Maps.",
    rutas_eyebrow:"Planes listos", rutas_title:"Rutas sugeridas",
    rutas_sub:"Elige una ruta y se cargará automáticamente en tu planificador. Puedes añadir o quitar lugares a tu gusto.",
    rutas_btn:"Usar esta ruta", rutas_btn_active:"✓ Ruta cargada",
    rutas_lugares:"lugares", rutas_duracion:"Duración", rutas_dificultad:"Dificultad",
    nav_routes:"Rutas",
    map_eyebrow:"Ubícate", map_title:"Todo Labateca en un mapa", map_sub:"Explora cada lugar, mira las distancias y abre la navegación con un toque.",
    map_tab_real:"Mapa real", map_tab_ilustrado:"Mapa ilustrado",
    map_track:"Sendero a pie",
    map_tiles_off:"Sin conexión al fondo del mapa. Los puntos y senderos sí funcionan.",
    cta_share:"Compartir",
    skip_link:"Saltar al contenido", menu_aria:"Abrir menú de navegación", nav_close_aria:"Cerrar menú",
    drawer_open_aria:"Abrir Mi ruta", drawer_title_aria:"Mi ruta — lugares guardados",
    fav_add:"Añadir a favoritos:", fav_remove:"Quitar de favoritos:",
    foot_privacy:"Política de privacidad", foot_terms:"Términos de uso",
    hl_eyebrow:"Tu viaje", hl_title:"Cómo llegar a Labateca",
    hl_sub:"Paso a paso desde las tres ciudades más cercanas. Los horarios y tarifas de bus se confirman en cada terminal.",
    hl_cucuta_t:"Desde Cúcuta",
    hl_cucuta_d:"Toma un bus o buseta hacia Labateca en la Terminal de Transportes de Cúcuta (ruta por Pamplona o por Toledo, según la empresa). Son ~113 km, entre 3 y 4 horas por carretera de montaña. Pregunta en taquilla por el horario de regreso del mismo día.",
    hl_pamplona_t:"Desde Pamplona",
    hl_pamplona_d:"Pamplona es el punto intermedio de la ruta. Desde su terminal salen busetas y camionetas hacia Labateca y Toledo. Es el tramo más corto y con los paisajes de páramo más bonitos del recorrido.",
    hl_buca_t:"Desde Bucaramanga",
    hl_buca_d:"Toma un bus Bucaramanga → Pamplona (~4 horas) y allí haz el cambio hacia Labateca. Sal temprano: el último transporte del día hacia el municipio suele salir en la tarde.",
    hl_tip:"💡 Si vienes en carro propio: la vía está pavimentada en su mayoría; tanquea en Pamplona o Cúcuta y descarga el mapa offline antes de salir, hay tramos sin señal.",
    ev_eyebrow:"Calendario", ev_title:"Fiestas y eventos",
    ev_sub:"Las fechas en las que Labateca se viste de fiesta. Planea tu visita para vivirlas.",
    gu_eyebrow:"Gente local", gu_title:"Guías y baquianos",
    gu_sub:"Personas de la comunidad que conocen cada sendero. Contrátalos directo por WhatsApp: tu visita deja ingreso local.",
    rv_open:"Opiniones de visitantes",
    rv_loading:"Cargando opiniones…",
    rv_empty:"Aún no hay opiniones de este lugar. ¡Sé la primera persona en contar su experiencia!",
    rv_error:"No pudimos conectarnos. Inténtalo de nuevo en un momento.",
    rv_count:"opiniones",
    rv_form_title:"Cuéntanos tu experiencia",
    rv_name_ph:"Tu nombre",
    rv_comment_ph:"¿Cómo fue tu visita? ¿Qué recomiendas?",
    rv_photo:"📷 Agregar una foto de tu visita (opcional)",
    rv_send:"Enviar opinión",
    rv_moderation:"Tu opinión se publica después de una revisión rápida. ¡Gracias por aportar!",
    rv_need_stars:"Elige una calificación de 1 a 5 estrellas.",
    rv_sending:"Enviando…",
    rv_thanks:"¡Gracias! Tu opinión quedó en revisión y pronto será publicada.",
    rv_photo_big:"La foto es muy pesada (máximo 8 MB).",
    rv_rate:"Se han enviado varias opiniones seguidas desde esta conexión. Espera un rato e inténtalo de nuevo.",
    map_ilustrado_note:"Mapa artístico de referencia · toca un punto para ver la ficha · \"Cómo llegar\" abre Google Maps con la ubicación real",
    map_fallback:"No pudimos cargar el mapa interactivo. Revisa tu conexión e inténtalo de nuevo, o usa el botón \"Cómo llegar\" de cada lugar.",
    gal_eyebrow:"Postales", gal_title:"Galería", gal_sub:"Reemplaza estos espacios por tus propias fotos (mejor calidad y sin problemas de derechos).",
    contact_eyebrow:"Hablemos", contact_title:"¿Planeas tu visita?",
    contact_sub:"Escríbenos para recomendaciones, guías locales o información de hospedaje. Respondemos por el canal que prefieras.",
    pdf_btn:"Descargar guía PDF", pdf_sub:"Guía completa de lugares · sin conexión",
    pdf_generating:"Generando PDF…", pdf_done:"¡PDF listo! Revisa tus descargas.",
    ch_wa:"Respuesta rápida · toca para chatear", ch_mail_t:"Correo",
    ch_loc_t:"Cómo llegar", ch_loc_d:"Parque Principal de Labateca",
    f_name:"Nombre", f_name_ph:"Tu nombre", f_email:"Correo", f_topic:"Tema",
    f_topic1:"Recomendaciones de viaje", f_topic2:"Hospedaje", f_topic3:"Guía local", f_topic4:"Otro",
    f_msg:"Mensaje", f_msg_ph:"Cuéntanos qué te gustaría conocer…", f_send:"Enviar mensaje",
    foot_about:"Guía turística comunitaria de Labateca, Norte de Santander. Hecha por y para quienes aman este rincón de montaña.",
    foot_explore:"Explora", foot_useful:"Útil", foot_directions:"Cómo llegar",
    foot_collaborate:"¿Tienes un negocio? Aparece aquí",
    foot_qr:"Carteles QR",
    foot_progress:"Avances del proyecto",
    foot_rights:"Labateca Turismo · Hecho con cariño en la montaña", foot_data:"Datos verificados localmente · algunos por confirmar",
    route_title:"Mi ruta", route_open:"Ver ruta en Google Maps", route_clear:"Vaciar ruta",
    cta_how:"Cómo llegar", cta_add:"Agregar", cta_added:"En ruta",
    cta_whatsapp:"WhatsApp", cta_whatsapp_t:"Contactar por WhatsApp",
    cta_drive:"Llegar al inicio", cta_trail:"Ver sendero",
    cta_wikiloc:"Navegar (GPS)", cta_wikiloc_t:"Abre el sendero en Wikiloc: te guía con tu ubicación en vivo y funciona sin señal (descarga la ruta antes de salir).",
    usar_eyebrow:"Guía rápida", usar_title:"Cómo usar la app", usar_sub:"Videos cortos para aprovecharla en segundos. ¿Buscas qué visitar? Toca el botón y explora todos los lugares.",
    usar_video_soon:"Video próximamente", usar_v1:"Encontrar lugares y armar tu ruta", usar_v2:"Navegar senderos con GPS (Wikiloc)", usar_v3:"El mapa, el clima y \"Cómo llegar\"", usar_cta:"Ver todos los lugares",
    back_home:"Volver al inicio",
    visits_label:"visitas", visits_aria:"Personas que han visitado el sitio",
    fil_all:"Todos", fil_naturaleza:"Naturaleza", fil_cultura:"Cultura", fil_gastronomia:"Gastronomía", fil_hospedaje:"Hospedaje", fil_fav:"♥ Favoritos",
    verify_badge:"Por verificar", approx_note:"Ubicación aproximada — por confirmar en campo",
    route_empty:"Tu ruta está vacía. Toca “Agregar” en los lugares que quieras visitar.",
    fav_empty:"Aún no tienes favoritos. Toca el ♥ en un lugar para guardarlo.",
    msg_ok:"¡Gracias! Tu mensaje fue enviado. Te responderemos pronto.",
    msg_wa:"Te llevamos a WhatsApp para enviar tu mensaje…",
    msg_err:"Hubo un problema. Escríbenos por WhatsApp y con gusto te ayudamos.",
    ph_photo:"Tu foto aquí",
    lb_close:"Cerrar galería", lb_prev:"Foto anterior", lb_next:"Foto siguiente",
    lb_of:"de", lb_no_photo:"Foto próximamente", lb_open:"Ver fotos",
    gal_click_hint:"Toca para ver la ficha del lugar",
    chat_title:"Guía Labateca IA", chat_subtitle:"Pregúntame lo que quieras",
    chat_welcome:"¡Hola! Soy tu guía virtual de Labateca. Puedo ayudarte con lugares para visitar, cómo llegar, qué comer y mucho más. ¿En qué te ayudo?",
    chat_placeholder:"Escribe tu pregunta…",
    chat_sug1:"¿Qué hacer en Labateca?", chat_sug2:"¿Cómo llegar desde Cúcuta?", chat_sug3:"¿Qué comer?",
    chat_error:"No pude conectarme ahora. <a href='{{wa}}' target='_blank' style='color:var(--clay);font-weight:700'>Escríbenos por WhatsApp</a> y te ayudamos."
  },
  en:{
    brand_sub:"God's Volcanoes",
    nav_home:"Home", nav_about:"The town", nav_places:"Places", nav_map:"Map", nav_gallery:"Gallery", nav_contact:"Contact",
    hero_eyebrow:"Norte de Santander · Colombia",
    hero_tag:"Where the mountains keep God's volcanoes",
    hero_lead:"Waterfalls up to 100 meters tall, high-altitude coffee and the Santurbán Páramo. A hidden gem of southeastern Norte de Santander, waiting to be discovered.",
    hero_btn1:"Explore places", hero_btn2:"View map",
    w_loading:"Checking weather…", w_place:"Weather in Labateca", w_feels:"Feels like",
    stat_alt:"m.a.s.l.", stat_dist:"km to Cúcuta", stat_temp:"Average",
    dist_btn:"Calculate distance from my location",
    dist_locating:"Locating you…",
    dist_pre:"You're", dist_post:"from Labateca (straight line)",
    dist_route:"See route & time on Google Maps",
    dist_denied:"We couldn't access your location. Enable location permissions and try again.",
    dist_unsupported:"Your browser doesn't support geolocation. Use the “Directions” button.",
    dist_retry:"Try again",
    about_eyebrow:"The town", about_title:"A gem of the southeast",
    about_p1:"<strong>Labateca</strong> —“God's volcanoes” in the Chitarera tongue— is a mountain town known for its coffee, cattle and ecotourism waterfalls that rival far more famous destinations.",
    about_p2:"Over 2,000 hectares of its territory belong to the <strong>Santurbán Páramo</strong>, one of the great water factories of Norte de Santander. Its colonial church guards the original canvas of the Virgin of Sorrows and a stone-carved baptismal font.",
    fact1_t:"Living nature", fact1_d:"Waterfalls, rivers and páramo just minutes from town.",
    fact2_t:"Highland coffee", fact2_d:"Alongside Toledo, a land of organic export-grade coffee.",
    fact3_t:"Colonial heritage", fact3_d:"Our Lady of Sorrows church and the main square.",
    quote:"“Your hills dress in green altars, shaping walls of mighty color.”", quote_src:"— Anthem of Labateca",
    places_eyebrow:"What to see", places_title:"Places to discover",
    places_sub:"Filter by category, save your favorites ♥ and build your route. Tap \"Directions\" to open Google Maps.",
    rutas_eyebrow:"Ready-made plans", rutas_title:"Suggested routes",
    rutas_sub:"Pick a route and it loads automatically into your planner. Add or remove places as you wish.",
    rutas_btn:"Use this route", rutas_btn_active:"✓ Route loaded",
    rutas_lugares:"places", rutas_duracion:"Duration", rutas_dificultad:"Difficulty",
    nav_routes:"Routes",
    map_eyebrow:"Find your way", map_title:"All of Labateca on one map", map_sub:"Explore every place, check distances and launch navigation with one tap.",
    map_tab_real:"Real map", map_tab_ilustrado:"Illustrated map",
    map_track:"Walking trail",
    map_tiles_off:"Map background unavailable on this connection. Points and trails still work.",
    cta_share:"Share",
    skip_link:"Skip to content", menu_aria:"Open navigation menu", nav_close_aria:"Close menu",
    drawer_open_aria:"Open My route", drawer_title_aria:"My route — saved places",
    fav_add:"Add to favorites:", fav_remove:"Remove from favorites:",
    foot_privacy:"Privacy policy", foot_terms:"Terms of use",
    hl_eyebrow:"Your trip", hl_title:"How to get to Labateca",
    hl_sub:"Step by step from the three nearest cities. Bus schedules and fares are confirmed at each terminal.",
    hl_cucuta_t:"From Cúcuta",
    hl_cucuta_d:"Take a bus or minibus to Labateca at the Cúcuta Bus Terminal (route via Pamplona or Toledo, depending on the company). It is ~113 km, 3 to 4 hours on a mountain road. Ask at the ticket office about same-day return times.",
    hl_pamplona_t:"From Pamplona",
    hl_pamplona_d:"Pamplona is the midpoint of the route. Minibuses and pickups leave from its terminal to Labateca and Toledo. It is the shortest stretch, with the most beautiful páramo views of the trip.",
    hl_buca_t:"From Bucaramanga",
    hl_buca_d:"Take a Bucaramanga → Pamplona bus (~4 hours) and transfer there towards Labateca. Leave early: the last ride of the day to town usually departs in the afternoon.",
    hl_tip:"💡 Driving? The road is mostly paved; fill up in Pamplona or Cúcuta and download the offline map before leaving — some stretches have no signal.",
    ev_eyebrow:"Calendar", ev_title:"Festivals & events",
    ev_sub:"The dates when Labateca dresses up to celebrate. Plan your visit around them.",
    gu_eyebrow:"Local people", gu_title:"Guides & trail experts",
    gu_sub:"Community members who know every trail. Hire them directly via WhatsApp — your visit supports local income.",
    rv_open:"Visitor reviews",
    rv_loading:"Loading reviews…",
    rv_empty:"No reviews for this place yet. Be the first to share your experience!",
    rv_error:"We couldn't connect. Please try again in a moment.",
    rv_count:"reviews",
    rv_form_title:"Tell us about your experience",
    rv_name_ph:"Your name",
    rv_comment_ph:"How was your visit? What do you recommend?",
    rv_photo:"📷 Add a photo from your visit (optional)",
    rv_send:"Submit review",
    rv_moderation:"Your review is published after a quick check. Thanks for contributing!",
    rv_need_stars:"Pick a rating from 1 to 5 stars.",
    rv_sending:"Sending…",
    rv_thanks:"Thank you! Your review is pending approval and will be published soon.",
    rv_photo_big:"The photo is too large (8 MB max).",
    rv_rate:"Several reviews were sent from this connection in a row. Please wait a while and try again.",
    map_ilustrado_note:"Artistic reference map · tap a dot to see the place card · \"Directions\" opens Google Maps with the real location",
    map_fallback:"We couldn't load the interactive map. Check your connection and try again, or use each place's \"Directions\" button.",
    gal_eyebrow:"Postcards", gal_title:"Gallery", gal_sub:"Replace these slots with your own photos (better quality and no copyright issues).",
    contact_eyebrow:"Let's talk", contact_title:"Planning your visit?",
    contact_sub:"Write to us for recommendations, local guides or lodging info. We'll reply through whichever channel you prefer.",
    pdf_btn:"Download PDF guide", pdf_sub:"Full place guide · offline ready",
    pdf_generating:"Generating PDF…", pdf_done:"PDF ready! Check your downloads.",
    ch_wa:"Quick reply · tap to chat", ch_mail_t:"Email",
    ch_loc_t:"Directions", ch_loc_d:"Labateca Main Square",
    f_name:"Name", f_name_ph:"Your name", f_email:"Email", f_topic:"Topic",
    f_topic1:"Travel recommendations", f_topic2:"Lodging", f_topic3:"Local guide", f_topic4:"Other",
    f_msg:"Message", f_msg_ph:"Tell us what you'd like to discover…", f_send:"Send message",
    foot_about:"A community travel guide to Labateca, Norte de Santander. Made by and for those who love this mountain corner.",
    foot_explore:"Explore", foot_useful:"Useful", foot_directions:"Directions",
    foot_collaborate:"Have a business? Get listed",
    foot_qr:"QR Posters",
    foot_progress:"Project progress",
    foot_rights:"Labateca Tourism · Made with love in the mountains", foot_data:"Locally verified data · some still to confirm",
    route_title:"My route", route_open:"Open route in Google Maps", route_clear:"Clear route",
    cta_how:"Directions", cta_add:"Add", cta_added:"In route",
    cta_whatsapp:"WhatsApp", cta_whatsapp_t:"Contact on WhatsApp",
    cta_drive:"Drive to start", cta_trail:"View trail",
    cta_wikiloc:"Navigate (GPS)", cta_wikiloc_t:"Open the trail in Wikiloc: it guides you with your live location and works with no signal (download the route before you leave).",
    usar_eyebrow:"Quick guide", usar_title:"How to use the app", usar_sub:"Short videos to get the most out of it in seconds. Looking for places to visit? Tap the button and explore them all.",
    usar_video_soon:"Video coming soon", usar_v1:"Find places and build your route", usar_v2:"Navigate trails with GPS (Wikiloc)", usar_v3:"The map, weather and \"Directions\"", usar_cta:"See all places",
    back_home:"Back to home",
    visits_label:"visits", visits_aria:"People who have visited the site",
    fil_all:"All", fil_naturaleza:"Nature", fil_cultura:"Culture", fil_gastronomia:"Food", fil_hospedaje:"Lodging", fil_fav:"♥ Favorites",
    verify_badge:"To verify", approx_note:"Approximate location — confirm on site",
    route_empty:"Your route is empty. Tap “Add” on the places you'd like to visit.",
    fav_empty:"No favorites yet. Tap the ♥ on a place to save it.",
    msg_ok:"Thank you! Your message was sent. We'll get back to you soon.",
    msg_wa:"Taking you to WhatsApp to send your message…",
    msg_err:"Something went wrong. Reach us on WhatsApp and we'll gladly help.",
    ph_photo:"Your photo here",
    lb_close:"Close gallery", lb_prev:"Previous photo", lb_next:"Next photo",
    lb_of:"of", lb_no_photo:"Photo coming soon", lb_open:"View photos",
    gal_click_hint:"Tap to see the place card",
    chat_title:"Labateca AI Guide", chat_subtitle:"Ask me anything",
    chat_welcome:"Hi! I'm your Labateca virtual guide. I can help you with places to visit, how to get there, what to eat and much more. How can I help?",
    chat_placeholder:"Type your question…",
    chat_sug1:"What to do in Labateca?", chat_sug2:"How to get from Cúcuta?", chat_sug3:"What to eat?",
    chat_error:"Could not connect right now. <a href='{{wa}}' target='_blank' style='color:var(--clay);font-weight:700'>Write us on WhatsApp</a> and we'll help you."
  }
};

/* fotos sugeridas para la galería (subjects) */
const GALLERY = [
  {key:"big",  cls:"gal-ph",     cap:{es:"Cascada La Lirgua", en:"La Lirgua Waterfall"}},
  {key:"",     cls:"gal-ph alt", cap:{es:"Templo colonial", en:"Colonial church"}},
  {key:"",     cls:"gal-ph gold",cap:{es:"Café de Labateca", en:"Labateca coffee"}},
  {key:"tall", cls:"gal-ph",     cap:{es:"Páramo de Santurbán", en:"Santurbán Páramo"}},
  {key:"",     cls:"gal-ph alt", cap:{es:"Parque principal", en:"Main square"}},
  {key:"wide", cls:"gal-ph gold",cap:{es:"Paisaje de montaña", en:"Mountain landscape"}},
  {key:"",     cls:"gal-ph",     cap:{es:"Ríos y quebradas", en:"Rivers & streams"}}
];

/* ============================================================
   ESTADO + ALMACENAMIENTO (con respaldo en memoria)
   ============================================================ */
let lang = "es";
let activeFilter = "all";
const memStore = {};
const store = {
  get(k){ try{ const v=localStorage.getItem(k); return v?JSON.parse(v):memStore[k]??null; }catch(e){ return memStore[k]??null; } },
  set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){ memStore[k]=v; } }
};
let favorites = store.get("lab_favs") || [];
let route = store.get("lab_route") || [];

const t = (k)=> (I18N[lang][k] ?? k);
const placeName = (p)=> (p.nombre || p.name || {})[lang] || '';

/* ============================================================
   ÍCONOS SVG reutilizables
   ============================================================ */
const IC = {
  pin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a8 8 0 0 0-8 8c0 5.4 8 12 8 12s8-6.6 8-12a8 8 0 0 0-8-8z"/><circle cx="12" cy="10" r="3"/></svg>',
  clock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  hill:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M3 20l6-9 4 5 3-4 5 8"/></svg>',
  cam:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  heart:'<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
  navi:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  warn:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.1-1.3A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.1 14.9l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 0 1 12 4zm-2.7 4c-.2 0-.5 0-.7.4-.2.4-.9.9-.9 2.1s.9 2.5 1 2.6c.1.2 1.7 2.7 4.3 3.7 2.1.8 2.5.7 3 .6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0-.1-.2-.2-.5-.3l-1.6-.8c-.2-.1-.4-.1-.6.1l-.6.8c-.1.2-.3.2-.5.1-.7-.3-1.4-.6-2.1-1.5-.5-.6-.8-1.2-.9-1.4-.1-.2 0-.4.1-.5l.4-.5c.1-.1.1-.3.2-.4 0-.1 0-.3 0-.4l-.7-1.7c-.2-.5-.4-.4-.6-.4z"/></svg>'
};
const CATS = ["all","naturaleza","cultura","gastronomia","hospedaje","fav"];

/* ============================================================
   RENDER FILTROS
   ============================================================ */
function renderFilters(){
  const wrap = document.getElementById("filters");
  if (!wrap) return;   // esta página no tiene la sección de lugares
  wrap.innerHTML = CATS.map(c=>{
    let count;
    if(c==="all") count = PLACES.length;
    else if(c==="fav") count = favorites.length;
    else count = PLACES.filter(p=>(p.categoria||p.cat)===c).length;
    return `<button class="chip ${activeFilter===c?'active':''}" onclick="setFilter('${c}')">
      ${t('fil_'+c)} <span class="ct">${count}</span></button>`;
  }).join("");
}
function setFilter(c){ activeFilter=c; renderFilters(); renderPlaces(); }

/* ============================================================
   RENDER LUGARES
   ============================================================ */
function renderPlaces(){
  const grid = document.getElementById("placesGrid");
  if (!grid) return;   // esta página no tiene la sección de lugares
  let list = PLACES.slice();
  if(activeFilter==="fav") list = list.filter(p=>favorites.includes(p.id));
  else if(activeFilter!=="all") list = list.filter(p=>(p.categoria||p.cat)===activeFilter);

  if(!list.length){
    grid.innerHTML = `<div class="empty-state">${activeFilter==='fav'?t('fav_empty'):'—'}</div>`;
    return;
  }

  grid.innerHTML = list.map(p=>{
    const isFav   = favorites.includes(p.id);
    const inRoute = route.includes(p.id);
    const cat     = p.categoria || p.cat;
    // Si el lugar tiene sendero a pie, "Cómo llegar" apunta al INICIO (donde se deja
    // el carro) en vez de al destino inalcanzable por carretera.
    const navDest = p.trailhead ? `${p.trailhead.lat},${p.trailhead.lng}` : `${p.lat},${p.lng}`;
    const gmaps   = `https://www.google.com/maps/search/?api=1&query=${navDest}`;

    // Foto: schema nuevo usa fotos[] (IDs Cloudinary), schema legacy usa img
    const firstPhoto = (p.fotos && p.fotos.length) ? p.fotos[0] : (p.img || '');
    const photoUrl   = firstPhoto
      ? (firstPhoto.startsWith('http') ? firstPhoto : cldUrl(firstPhoto))
      : '';
    // Imagen responsive: si es Cloudinary, srcset en 3 anchos (WebP via f_auto);
    // width/height fijan la relación (evita CLS); lazy + async no bloquean.
    const isCld = firstPhoto && !firstPhoto.startsWith('http');
    const srcset = isCld
      ? `srcset="${cldUrl(firstPhoto,'w_400,h_250,c_fill,f_auto,q_auto')} 400w, ${cldUrl(firstPhoto,'w_640,h_400,c_fill,f_auto,q_auto')} 640w, ${cldUrl(firstPhoto,'w_900,h_563,c_fill,f_auto,q_auto')} 900w" sizes="(max-width:600px) 92vw, (max-width:1000px) 46vw, 380px"`
      : '';
    const media = photoUrl
      ? `<img src="${photoUrl}" ${srcset} alt="${escHtml(placeName(p))}" loading="lazy" decoding="async" width="640" height="400">`
      : `<div class="pc-ph">${IC.cam}<small>${escHtml(placeName(p))}</small></div>`;

    const badge = p.verified
      ? `<span class="pc-badge">${t('fil_'+cat)}</span>`
      : `<span class="pc-badge pc-verify">${IC.warn} ${t('verify_badge')}</span>`;
    const note = p.coordsApprox
      ? `<div class="pc-note">${IC.warn}<span>${t('approx_note')}</span></div>` : "";

    // Campos: soporte schema nuevo (nombre/tiempo/dificultad) y legacy (name/time/diff)
    const desc     = (p.desc||{})[lang] || '';
    const dist     = (p.dist||{})[lang] || '';
    const tiempo   = (p.tiempo||p.time||{})[lang] || '';
    const dific    = (p.dificultad||p.diff||{})[lang] || '';

    return `
    <article class="place-card">
      <div class="pc-media" role="button" tabindex="0"
           onclick="if(!event.target.closest('.pc-fav'))openLightbox('${p.id}')"
           onkeydown="if((event.key==='Enter'||event.key===' ')&&!event.target.closest('.pc-fav')){event.preventDefault();openLightbox('${p.id}')}"
           aria-label="${t('lb_open')}: ${placeName(p)}">
        ${media}
        ${badge}
        <button class="pc-fav ${isFav?'on':''}" onclick="toggleFav('${p.id}')" aria-pressed="${isFav?'true':'false'}" aria-label="${(isFav?t('fav_remove'):t('fav_add'))} ${placeName(p)}" title="${t('fav_add')}">${IC.heart}</button>
      </div>
      <div class="pc-body">
        <div class="pc-cat">${t('fil_'+cat)}</div>
        <h3 class="pc-title">${placeName(p)}</h3>
        <p class="pc-desc">${desc}</p>
        <div class="pc-stats">
          <span class="pc-stat">${IC.pin}${dist}</span>
          <span class="pc-stat">${IC.clock}${tiempo}</span>
          <span class="pc-stat">${IC.hill}${dific}</span>
        </div>
        <div class="pc-actions">
          <a class="pc-btn map" href="${gmaps}" target="_blank" rel="noopener noreferrer">${IC.navi}${p.track?t('cta_drive'):t('cta_how')}</a>
          ${p.telefono?`<a class="pc-btn wa" href="https://wa.me/${p.telefono}?text=${encodeURIComponent((lang==='es'?'Hola, te contacto desde la guía turística de Labateca sobre ':'Hi! I found you on the Labateca tourism guide — about ')+placeName(p)+'.')}" target="_blank" rel="noopener noreferrer" title="${t('cta_whatsapp_t')}">${IC.wa}${t('cta_whatsapp')}</a>`:''}
          ${p.wikiloc
            ? `<a class="pc-btn trail" href="${escHtml(p.wikiloc)}" target="_blank" rel="noopener noreferrer" title="${t('cta_wikiloc_t')}">${IC.hill}${t('cta_wikiloc')}</a>`
            : (p.track?`<button class="pc-btn trail" onclick="showTrail('${p.id}')">${IC.hill}${t('cta_trail')}</button>`:'')}
          <button class="pc-btn route ${inRoute?'added':''}" onclick="toggleRoute('${p.id}')">
            ${inRoute?IC.check:IC.plus}${inRoute?t('cta_added'):t('cta_add')}
          </button>
          <button class="pc-share" onclick="sharePlace('${p.id}')" aria-label="${t('cta_share')}" title="${t('cta_share')}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>
          </button>
        </div>
        ${CONFIG.reviewsWorkerUrl?`<button class="pc-reviews" onclick="openReviews('${p.id}')">★ ${t('rv_open')}</button>`:''}
        ${note}
      </div>
    </article>`;
  }).join("");
}

/* ============================================================
   FAVORITOS + RUTA
   ============================================================ */
function toggleFav(id){
  const i = favorites.indexOf(id);
  if(i>-1) favorites.splice(i,1); else favorites.push(id);
  store.set("lab_favs",favorites);
  renderFilters(); renderPlaces();
}
function toggleRoute(id){
  const i = route.indexOf(id);
  if(i>-1) route.splice(i,1); else route.push(id);
  store.set("lab_route",route);
  renderPlaces(); renderDrawer(); updateBadges();
}
function clearRoute(){ route=[]; store.set("lab_route",route); renderPlaces(); renderDrawer(); updateBadges(); }

function updateBadges(){
  const b=document.getElementById("routeBadge");
  b.textContent=route.length; b.classList.toggle("show",route.length>0);
  document.getElementById("drawerCount").textContent=route.length;
}

function renderDrawer(){
  const body=document.getElementById("drawerBody");
  const btn=document.getElementById("routeMapsBtn");
  if(!route.length){
    body.innerHTML=`<div class="drawer-empty">${IC.navi}<p>${t('route_empty')}</p></div>`;
    btn.style.opacity=".5"; btn.style.pointerEvents="none"; btn.removeAttribute("href");
    return;
  }
  body.innerHTML=route.map((id,idx)=>{
    const p=PLACES.find(x=>x.id===id); if(!p) return "";
    const firstPhoto=(p.fotos&&p.fotos.length)?p.fotos[0]:(p.img||'');
    const photoUrl=firstPhoto?(firstPhoto.startsWith('http')?firstPhoto:cldUrl(firstPhoto)):'';
    const thumb=photoUrl
      ?`<img class="route-thumb" src="${photoUrl}" alt="${placeName(p)}" loading="lazy">`
      :`<div class="route-ph">${IC.cam}</div>`;
    const dist=(p.dist||{})[lang]||'';
    const dific=(p.dificultad||p.diff||{})[lang]||'';
    const meta=[dist,dific].filter(Boolean).join(' · ');
    return `<div class="route-item">
      <span class="route-num">${idx+1}</span>
      ${thumb}
      <span style="flex:1;min-width:0"><b>${placeName(p)}</b><span>${meta}</span></span>
      <button class="rm" onclick="toggleRoute('${p.id}')" aria-label="Quitar">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>`;
  }).join("");
  // ruta de Google Maps: del pueblo a través de cada parada (ignora ids huérfanos)
  const stops=route.map(id=>PLACES.find(x=>x.id===id)).filter(Boolean).map(p=>`${p.lat},${p.lng}`);
  const dir=`https://www.google.com/maps/dir/${CONFIG.townCoords.lat},${CONFIG.townCoords.lng}/${stops.join("/")}`;
  btn.style.opacity="1"; btn.style.pointerEvents="auto"; btn.setAttribute("href",dir);
}

let _drawerFocusPrev=null;
function _drawerKeydown(e){
  if(e.key==="Escape"){ closeDrawer(); return; }
  if(e.key!=="Tab") return;
  const d=document.getElementById("drawer");
  const f=d.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])');
  if(!f.length) return;
  const first=f[0], last=f[f.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
}
function openDrawer(){
  _drawerFocusPrev=document.activeElement;
  document.getElementById("drawer").classList.add("open");
  document.getElementById("drawerOverlay").classList.add("open");
  document.addEventListener("keydown",_drawerKeydown);
  const close=document.querySelector("#drawer .drawer-close");
  if(close) setTimeout(()=>close.focus(),60);
}
function closeDrawer(){
  document.getElementById("drawer").classList.remove("open");
  document.getElementById("drawerOverlay").classList.remove("open");
  document.removeEventListener("keydown",_drawerKeydown);
  if(_drawerFocusPrev && _drawerFocusPrev.focus){ _drawerFocusPrev.focus(); _drawerFocusPrev=null; }
}

/* ============================================================
   COMPARTIR LUGAR (Web Share API, respaldo WhatsApp)
   ============================================================ */
function sharePlace(id){
  const p=PLACES.find(x=>x.id===id); if(!p) return;
  const url=`${location.origin}/?lugar=${encodeURIComponent(id)}`;
  const text=`${placeName(p)} — Labateca · Volcanes de Dios`;
  if(navigator.share){
    navigator.share({title:text,text,url}).catch(()=>{});
  }else{
    window.open(`https://wa.me/?text=${encodeURIComponent(text+' '+url)}`,'_blank','noopener');
  }
}

/* Escapa HTML para insertar texto de datos (CMS/comunidad) sin riesgo de XSS */
function escHtml(s){
  return String(s==null?'':s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ============================================================
   FIESTAS Y EVENTOS (data/eventos.json — sección oculta si vacío)
   ============================================================ */
async function loadEventos(){
  try{
    const r=await fetch('/data/eventos.json');
    const j=await r.json();
    const evs=Array.isArray(j.eventos)?j.eventos:[];
    if(!evs.length) return;
    const grid=document.getElementById('eventosGrid');
    grid.innerHTML=evs.map(ev=>`
      <div class="evento-card reveal in">
        <div class="evento-mes">${escHtml((ev.fecha||{})[lang])}</div>
        <h3>${escHtml((ev.nombre||{})[lang])}</h3>
        <p>${escHtml((ev.desc||{})[lang])}</p>
      </div>`).join('');
    document.getElementById('eventos').style.display='';
  }catch(e){ console.warn('[Labateca] eventos.json:',e.message); }
}

/* ============================================================
   GUÍAS LOCALES (data/guias.json — sección oculta si vacío)
   ============================================================ */
async function loadGuias(){
  try{
    const r=await fetch('/data/guias.json');
    const j=await r.json();
    const gs=Array.isArray(j.guias)?j.guias:[];
    if(!gs.length) return;
    const grid=document.getElementById('guiasGrid');
    grid.innerHTML=gs.map(g=>{
      const foto=g.foto?`<img class="guia-foto" src="${escHtml(cldUrl(g.foto,'w_200,h_200,c_fill,g_face,f_auto,q_auto'))}" alt="${escHtml(g.nombre)}" loading="lazy">`:`<div class="guia-foto-ph">🧭</div>`;
      const tel=String(g.whatsapp||'').replace(/[^0-9]/g,'');
      const wa=tel?`<a class="guia-wa" href="https://wa.me/${tel}?text=${encodeURIComponent(lang==='es'?'Hola, te contacto desde la guía de Labateca. Quisiera información sobre un recorrido.':'Hi! I found you on the Labateca guide. I would like info about a tour.')}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`:'';
      return `<div class="guia-card reveal in">${foto}<h3>${escHtml(g.nombre)}</h3><div class="esp">${escHtml((g.especialidad||{})[lang])}</div>${wa}</div>`;
    }).join('');
    document.getElementById('guias').style.display='';
  }catch(e){ console.warn('[Labateca] guias.json:',e.message); }
}

/* ============================================================
   RESEÑAS DE VISITANTES (worker + D1, moderadas)
   ============================================================ */
let _rvPlaceId=null, _rvRating=0;

function openReviews(id){
  const p=PLACES.find(x=>x.id===id); if(!p||!CONFIG.reviewsWorkerUrl) return;
  _rvPlaceId=id; _rvRating=0;
  document.getElementById('rvTitle').textContent=placeName(p);
  document.getElementById('rvAvg').textContent='';
  document.getElementById('rvMsg').textContent='';
  document.getElementById('rvForm').reset();
  document.getElementById('rvPhotoName').textContent='';
  _paintStars();
  document.getElementById('rvOverlay').hidden=false;
  document.body.style.overflow='hidden';
  loadReviews(id);
}
function closeReviews(){
  document.getElementById('rvOverlay').hidden=true;
  document.body.style.overflow='';
}
document.getElementById('rvOverlay').addEventListener('click',e=>{ if(e.target===e.currentTarget) closeReviews(); });

function _paintStars(){
  document.querySelectorAll('#rvStars button').forEach(b=>{
    b.classList.toggle('on',+b.dataset.v<=_rvRating);
  });
}
document.querySelectorAll('#rvStars button').forEach(b=>{
  b.addEventListener('click',()=>{ _rvRating=+b.dataset.v; _paintStars(); });
});
document.getElementById('rvPhoto').addEventListener('change',e=>{
  const f=e.target.files[0];
  document.getElementById('rvPhotoName').textContent=f?f.name:'';
});

async function loadReviews(id){
  const list=document.getElementById('rvList');
  list.innerHTML=`<p class="rv-loading">${t('rv_loading')}</p>`;
  try{
    const r=await fetch(`${CONFIG.reviewsWorkerUrl}/api/reviews?place=${encodeURIComponent(id)}`);
    const j=await r.json();
    if(!j.ok) throw new Error(j.error||'error');
    const revs=j.reviews||[];
    if(j.avg) document.getElementById('rvAvg').textContent=`★ ${j.avg} · ${revs.length} ${t('rv_count')}`;
    if(!revs.length){ list.innerHTML=`<p class="rv-empty">${t('rv_empty')}</p>`; return; }
    list.innerHTML=revs.map(rv=>{
      const stars='★'.repeat(rv.rating)+'☆'.repeat(5-rv.rating);
      const img=rv.photo?`<a href="${rv.photo}" target="_blank" rel="noopener noreferrer" aria-label="${lang==='es'?'Ver foto de '+safeName+' en grande':'View photo by '+safeName+' full size'}"><img src="${rv.photo}" alt="${lang==='es'?'Foto de la visita de '+safeName:'Visit photo by '+safeName}" loading="lazy"></a>`:'';
      const d=new Date(rv.created_at).toLocaleDateString(lang==='es'?'es-CO':'en-US',{year:'numeric',month:'short'});
      const safeName=rv.name.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
      const safeComment=rv.comment.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
      return `<div class="rv-item">
        <div class="rv-item-head"><b>${safeName}</b><span class="rv-item-stars">${stars}</span></div>
        <p>${safeComment}</p>${img}
        <div class="rv-date">${d}</div>
      </div>`;
    }).join('');
  }catch(e){
    list.innerHTML=`<p class="rv-empty">${t('rv_error')}</p>`;
  }
}

async function _uploadReviewPhoto(file){
  if(!CONFIG.cloudName||!CONFIG.uploadPreset) return '';
  const fd=new FormData();
  fd.append('file',file);
  fd.append('upload_preset',CONFIG.uploadPreset);
  fd.append('folder','visitantes');
  const r=await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.cloudName}/image/upload`,{method:'POST',body:fd});
  const j=await r.json();
  if(!j.secure_url) throw new Error(j.error&&j.error.message||'upload');
  return j.secure_url;
}

async function submitReview(e){
  e.preventDefault();
  const msg=document.getElementById('rvMsg');
  const btn=document.getElementById('rvSubmit');
  if(!_rvRating){ msg.style.color='var(--clay)'; msg.textContent=t('rv_need_stars'); return false; }
  btn.disabled=true; msg.style.color='var(--ink-mut)'; msg.textContent=t('rv_sending');
  try{
    let photo='';
    const file=document.getElementById('rvPhoto').files[0];
    if(file){
      if(file.size>8*1024*1024) throw new Error(t('rv_photo_big'));
      photo=await _uploadReviewPhoto(file);
    }
    const r=await fetch(`${CONFIG.reviewsWorkerUrl}/api/reviews`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        place:_rvPlaceId,
        name:document.getElementById('rvName').value.trim(),
        rating:_rvRating,
        comment:document.getElementById('rvComment').value.trim(),
        photo, lang
      })
    });
    if(r.status===429){ throw new Error('RATE'); }
    const j=await r.json();
    if(!j.ok) throw new Error(j.error||'error');
    msg.style.color='var(--forest)'; msg.textContent=t('rv_thanks');
    document.getElementById('rvForm').reset();
    document.getElementById('rvPhotoName').textContent='';
    _rvRating=0; _paintStars();
  }catch(err){
    msg.style.color='var(--clay)';
    if(err.message==='RATE') msg.textContent=t('rv_rate');
    else msg.textContent=err.message===t('rv_photo_big')?err.message:t('rv_error');
  }
  btn.disabled=false;
  return false;
}

/* ============================================================
   GALERÍA
   Alimentada de PLACES (fotos reales si existen, placeholder si no).
   Cada item es clicable y abre el lightbox del lugar.
   ============================================================ */
function renderGallery(){
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;   // esta página no tiene galería

  // Si PLACES no cargó aún, mostrar skeleton de la galería estática
  if (!PLACES.length) {
    grid.innerHTML = GALLERY.map(g =>
      `<div class="gal ${g.key}"><div class="${g.cls}">${IC.cam}<small>${t('ph_photo')}</small></div>
       <div class="gal-cap">${g.cap[lang]}</div></div>`
    ).join(""); return;
  }

  // Layout de 7 celdas (igual que el grid original)
  const LAYOUT = ['big','','','tall','','wide',''];
  const PH_CLS  = ['gal-ph','gal-ph alt','gal-ph gold','gal-ph','gal-ph alt','gal-ph gold','gal-ph'];

  // Tomar los primeros 7 lugares
  const items = PLACES.slice(0, 7);

  grid.innerHTML = items.map((p, i) => {
    const firstPhoto = p.fotos && p.fotos.length ? p.fotos[0] : '';
    const url        = firstPhoto ? cldUrl(firstPhoto, 'w_800,h_500,c_fill,f_auto,q_auto') : '';
    const caption    = placeName(p);

    const inner = url
      ? `<img src="${url}" alt="${caption}" loading="lazy">`
      : `<div class="${PH_CLS[i]}">${IC.cam}<small>${caption}</small></div>`;

    return `<div class="gal ${LAYOUT[i]||''}"
      role="button" tabindex="0"
      onclick="openLightbox('${p.id}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openLightbox('${p.id}')}"
      aria-label="${t('lb_open')}: ${caption}">
      ${inner}
      <div class="gal-cap">${caption}</div>
    </div>`;
  }).join("");
}

/* ============================================================
   RUTAS TEMÁTICAS
   ============================================================ */
let RUTAS = [];

async function loadRutas() {
  try {
    const res  = await fetch('/data/rutas.json');
    const json = await res.json();
    RUTAS = Array.isArray(json.rutas) ? json.rutas : [];
    renderRutas();
  } catch(e) {
    console.warn('[Labateca] No se pudo cargar rutas.json:', e.message);
  }
}

function renderRutas() {
  const grid = document.getElementById('rutasGrid');
  if (!grid || !RUTAS.length) return;

  grid.innerHTML = RUTAS.map((r, i) => {
    const nombre   = r.nombre[lang]      || r.nombre.es;
    const desc     = r.desc[lang]        || r.desc.es;
    const duracion = r.duracion[lang]    || r.duracion.es;
    const dific    = r.dificultad[lang]  || r.dificultad.es;
    const rec      = r.recomendacion[lang] || r.recomendacion.es || '';
    const nLugares = r.lugares.length;

    // Cuántos de los lugares de esta ruta ya están en "Mi ruta"
    const yaEnRuta = r.lugares.every(id => route.includes(id));

    return `
    <div class="ruta-card" style="--ruta-color:${r.color};--ruta-color-soft:${r.colorSoft};animation:cardIn .4s var(--ease) both;animation-delay:${i * 0.08}s">
      <div class="ruta-accent"></div>
      <div class="ruta-body">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
          <div class="ruta-icon">${r.icono}</div>
          <div class="ruta-lugares-count">${nLugares} ${t('rutas_lugares')}</div>
        </div>
        <div class="ruta-name">${nombre}</div>
        <div class="ruta-desc">${desc}</div>
        <div class="ruta-meta">
          <span class="ruta-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
            ${duracion}
          </span>
          <span class="ruta-chip dif">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M3 20l6-9 4 5 3-4 5 8"/></svg>
            ${dific}
          </span>
        </div>
        ${rec ? `<div class="ruta-rec">${rec}</div>` : ''}
        <button class="ruta-btn" onclick="applyRoute('${r.id}')" aria-label="${t('rutas_btn')}: ${nombre}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M6 16V8a4 4 0 0 1 4-4h4"/><path d="M18 8v8a4 4 0 0 1-4 4h-1"/></svg>
          <span id="rutaBtn_${r.id}">${yaEnRuta ? t('rutas_btn_active') : t('rutas_btn')}</span>
        </button>
      </div>
    </div>`;
  }).join('');

  // Las cards usan animación CSS propia (cardIn) — no necesitan IntersectionObserver
}

function applyRoute(rutaId) {
  const ruta = RUTAS.find(r => r.id === rutaId);
  if (!ruta) return;

  // Reemplazar la ruta actual con los lugares de esta ruta
  route = [...ruta.lugares];
  store.set('lab_route', route);

  // Actualizar UI
  renderPlaces();
  renderDrawer();
  updateBadges();
  renderRutas(); // refrescar estado del botón

  // Abrir el drawer para que el usuario lo vea
  openDrawer();
}

/* ============================================================
   i18n: aplicar idioma
   ============================================================ */
function applyI18n(){
  document.documentElement.lang=lang;
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const k=el.getAttribute("data-i18n");
    if(I18N[lang][k]!==undefined) el.innerHTML=I18N[lang][k];
  });
  document.querySelectorAll("[data-i18n-ph]").forEach(el=>{
    const k=el.getAttribute("data-i18n-ph");
    if(I18N[lang][k]!==undefined) el.setAttribute("placeholder",I18N[lang][k]);
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el=>{
    const k=el.getAttribute("data-i18n-aria");
    if(I18N[lang][k]!==undefined) el.setAttribute("aria-label",I18N[lang][k]);
  });
}
function setLang(l){
  lang=l; store.set("lab_lang",l);
  const es=document.getElementById("langEs"), en=document.getElementById("langEn");
  es.classList.toggle("active",l==="es"); en.classList.toggle("active",l==="en");
  es.setAttribute("aria-pressed",l==="es"?"true":"false");
  en.setAttribute("aria-pressed",l==="en"?"true":"false");
  applyI18n(); renderFilters(); renderPlaces(); renderGallery(); renderDrawer(); renderRutas();
}

/* ============================================================
   CLIMA EN VIVO (Open-Meteo, sin API key)
   ============================================================ */
const WCODE={
  0:{e:"☀️",es:"Despejado",en:"Clear"},1:{e:"🌤️",es:"Mayormente despejado",en:"Mostly clear"},
  2:{e:"⛅",es:"Parcialmente nublado",en:"Partly cloudy"},3:{e:"☁️",es:"Nublado",en:"Cloudy"},
  45:{e:"🌫️",es:"Neblina",en:"Fog"},48:{e:"🌫️",es:"Neblina",en:"Fog"},
  51:{e:"🌦️",es:"Llovizna",en:"Drizzle"},53:{e:"🌦️",es:"Llovizna",en:"Drizzle"},55:{e:"🌦️",es:"Llovizna",en:"Drizzle"},
  61:{e:"🌧️",es:"Lluvia ligera",en:"Light rain"},63:{e:"🌧️",es:"Lluvia",en:"Rain"},65:{e:"🌧️",es:"Lluvia fuerte",en:"Heavy rain"},
  80:{e:"🌧️",es:"Chubascos",en:"Showers"},81:{e:"🌧️",es:"Chubascos",en:"Showers"},82:{e:"⛈️",es:"Chubascos fuertes",en:"Heavy showers"},
  95:{e:"⛈️",es:"Tormenta",en:"Thunderstorm"},96:{e:"⛈️",es:"Tormenta",en:"Thunderstorm"}
};
let lastWeather=null;
/* Clima con doble proveedor: Open-Meteo (principal) y MET Norway (respaldo).
   Algunos ISP no alcanzan el servidor de Open-Meteo; met.no es gratis y sin clave. */
async function loadWeather(){
  try{ await _weatherOpenMeteo(); }
  catch(e1){
    console.warn('[Labateca] Open-Meteo falló, probando met.no:', e1.message);
    try{ await _weatherMetNo(); }
    catch(e2){
      console.warn('[Labateca] met.no también falló:', e2.message);
      document.getElementById("wTemp").textContent="20";
      document.getElementById("wIcon").textContent="⛅";
      document.getElementById("wCondition").innerHTML=
        `${lang==="es"?"Clima templado":"Mild climate"} &nbsp;<button onclick="loadWeather()" style="font:inherit;font-size:.75rem;background:var(--forest);color:#fff;border:none;border-radius:99px;padding:2px 10px;cursor:pointer">${lang==="es"?"Reintentar":"Retry"}</button>`;
    }
  }
}

function _fetchTimeout(url,ms){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),ms);
  return fetch(url,{signal:ctrl.signal}).finally(()=>clearTimeout(tid));
}

async function _weatherOpenMeteo(){
  const {lat,lng}=CONFIG.townCoords;
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,precipitation,uv_index,cloud_cover&timezone=America/Bogota`;
  const r=await _fetchTimeout(url,6000);
  if(!r.ok) throw new Error('http '+r.status);
  const d=await r.json();
  const c=d.current;
  if(!c||c.temperature_2m==null) throw new Error('bad data');
  lastWeather={
    temp:Math.round(c.temperature_2m),
    feels:Math.round(c.apparent_temperature??c.temperature_2m),
    code:c.weather_code??2,
    hum:c.relative_humidity_2m??0,
    wind:Math.round(c.wind_speed_10m??0),
    rain:+(c.precipitation??0).toFixed(1),
    uv:Math.round(c.uv_index??0),
    cloud:c.cloud_cover??0
  };
  paintWeather();
}

/* Mapa de símbolos de met.no → códigos WMO que ya usa WCODE */
const METNO_WMO={clearsky:0,fair:1,partlycloudy:2,cloudy:3,fog:45,
  lightrain:61,lightrainshowers:61,rain:63,rainshowers:80,heavyrain:65,heavyrainshowers:65,
  lightsleet:66,sleet:66,heavysleet:66,lightsnow:71,snow:73,heavysnow:75,
  lightrainandthunder:95,rainandthunder:95,heavyrainandthunder:95,thunderstorm:95};

async function _weatherMetNo(){
  const {lat,lng}=CONFIG.townCoords;
  const url=`https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lng}`;
  const r=await _fetchTimeout(url,6000);
  if(!r.ok) throw new Error('http '+r.status);
  const d=await r.json();
  const now=d.properties&&d.properties.timeseries&&d.properties.timeseries[0];
  if(!now) throw new Error('bad data');
  const det=now.data.instant.details;
  const next=(now.data.next_1_hours||now.data.next_6_hours||{});
  const sym=((next.summary||{}).symbol_code||'partlycloudy').split('_')[0];
  lastWeather={
    temp:Math.round(det.air_temperature),
    feels:Math.round(det.air_temperature),
    code:METNO_WMO[sym]??2,
    hum:Math.round(det.relative_humidity??0),
    wind:Math.round((det.wind_speed??0)*3.6),
    rain:+(((next.details||{}).precipitation_amount)??0).toFixed(1),
    uv:Math.round(det.ultraviolet_index_clear_sky??0),
    cloud:Math.round(det.cloud_area_fraction??0)
  };
  paintWeather();
}
function paintWeather(){
  if(!lastWeather) return;
  if(!document.getElementById("wIcon")) return;   // esta página no tiene widget de clima
  const w=WCODE[lastWeather.code]||WCODE[2];
  const lw=lastWeather;
  document.getElementById("wIcon").textContent=w.e;
  document.getElementById("wTemp").textContent=lw.temp;
  document.getElementById("wFeels").textContent=`${t('w_feels')}: ${lw.feels}°C`;
  document.getElementById("wCondition").textContent=w[lang];
  document.getElementById("wHumidity").textContent=`💧 ${lw.hum}%`;
  document.getElementById("wRain").textContent=`🌧 ${lw.rain} mm`;
  document.getElementById("wWind").textContent=`💨 ${lw.wind} km/h`;
  document.getElementById("wUV").textContent=`☀️ UV ${lw.uv}`;
  const now=new Date();
  const timeStr=now.toLocaleTimeString(lang==="es"?'es-CO':'en-US',{hour:'2-digit',minute:'2-digit'});
  document.getElementById("wUpdated").textContent=lang==="es"?`Act. ${timeStr}`:`Upd. ${timeStr}`;
}

/* ============================================================
   DISTANCIA EN TIEMPO REAL desde la ubicación del visitante
   (Geolocation API + fórmula de Haversine, sin API key)
   ============================================================ */
function haversineKm(lat1,lng1,lat2,lng2){
  const R=6371, toRad=d=>d*Math.PI/180;
  const dLat=toRad(lat2-lat1), dLng=toRad(lng2-lng1);
  const a=Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function showDistError(msg){
  const res=document.getElementById("distResult");
  const btn=document.getElementById("distBtn");
  btn.disabled=false;
  btn.querySelector("span").textContent=t('dist_btn');
  res.hidden=false;
  res.innerHTML=`<span class="dist-err">${msg}</span><button class="dist-retry" onclick="calcDistance()">${t('dist_retry')}</button>`;
}
function calcDistance(){
  const btn=document.getElementById("distBtn");
  const res=document.getElementById("distResult");
  if(!("geolocation" in navigator)){ showDistError(t('dist_unsupported')); return; }
  btn.disabled=true;
  btn.querySelector("span") && (btn.querySelector("span").textContent=t('dist_locating'));
  navigator.geolocation.getCurrentPosition(
    pos=>{
      const {latitude,longitude}=pos.coords;
      const km=Math.round(haversineKm(latitude,longitude,CONFIG.townCoords.lat,CONFIG.townCoords.lng));
      const dir=`https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${CONFIG.townCoords.lat},${CONFIG.townCoords.lng}&travelmode=driving`;
      // reconstruimos el resultado (por si venía de un error previo)
      res.innerHTML=`
        <div class="dist-line"><span data-i18n="dist_pre">${t('dist_pre')}</span> <b id="distKm">${km}</b> km <span data-i18n="dist_post">${t('dist_post')}</span></div>
        <a id="distRoute" class="dist-route" href="${dir}" target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          <span data-i18n="dist_route">${t('dist_route')}</span>
        </a>`;
      res.hidden=false;
      btn.style.display="none";
    },
    err=>{ showDistError(t('dist_denied')); },
    {enableHighAccuracy:false, timeout:10000, maximumAge:60000}
  );
}

/* ============================================================
   FORMULARIO (Web3Forms + respaldo WhatsApp)
   ============================================================ */
function buildWaLink(text){ return `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(text).replace(/'/g,'%27')}`; }

const _contactForm = document.getElementById("contactForm");
if (_contactForm) _contactForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const msgBox=document.getElementById("formMsg");

  // Honeypot: si el campo trampa viene lleno, es un bot → abortar en silencio
  const hp=document.getElementById("hpWebsite");
  if(hp && hp.value.trim()!==""){ return; }

  const data={
    name:document.getElementById("name").value.trim().slice(0,100),
    email:document.getElementById("email").value.trim().slice(0,120),
    topic:document.getElementById("topic").value,
    message:document.getElementById("message").value.trim().slice(0,2000)
  };

  // Validación básica de entradas
  const emailOk=/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email);
  if(!data.name || !emailOk || data.message.length<5){
    msgBox.className="form-msg err"; msgBox.textContent=t('msg_err');
    return;
  }

  const waText=`Hola Labateca Turismo 👋\n\nNombre: ${data.name}\nCorreo: ${data.email}\nTema: ${data.topic}\nMensaje: ${data.message}`;

  // Si no hay clave Web3Forms, enviamos por WhatsApp directamente
  if(!CONFIG.web3formsKey || CONFIG.web3formsKey==="TU_ACCESS_KEY"){
    msgBox.className="form-msg ok"; msgBox.textContent=t('msg_wa');
    setTimeout(()=>window.open(buildWaLink(waText),"_blank"),700);
    return;
  }
  try{
    const r=await fetch("https://api.web3forms.com/submit",{
      method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify({access_key:CONFIG.web3formsKey,subject:`Labateca Turismo · ${data.topic}`,...data})
    });
    const out=await r.json();
    if(out.success){ msgBox.className="form-msg ok"; msgBox.textContent=t('msg_ok'); e.target.reset(); }
    else throw 0;
  }catch(err){
    msgBox.className="form-msg err"; msgBox.textContent=t('msg_err');
    setTimeout(()=>window.open(buildWaLink(waText),"_blank"),1200);
  }
});

/* ============================================================
   MAPA (Leaflet) con respaldo
   ============================================================ */
/* Carga diferida de Leaflet AUTO-ALOJADO en el propio dominio (/vendor/leaflet/).
   Se sirve desde el mismo Cloudflare que el sitio: fiable en conexiones rurales/
   lentas, sin depender de un CDN externo (cdnjs). Mismo origen → sin SRI/CORS. */
let _leafletPromise=null;
function ensureLeaflet(){
  if(window.L) return Promise.resolve();
  if(_leafletPromise) return _leafletPromise;
  const css=document.createElement('link');
  css.rel='stylesheet'; css.href='/vendor/leaflet/leaflet.min.css';
  document.head.appendChild(css);
  _leafletPromise=new Promise((resolve,reject)=>{
    const js=document.createElement('script');
    js.src='/vendor/leaflet/leaflet.min.js';
    js.onload=()=>{ window.L ? resolve() : reject(new Error('L undefined')); };
    js.onerror=()=>reject(new Error('leaflet'));
    document.head.appendChild(js);
  });
  return _leafletPromise;
}
/* Inicia el mapa real asegurando primero que Leaflet esté cargado. */
function initMapDeferred(){
  ensureLeaflet().then(initMap).catch(()=>{
    const m=document.getElementById('map'), f=document.getElementById('mapFallback');
    if(m) m.style.display='none'; if(f) f.style.display='block';
  });
}

/* Fondo del mapa resistente: intenta OpenStreetMap y, si la red no lo alcanza,
   cae a CARTO. Si ningún proveedor carga, muestra un aviso (sin romper el mapa:
   los marcadores y senderos siguen visibles). */
function addBaseTiles(map){
  const providers=[
    {url:'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', o:{maxZoom:18, subdomains:'abc', attribution:'© OpenStreetMap'}},
    {url:'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png', o:{maxZoom:20, subdomains:'abcd', attribution:'© OpenStreetMap, © CARTO'}}
  ];
  let idx=0, layer=null, loaded=0, errors=0;
  function showTileNote(){
    if(document.getElementById('tileNote')) return;
    const n=document.createElement('div');
    n.id='tileNote';
    n.style.cssText='position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:500;background:rgba(22,53,42,.92);color:#f6efe3;font-size:.78rem;font-weight:600;padding:7px 14px;border-radius:99px;max-width:90%;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,.3)';
    n.textContent=t('map_tiles_off');
    const c=document.getElementById('map'); if(c) c.appendChild(n);
  }
  function place(){
    if(layer) map.removeLayer(layer);
    loaded=0; errors=0;
    layer=L.tileLayer(providers[idx].url, providers[idx].o).addTo(map);
    layer.on('tileload',()=>{ loaded++; const n=document.getElementById('tileNote'); if(n) n.remove(); });
    layer.on('tileerror',()=>{ errors++; if(loaded===0 && errors>=4 && idx<providers.length-1){ idx++; place(); } });
  }
  place();
  // Si tras 7s ningún proveedor cargó un solo tile → avisar (el mapa sigue usable)
  setTimeout(()=>{ if(loaded===0) showTileNote(); }, 7000);
}

function initMap(){
  if(typeof L==="undefined"){ // librería no disponible
    document.getElementById("map").style.display="none";
    document.getElementById("mapFallback").style.display="block";
    return;
  }
  try{
    const {lat,lng}=CONFIG.townCoords;
    const map=L.map("map",{scrollWheelZoom:false}).setView([lat,lng],13);
    window._leafletMapReal = map;
    addBaseTiles(map);

    const icon=L.divIcon({
      className:"",html:`<div style="width:30px;height:30px;background:#bd5d34;border:3px solid #fbf8f1;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 4px 10px rgba(0,0,0,.3)"></div>`,
      iconSize:[30,30],iconAnchor:[15,28]
    });
    const townIcon=L.divIcon({
      className:"",html:`<div style="width:34px;height:34px;background:#16352a;border:3px solid #d4a23f;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,.35)"></div>`,
      iconSize:[34,34],iconAnchor:[17,17]
    });

    L.marker([lat,lng],{icon:townIcon}).addTo(map)
      .bindPopup(`<div class="map-pop"><b>Labateca</b>${lang==="es"?"Parque Principal":"Main Square"}</div>`);

    window._placeIcon = icon;
    paintMapMarkers();
    setTimeout(()=>map.invalidateSize(),300);
  }catch(e){
    document.getElementById("map").style.display="none";
    document.getElementById("mapFallback").style.display="block";
  }
}

/* Pinta (o repinta) los marcadores de lugares y sus senderos.
   Se llama desde initMap() y de nuevo cuando places.json termina de cargar. */
function paintMapMarkers(){
  const map=window._leafletMapReal;
  if(!map||typeof L==="undefined"||!PLACES.length) return;
  if(window._placesLayer) map.removeLayer(window._placesLayer);
  const layer=L.layerGroup().addTo(map);
  window._placesLayer=layer;
  const {lat,lng}=CONFIG.townCoords;
  const group=[[lat,lng]];
  PLACES.forEach(p=>{
    if(p.lat==null||p.lng==null) return;
    const gmaps=`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;
    L.marker([p.lat,p.lng],{icon:window._placeIcon}).addTo(layer)
      .bindPopup(`<div class="map-pop"><b>${placeName(p)}</b>${(p.dist||{})[lang]||''} · ${(p.dificultad||p.diff||{})[lang]||''}<br><a href="${gmaps}" target="_blank" rel="noopener noreferrer">${IC.navi} ${t('cta_how')}</a></div>`);
    group.push([p.lat,p.lng]);
    if(p.track) drawTrack(p,layer);
  });
  map.fitBounds(group,{padding:[50,50]});
}

/* ============================================================
   TRACKS GPX — senderos propios grabados en campo
   Cada lugar puede tener track:"data/tracks/archivo.gpx".
   Se dibuja como línea sobre el mapa real (vanilla, sin librerías:
   el GPX es XML y se parsea con DOMParser).
   ============================================================ */
function drawTrack(p,layer){
  fetch('/'+p.track.replace(/^\//,''))
    .then(r=>{ if(!r.ok) throw new Error('http '+r.status); return r.text(); })
    .then(xml=>{
      const doc=new DOMParser().parseFromString(xml,"application/xml");
      if(doc.querySelector('parsererror')) throw new Error('GPX inválido');
      // trkpt = track grabado; rtept = ruta planificada (soportamos ambos)
      let pts=[...doc.querySelectorAll('trkpt')];
      if(!pts.length) pts=[...doc.querySelectorAll('rtept')];
      const coords=pts.map(pt=>[parseFloat(pt.getAttribute('lat')),parseFloat(pt.getAttribute('lon'))])
                      .filter(c=>!isNaN(c[0])&&!isNaN(c[1]));
      if(coords.length<2) return;
      let km=0;
      for(let i=1;i<coords.length;i++) km+=haversineKm(coords[i-1][0],coords[i-1][1],coords[i][0],coords[i][1]);
      const pl=L.polyline(coords,{color:'#a44a24',weight:4,opacity:.9,dashArray:'1 7',lineCap:'round'})
        .addTo(layer)
        .bindPopup(`<div class="map-pop"><b>${placeName(p)}</b>${t('map_track')} · ${km.toFixed(1)} km</div>`);
      // Registrar el sendero para poder resaltarlo desde el botón "Ver sendero"
      window._trackLayers=window._trackLayers||{};
      window._trackLayers[p.id]=pl;
    })
    .catch(e=>console.warn('[Labateca] track',p.id,':',e.message));
}

/* "Ver sendero": baja al mapa, asegura Leaflet y resalta la ruta del lugar. */
function showTrail(id){
  const sec=document.getElementById('mapa');
  try{ switchMap('real'); }catch(e){}
  if(sec) sec.scrollIntoView({behavior:'smooth'});
}

/* ============================================================
   TOGGLE MAPA REAL ↔ MAPA ILUSTRADO
   ============================================================ */
let _mapIlustradoInited = false;

function switchMap(type) {
  const isReal = type === 'real';
  // Mapa real = iframe de Google My Maps (no necesita Leaflet).
  // Mapa ilustrado = Leaflet CRS.Simple sobre imagen propia (sí lo necesita).
  if (!isReal && typeof L === "undefined") {
    ensureLeaflet().then(() => switchMap(type)).catch(()=>{});
    return;
  }
  // Si se muestra el mapa real, asegurar que el iframe de Google tenga su src cargado.
  if (isReal) { const gmf=document.getElementById('gmapsFrame'); if(gmf && !gmf.src && gmf.dataset.src){ gmf.src=gmf.dataset.src; } }
  // Mostrar/ocultar contenedores. OJO: #map-ilustrado tiene display:none en CSS,
  // así que para mostrarlo hay que poner 'block' explícito (con '' volvería a none).
  document.getElementById("map").style.display           = isReal ? 'block' : 'none';
  document.getElementById("map-ilustrado").style.display = isReal ? 'none' : 'block';
  document.getElementById("mapIlustradoNote").style.display = isReal ? 'none' : 'block';
  // Actualizar tabs
  document.getElementById("tabMapReal").classList.toggle("active", isReal);
  document.getElementById("tabMapIlustrado").classList.toggle("active", !isReal);
  // Inicializar mapa ilustrado solo una vez (al primer clic)
  if (!isReal && !_mapIlustradoInited) {
    initMapIlustrado();
    _mapIlustradoInited = true;
  }
  if (!isReal && window._leafletMapIlustrado) {
    setTimeout(() => window._leafletMapIlustrado.invalidateSize(), 60);
  }
}

/* ============================================================
   MAPA ILUSTRADO (Leaflet CRS.Simple + imagen artística)
   IMPORTANTE: es estático — sin GPS encima del dibujo.
   Las coordenadas reales se delegan a Google Maps.
   ============================================================ */
function initMapIlustrado() {
  if (typeof L === 'undefined') return;
  try {
    // Dimensiones del canvas del mapa ilustrado (coinciden con el SVG)
    const IMG_W = 1000, IMG_H = 700;
    // En CRS.Simple: [lat, lng] = [filaDesdeAbajo, columna]
    // Para pixel de pantalla (x, y): lat = IMG_H - y, lng = x
    const bounds = [[0, 0], [IMG_H, IMG_W]];

    const mapIl = L.map('map-ilustrado', {
      crs: L.CRS.Simple,
      minZoom: -2,
      maxZoom: 2,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      attributionControl: false,
      zoomControl: true
    });
    window._leafletMapIlustrado = mapIl;

    // Imagen base del mapa ilustrado
    L.imageOverlay('/images/mapa-ilustrado-placeholder.svg', bounds, {
      interactive: false
    }).addTo(mapIl);
    mapIl.fitBounds(bounds, { padding: [10, 10] });

    // Icono personalizado para los marcadores del mapa ilustrado
    const iconBase = (color) => L.divIcon({
      className: '',
      html: `<div style="
        width:18px;height:18px;
        background:${color};
        border:2.5px solid #fbf8f1;
        border-radius:50%;
        box-shadow:0 2px 8px rgba(0,0,0,.4);
        cursor:pointer;
        transition:transform .2s;
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -12]
    });

    // Colores por categoría
    const CAT_COLOR = {
      naturaleza:  '#2d6149',
      cultura:     '#bd5d34',
      gastronomia: '#d4a23f',
      hospedaje:   '#7bb3d4'
    };

    // Dibujar marcadores
    PLACES.forEach(p => {
      // Necesitamos mapaX y mapaY para posicionar en el ilustrado
      if (p.mapaX == null || p.mapaY == null) return;

      // Conversión: pixel (x=mapaX, y=mapaY) → Leaflet [lat, lng]
      const latlng = [IMG_H - p.mapaY, p.mapaX];
      const cat    = p.categoria || p.cat || 'naturaleza';
      const color  = CAT_COLOR[cat] || '#bd5d34';
      const gmaps  = `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`;

      const nombre   = placeName(p);
      const dist     = (p.dist        || {})[lang] || '';
      const dific    = (p.dificultad  || p.diff || {})[lang] || '';
      const rec      = (p.recomendacion || p.rec || {})[lang] || '';
      const catLabel = t('fil_' + cat);
      const notaVerif= !p.verified
        ? `<span style="display:inline-block;margin-top:5px;font-size:.72rem;background:#d4a23f;color:#16352a;padding:2px 7px;border-radius:99px;font-weight:800">${t('verify_badge')}</span>`
        : '';

      const popup = `
        <div class="map-pop">
          <div style="font-size:.7rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${color};margin-bottom:4px">${catLabel}</div>
          <b>${nombre}</b>
          ${notaVerif}
          ${dist || dific ? `<span class="map-pop-stats">${[dist, dific].filter(Boolean).join(' · ')}</span>` : ''}
          ${rec ? `<span class="map-pop-rec">${rec}</span>` : ''}
          <a href="${gmaps}" target="_blank" rel="noopener noreferrer">${IC.navi} ${t('cta_how')}</a>
        </div>`;

      L.marker(latlng, { icon: iconBase(color) })
        .addTo(mapIl)
        .bindPopup(popup, { maxWidth: 260, minWidth: 180 });
    });

    setTimeout(() => mapIl.invalidateSize(), 300);
  } catch(e) {
    console.warn('[Labateca] Error inicializando mapa ilustrado:', e);
  }
}

/* ============================================================
   ENLACES DE CONTACTO / SOCIAL desde CONFIG
   ============================================================ */
function wireLinks(){
  const wa=buildWaLink("Hola Labateca Turismo, quisiera información para visitar el pueblo.");
  const mapTown=`https://www.google.com/maps/search/?api=1&query=${CONFIG.townCoords.lat},${CONFIG.townCoords.lng}`;
  // Uso wrapper seguro: si el elemento no existe, no crashea
  const set=(id,prop,val)=>{ const el=document.getElementById(id); if(el) el[prop]=val; };
  set("chWhatsapp","href",wa);
  set("footWa","href",wa);
  set("chMail","href",`mailto:${CONFIG.email}`);
  set("mailText","textContent",CONFIG.email);
  set("chLoc","href",mapTown);
  set("footMap","href",mapTown);
  // Redes sociales: si no están configuradas ("#" o vacío), ocultar el ícono
  const social=(id,url)=>{
    const el=document.getElementById(id); if(!el) return;
    if(!url || url==="#"){ el.style.display="none"; }
    else { el.href=url; el.style.display=""; }
  };
  social("socIg",CONFIG.social.instagram);
  social("socFb",CONFIG.social.facebook);
  social("socTk",CONFIG.social.tiktok);
}

/* Contador de visitas visible (usa el Worker de reseñas + D1).
   Cuenta UNA vez por visitante por día (vía localStorage) para no inflar:
   el primer acceso del día suma (POST), el resto solo lee (GET). */
function loadVisitCounter(){
  const wrap = document.getElementById('visitCounter');
  const num  = document.getElementById('visitCount');
  if (!wrap || !num || !CONFIG.reviewsWorkerUrl) return;
  const today = new Date().toISOString().slice(0, 10);
  const alreadyToday = store.get('lab_visit_day') === today;
  fetch(`${CONFIG.reviewsWorkerUrl}/api/visits`, { method: alreadyToday ? 'GET' : 'POST' })
    .then(r => r.json())
    .then(d => {
      if (!d || !d.ok || typeof d.total !== 'number') return;
      if (!alreadyToday) store.set('lab_visit_day', today);
      num.textContent = d.total.toLocaleString(lang === 'es' ? 'es-CO' : 'en-US');
      wrap.hidden = false;
    })
    .catch(() => { /* si el worker no responde, el contador queda oculto */ });
}

/* ============================================================
   LIGHTBOX
   ============================================================ */
let _lbPlace    = null;   // lugar activo
let _lbIdx      = 0;      // índice de foto actual
let _lbFocusPrev = null;  // elemento con foco antes de abrir (para restaurarlo)
let _lbTouchX   = 0;      // para swipe en móvil

function openLightbox(placeId, photoIdx) {
  const p = PLACES.find(x => x.id === placeId);
  if (!p) return;
  _lbPlace     = p;
  _lbIdx       = photoIdx || 0;
  _lbFocusPrev = document.activeElement;
  paintLightbox();
  const lb = document.getElementById('lightbox');
  lb.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
  document.getElementById('lbClose').focus();
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  lb.setAttribute('hidden', '');
  document.body.style.overflow = '';
  _lbPlace = null;
  if (_lbFocusPrev) _lbFocusPrev.focus();
}

function lightboxNav(dir) {
  if (!_lbPlace) return;
  const total = (_lbPlace.fotos || []).length;
  if (total < 2) return;
  _lbIdx = (_lbIdx + dir + total) % total;
  paintLightbox();
}

function paintLightbox() {
  if (!_lbPlace) return;
  const p      = _lbPlace;
  const fotos  = p.fotos || [];
  const total  = fotos.length;
  const media  = document.getElementById('lbMedia');

  // ── Imagen o placeholder ──
  if (total > 0) {
    const url = cldUrl(fotos[_lbIdx], 'w_1600,f_auto,q_auto')
             || cldUrl(fotos[_lbIdx], 'w_1200,f_auto,q_auto');
    if (url) {
      const img = new Image();
      img.id      = 'lbImg';
      img.className = 'loading';
      img.alt     = placeName(p);
      img.onload  = () => img.classList.remove('loading');
      img.src     = url;
      media.innerHTML = '';
      media.appendChild(img);
    } else {
      // Public ID existe pero cloudName vacío → mostrar placeholder con aviso
      media.innerHTML = lbPlaceholder(p, true);
    }
  } else {
    // Sin fotos aún
    media.innerHTML = lbPlaceholder(p, false);
  }

  // ── Leyenda ──
  document.getElementById('lbTitle').textContent = placeName(p);
  const rec = (p.recomendacion || p.rec || {})[lang] || '';
  document.getElementById('lbRec').textContent   = rec;

  // ── Contador y nav ──
  const showNav = total > 1;
  document.getElementById('lbPrev').toggleAttribute('hidden', !showNav);
  document.getElementById('lbNext').toggleAttribute('hidden', !showNav);
  document.getElementById('lbCounter').textContent = showNav
    ? `${_lbIdx + 1} ${t('lb_of')} ${total}` : '';
}

function lbPlaceholder(p, hasIds) {
  const cat   = p.categoria || p.cat || 'naturaleza';
  const msg   = hasIds
    ? `<p style="font-size:.82rem;opacity:.6">Configura CONFIG.cloudName<br>para ver las fotos</p>`
    : `<p>${t('lb_no_photo')}</p>`;
  return `<div class="lb-ph">
    ${IC.cam}
    <strong style="font-family:'Fraunces',serif;font-size:1.3rem;color:var(--cream)">${placeName(p)}</strong>
    <span style="font-size:.8rem;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-soft);font-weight:800">${t('fil_'+cat)}</span>
    ${msg}
  </div>`;
}

/* ── Teclado: Esc / flechas / focus trap ── */
document.addEventListener('keydown', e => {
  const lb = document.getElementById('lightbox');
  if (!lb || lb.hasAttribute('hidden')) return;
  if (e.key === 'Escape')     { closeLightbox(); return; }
  if (e.key === 'ArrowLeft')  { lightboxNav(-1); return; }
  if (e.key === 'ArrowRight') { lightboxNav(1);  return; }
  // Focus trap: tab cicla dentro del lightbox
  if (e.key === 'Tab') {
    const focusable = Array.from(lb.querySelectorAll('button:not([hidden]),[tabindex="0"]:not([hidden])'));
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }
});

/* ── Swipe en móvil ── */
(function(){
  const lb = document.getElementById('lightbox');
  if (!lb) return; // guarda si el SW sirvió HTML viejo sin el lightbox
  lb.addEventListener('touchstart', e => {
    _lbTouchX = e.touches[0].clientX;
  }, { passive: true });
  lb.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - _lbTouchX;
    if (Math.abs(dx) > 50) lightboxNav(dx < 0 ? 1 : -1);
  }, { passive: true });
})();

/* ============================================================
   PDF DESCARGABLE — generado en el cliente con jsPDF
   ============================================================ */
function generatePDF() {
  const statusEl = document.getElementById('pdfStatus');
  if (statusEl) statusEl.textContent = t('pdf_generating');

  // Cargar jsPDF de forma diferida (no afecta la carga inicial)
  const loadJsPDF = new Promise((resolve, reject) => {
    if (window.jspdf) { resolve(window.jspdf.jsPDF); return; }
    const s = document.createElement('script');
    s.src = '/vendor/jspdf/jspdf.umd.min.js';  // auto-alojado (sin CDN externo)
    s.onload  = () => resolve(window.jspdf.jsPDF);
    s.onerror = reject;
    document.head.appendChild(s);
  });

  loadJsPDF.then(jsPDF => {
    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W    = 210;  // A4 width mm
    const H    = 297;  // A4 height mm
    const ML   = 18;   // margin left
    const MR   = 18;   // margin right
    const CW   = W - ML - MR; // content width
    const FOREST  = [22, 53, 42];
    const CLAY    = [189, 93, 52];
    const GOLD    = [212, 162, 63];
    const CREAM   = [246, 239, 227];
    const INK     = [29, 26, 21];
    const INK_MUT = [106, 99, 87];

    const CAT_COLORS = {
      naturaleza:  [31, 74, 57],
      cultura:     [139, 58, 26],
      gastronomia: [122, 92, 30],
      hospedaje:   [26, 58, 92]
    };
    const CAT_LABELS_ES = { naturaleza:'Naturaleza', cultura:'Cultura', gastronomia:'Gastronomía', hospedaje:'Hospedaje' };
    const CAT_LABELS_EN = { naturaleza:'Nature', cultura:'Culture', gastronomia:'Food', hospedaje:'Lodging' };
    const catLabel = (cat) => (lang === 'es' ? CAT_LABELS_ES : CAT_LABELS_EN)[cat] || cat;

    // ── Helpers ───────────────────────────────────────────────
    function setFont(style, size, color) {
      doc.setFont('helvetica', style);
      doc.setFontSize(size);
      if (color) doc.setTextColor(...color); else doc.setTextColor(...INK);
    }
    function fillRect(x, y, w, h, color) {
      doc.setFillColor(...color);
      doc.rect(x, y, w, h, 'F');
    }
    function addWrappedText(text, x, y, maxW, lineH) {
      const lines = doc.splitTextToSize(text, maxW);
      doc.text(lines, x, y);
      return y + lines.length * lineH;
    }

    // ── PORTADA ───────────────────────────────────────────────
    fillRect(0, 0, W, H, FOREST);
    // Banda dorada top
    fillRect(0, 0, W, 3, GOLD);
    // Triángulo/montaña decorativo
    doc.setFillColor(...[45, 97, 73]);
    doc.triangle(0, H, W/2, H*0.35, W, H, 'F');
    doc.setFillColor(...[31, 74, 57]);
    doc.triangle(0, H, W*0.3, H*0.5, W*0.6, H, 'F');

    // Títulos
    setFont('bold', 42, GOLD);
    doc.text('Labateca', W/2, 90, { align: 'center' });
    setFont('normal', 16, CREAM);
    doc.text(lang === 'es' ? 'Volcanes de Dios' : "God's Volcanoes", W/2, 102, { align: 'center' });
    // Línea decorativa
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.5);
    doc.line(ML + 30, 108, W - MR - 30, 108);
    // Subtítulo
    setFont('normal', 12, [200, 190, 175]);
    doc.text(
      lang === 'es' ? 'Guía turística completa · Norte de Santander, Colombia'
                    : 'Complete travel guide · Norte de Santander, Colombia',
      W/2, 116, { align: 'center' }
    );
    // Datos
    setFont('normal', 10, [160, 150, 135]);
    doc.text('1.566 m.s.n.m.  ·  ~20 °C  ·  ~113 km de Cúcuta', W/2, 128, { align: 'center' });
    // Fecha
    const fecha = new Date().toLocaleDateString(lang === 'es' ? 'es-CO' : 'en-US', { year:'numeric', month:'long' });
    setFont('normal', 9, [130, 120, 110]);
    doc.text(fecha, W/2, H - 20, { align: 'center' });
    doc.text('labateca-turismo.co', W/2, H - 14, { align: 'center' });

    // ── ORGANIZAR LUGARES POR CATEGORÍA ──────────────────────
    const cats = ['naturaleza', 'cultura', 'gastronomia', 'hospedaje'];
    const bycat = {};
    cats.forEach(c => { bycat[c] = PLACES.filter(p => (p.categoria || p.cat) === c); });

    let pageNum = 1;

    cats.forEach(cat => {
      const list = bycat[cat];
      if (!list.length) return;

      // ── PÁGINA DE CATEGORÍA ───────────────────────────────
      doc.addPage();
      pageNum++;
      const catColor = CAT_COLORS[cat] || FOREST;

      // Header de categoría
      fillRect(0, 0, W, 28, catColor);
      fillRect(0, 0, W, 2, GOLD);
      setFont('bold', 22, CREAM);
      doc.text(catLabel(cat).toUpperCase(), ML, 18);
      setFont('normal', 9, [200, 190, 175]);
      doc.text(`Labateca · ${list.length} ${lang === 'es' ? 'lugares' : 'places'}`, ML, 25);

      let y = 40;

      list.forEach((p, idx) => {
        const nombre  = (p.nombre || p.name || {})[lang] || p.id;
        const desc    = (p.desc || {})[lang] || '';
        const dist    = (p.dist || {})[lang] || '';
        const tiempo  = (p.tiempo || p.time || {})[lang] || '';
        const dific   = (p.dificultad || p.diff || {})[lang] || '';
        const como    = (p.comoLlegar || {})[lang] || '';
        const rec     = (p.recomendacion || p.rec || {})[lang] || '';

        // Estimar altura necesaria
        const descLines  = doc.splitTextToSize(desc, CW - 4).length;
        const comoLines  = como ? doc.splitTextToSize(como, CW - 4).length : 0;
        const recLines   = rec  ? doc.splitTextToSize(rec,  CW - 4).length : 0;
        const neededH    = 10 + descLines * 4.5 + (comoLines + recLines) * 4.5 + 22;

        // Salto de página si no cabe
        if (y + neededH > H - 20) {
          doc.addPage(); pageNum++;
          fillRect(0, 0, W, 12, catColor);
          fillRect(0, 0, W, 2, GOLD);
          setFont('bold', 9, CREAM);
          doc.text(catLabel(cat).toUpperCase() + ' (cont.)', ML, 9);
          y = 20;
        }

        // Borde izquierdo de color
        doc.setFillColor(...catColor);
        doc.rect(ML, y, 3, neededH - 4, 'F');

        // Número
        setFont('bold', 8, catColor);
        doc.text(String(idx + 1).padStart(2, '0'), ML + 6, y + 6);

        // Nombre
        setFont('bold', 13, INK);
        doc.text(nombre, ML + 16, y + 6);

        // Chips: dist · tiempo · dific
        let cx = ML + 16;
        const chips = [dist, tiempo, dific].filter(Boolean);
        setFont('normal', 7.5, INK_MUT);
        if (chips.length) {
          y += 10;
          doc.text(chips.join('  ·  '), ML + 16, y);
          y += 6;
        } else {
          y += 10;
        }

        // Descripción
        if (desc) {
          setFont('normal', 9, INK);
          y = addWrappedText(desc, ML + 16, y, CW - 16, 4.5);
          y += 2;
        }

        // Cómo llegar
        if (como) {
          setFont('bold', 8, catColor);
          doc.text(lang === 'es' ? 'Cómo llegar:' : 'How to get there:', ML + 16, y);
          y += 4.5;
          setFont('normal', 8.5, INK_MUT);
          y = addWrappedText(como, ML + 16, y, CW - 16, 4.2);
          y += 1;
        }

        // Recomendación
        if (rec) {
          setFont('bold', 8, GOLD.map(v => Math.max(0, v - 30)));
          doc.text('💡 ' + (lang === 'es' ? 'Tip:' : 'Tip:'), ML + 16, y);
          y += 4.5;
          setFont('normal', 8.5, INK_MUT);
          y = addWrappedText(rec, ML + 16, y, CW - 16, 4.2);
          y += 1;
        }

        // Separador
        doc.setDrawColor(...[220, 215, 205]);
        doc.setLineWidth(0.3);
        doc.line(ML + 4, y + 1, W - MR, y + 1);
        y += 7;
      });
    });

    // ── PIE EN TODAS LAS PÁGINAS ──────────────────────────────
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      if (i > 1) { // no en portada
        fillRect(0, H - 10, W, 10, FOREST);
        setFont('normal', 7, [180, 170, 155]);
        doc.text('Labateca · Volcanes de Dios · labateca-turismo.co', ML, H - 4);
        doc.text(`${i} / ${total}`, W - MR, H - 4, { align: 'right' });
      }
    }

    // ── GUARDAR ────────────────────────────────────────────────
    const filename = `Labateca-Guia-${lang.toUpperCase()}-${new Date().getFullYear()}.pdf`;
    doc.save(filename);

    if (statusEl) statusEl.textContent = t('pdf_done');
    setTimeout(() => { if (statusEl) statusEl.textContent = t('pdf_sub'); }, 4000);
  }).catch(err => {
    console.error('jsPDF no cargó:', err);
    if (statusEl) statusEl.textContent = lang === 'es' ? 'Error al generar el PDF. Intenta de nuevo.' : 'PDF generation failed. Please try again.';
  });
}

/* ============================================================
   CHAT IA FLOTANTE
   ============================================================ */
let _chatOpen = false;

function toggleChat(open) {
  _chatOpen = (open !== undefined) ? !!open : !_chatOpen;
  const panel = document.getElementById('chat-panel');
  if (!panel) return;
  panel.classList.toggle('open', _chatOpen);
  panel.setAttribute('aria-hidden', String(!_chatOpen));
  if (_chatOpen) {
    setTimeout(() => { const inp = document.getElementById('chatInput'); if(inp) inp.focus(); }, 150);
  }
}

function _chatAddMsg(text, role, isHTML) {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return null;
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role;
  if (isHTML) div.innerHTML = text; else div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function _chatTyping() {
  const msgs = document.getElementById('chatMessages');
  if (!msgs) return null;
  const div = document.createElement('div');
  div.className = 'chat-msg typing';
  div.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

function sendSuggestion(btn) {
  const inp = document.getElementById('chatInput');
  if (inp) inp.value = btn.textContent;
  const sugs = document.getElementById('chatSuggestions');
  if (sugs) sugs.style.display = 'none';
  sendChat();
}

async function sendChat() {
  const inp  = document.getElementById('chatInput');
  const send = document.getElementById('chatSend');
  const q    = inp ? inp.value.trim() : '';
  if (!q) return;

  // Reset input
  if (inp)  { inp.value = ''; inp.style.height = 'auto'; }
  if (send) send.disabled = true;
  const sugs = document.getElementById('chatSuggestions');
  if (sugs) sugs.style.display = 'none';

  _chatAddMsg(q, 'user', false);
  const typing = _chatTyping();

  try {
    const resp = await fetch(CONFIG.chatWorkerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: q, lang: lang, places: PLACES.slice(0, 15) })
    });
    const data = await resp.json();
    if (typing) typing.remove();
    if (data.ok && data.answer) {
      _chatAddMsg(data.answer, 'ai', false);
    } else {
      throw new Error(data.error || 'Sin respuesta');
    }
  } catch(err) {
    if (typing) typing.remove();
    const wa  = buildWaLink(q);
    const key = lang === 'es' ? 'chat_error' : 'chat_error';
    const msg = t(key).replace('{{wa}}', wa);
    _chatAddMsg(msg, 'ai', true);
  }

  if (send) send.disabled = false;
  if (inp)  inp.focus();
}

/* ============================================================
   NAV: scroll, menú móvil, reveal
   ============================================================ */
function toggleMenu(){
  const links=document.getElementById("navLinks");
  const overlay=document.getElementById("navOverlay");
  const open=links.classList.toggle("open");
  overlay.classList.toggle("open",open);
  const burger=document.getElementById("hamburger");
  if(burger) burger.setAttribute("aria-expanded",open?"true":"false");
  // Al abrir, llevar el foco al primer enlace; al cerrar, devolverlo a la hamburguesa
  if(open){ const a=links.querySelector("a"); if(a) setTimeout(()=>a.focus(),50); }
  else if(burger){ burger.focus(); }
}
document.querySelectorAll(".nav-links a").forEach(a=>a.addEventListener("click",()=>{
  document.getElementById("navLinks").classList.remove("open");
  document.getElementById("navOverlay").classList.remove("open");
}));

window.addEventListener("scroll",()=>{
  document.getElementById("header").classList.toggle("scrolled",window.scrollY>40);
});

const io=new IntersectionObserver((entries)=>{
  entries.forEach(en=>{ if(en.isIntersecting){ en.target.classList.add("in"); io.unobserve(en.target);} });
},{threshold:.12});

/* ============================================================
   INIT
   ============================================================ */
function init(){
  // 0. Abrir SIEMPRE arriba (en el hero), salvo que la URL pida un lugar concreto.
  //    Evita que el navegador o una app instalada (PWA) restaure el scroll anterior
  //    o que algún recurso (mapa/imágenes) arrastre la página hacia abajo al cargar.
  try {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const _wantsLugar = new URLSearchParams(location.search).get('lugar');
    if (!_wantsLugar && !location.hash) {
      window.scrollTo(0, 0);
      // Re-afirmar el tope tras el primer pintado y tras cargar recursos (imágenes/
      // fuentes) que pudieran haber arrastrado la página hacia abajo. {once} evita
      // interferir con el scroll posterior del usuario (p. ej. al bajar al mapa).
      requestAnimationFrame(() => window.scrollTo(0, 0));
      window.addEventListener('load', () => window.scrollTo(0, 0), { once: true });
    }
  } catch(e) { /* no romper el arranque */ }

  // 1. Cargar idioma guardado
  lang = store.get("lab_lang") || "es";
  document.getElementById("langEs").classList.toggle("active",lang==="es");
  document.getElementById("langEn").classList.toggle("active",lang==="en");
  document.getElementById("year").textContent=new Date().getFullYear();
  applyI18n();

  // 2. Render inicial — cada función en try individual para que un error no detenga todo
  try { renderFilters(); } catch(e) { console.warn('renderFilters',e); }
  try { renderPlaces();  } catch(e) { console.warn('renderPlaces',e);  }
  try { renderGallery(); } catch(e) { console.warn('renderGallery',e); }
  try { renderDrawer();  } catch(e) { console.warn('renderDrawer',e);  }
  try { updateBadges();  } catch(e) { console.warn('updateBadges',e);  }
  try { wireLinks();     } catch(e) { console.warn('wireLinks',e);     }
  try { initVideos();    } catch(e) { console.warn('initVideos',e);    }
  try { loadVisitCounter(); } catch(e) { console.warn('loadVisitCounter',e); }
  try { loadWeather();   } catch(e) { console.warn('loadWeather',e);   }
  // Mapa real = iframe de Google My Maps. Se carga SOLO cuando la sección del mapa
  // entra en pantalla. Así el iframe no roba el foco al abrir la página (evita que la
  // página baje sola hasta el mapa). Leaflet solo lo usa el mapa ilustrado.
  try {
    const gmf=document.getElementById('gmapsFrame'), mapaSec=document.getElementById('mapa');
    const loadGmaps=()=>{ if(gmf && !gmf.src && gmf.dataset.src){ gmf.src=gmf.dataset.src; } };
    if(gmf && mapaSec && 'IntersectionObserver' in window){
      const mo=new IntersectionObserver((ents,obs)=>{
        if(ents.some(x=>x.isIntersecting)){ obs.disconnect(); loadGmaps(); }
      },{rootMargin:'200px'});
      mo.observe(mapaSec);
    } else { loadGmaps(); }
  } catch(e){ console.warn('gmaps defer',e); }
  try { loadEventos();   } catch(e) { console.warn('loadEventos',e);   }
  try { loadGuias();     } catch(e) { console.warn('loadGuias',e);     }

  // Activar animaciones de scroll (progressive enhancement):
  // primero el contenido está visible (sin .js-anim),
  // luego activamos las animaciones para las secciones debajo del fold
  setTimeout(() => {
    document.documentElement.classList.add('js-anim');
    document.querySelectorAll(".reveal").forEach(el => io.observe(el));
  }, 200);

  // Fallback: garantiza que ningún elemento .reveal quede invisible si IntersectionObserver falla
  setTimeout(()=>{ document.querySelectorAll('.reveal:not(.in)').forEach(el=>el.classList.add('in')); }, 3500);

  // 3. Cargar datos JSON en paralelo (no bloquea el render inicial)
  fetch('/data/places.json')
    .then(r => r.json())
    .then(json => {
      PLACES = Array.isArray(json.lugares) ? json.lugares : [];
      renderFilters(); renderPlaces(); renderGallery();
      try { paintMapMarkers(); } catch(e) { console.warn('paintMapMarkers', e); }
      // Después de cargar los lugares, verificar si hay ?lugar= en la URL
      _checkLugarParam();
    })
    .catch(e => console.warn('[Labateca] places.json:', e.message));

  // 4. Cargar rutas temáticas (también en paralelo)
  loadRutas();
}

/* ── Abrir lugar desde URL ?lugar=ID (para QR codes físicos) ── */
function _checkLugarParam() {
  try {
    const params  = new URLSearchParams(window.location.search);
    const lugarId = params.get('lugar');
    if (!lugarId) return;
    const p = PLACES.find(x => x.id === lugarId);
    if (!p) return;
    // Scroll a la sección de lugares y abrir el lightbox
    const secLugares = document.getElementById('lugares');
    if (secLugares) secLugares.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Pequeño delay para que el scroll empiece antes de abrir el modal
    setTimeout(() => openLightbox(lugarId), 600);
  } catch(e) { /* ignorar */ }
}

// 4. Registrar Service Worker (HTTPS o localhost)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // updateViaCache:'none' → el navegador siempre comprueba sw.js fresco (detecta updates rápido)
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(reg => { console.log('[SW] Registrado:', reg.scope); reg.update(); })
      .catch(err => console.warn('[SW] Error al registrar:', err));
  });
}

init();
