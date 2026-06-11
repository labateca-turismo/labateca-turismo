/* ============================================================
   WORKER DE RESEÑAS — Labateca · Volcanes de Dios
   Reseñas de visitantes con moderación previa.

   CONFIGURACIÓN EN EL DASHBOARD:
   1. Crear base de datos D1 llamada "labateca-reviews"
      (Storage & Databases → D1 → Create) y vincularla a este
      worker con el binding "DB" (Settings → Bindings → D1).
   2. Crear el secret ADMIN_KEY (Settings → Variables) con una
      contraseña larga inventada — es la llave del panel de moderación.

   PANEL DE MODERACIÓN:
     https://labateca-reviews.jr22caceres.workers.dev/moderar?key=TU_ADMIN_KEY
   ============================================================ */

const ALLOWED_ORIGINS = [
  'https://labateca-turismo.jr22caceres.workers.dev',
  'http://localhost:8000',
  'http://localhost:8765',
];

const MAX_NAME = 60;
const MAX_COMMENT = 600;
const PLACE_RE = /^[a-z0-9-]{2,60}$/;
const PHOTO_PREFIX = 'https://res.cloudinary.com/dtumgxebs/';
const RATE_LIMIT = 5; // reseñas por IP por hora

const SCHEMA = `CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  place TEXT NOT NULL,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  photo TEXT DEFAULT '',
  lang TEXT DEFAULT 'es',
  ip TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
)`;

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, cors),
  });
}

function esc(s) {
  return String(s).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (origin && !allowed && url.pathname.startsWith('/api/')) {
      return json({ ok: false, error: 'Origin not allowed' }, 403, cors);
    }

    await env.DB.prepare(SCHEMA).run();

    /* ── API pública: leer reseñas aprobadas ── */
    if (url.pathname === '/api/reviews' && request.method === 'GET') {
      const place = url.searchParams.get('place') || '';
      if (!PLACE_RE.test(place)) return json({ ok: false, error: 'Bad place' }, 400, cors);
      const { results } = await env.DB
        .prepare("SELECT name, rating, comment, photo, created_at FROM reviews WHERE place = ? AND status = 'approved' ORDER BY id DESC LIMIT 50")
        .bind(place).all();
      const avg = results.length
        ? (results.reduce((s, r) => s + r.rating, 0) / results.length).toFixed(1)
        : null;
      return json({ ok: true, reviews: results, avg }, 200, cors);
    }

    /* ── API pública: enviar reseña (queda pendiente) ── */
    if (url.pathname === '/api/reviews' && request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: 'Bad JSON' }, 400, cors); }

      const place = String(body.place || '');
      const name = String(body.name || '').trim().slice(0, MAX_NAME);
      const comment = String(body.comment || '').trim().slice(0, MAX_COMMENT);
      const rating = parseInt(body.rating, 10);
      const lang = body.lang === 'en' ? 'en' : 'es';
      let photo = String(body.photo || '');

      if (!PLACE_RE.test(place)) return json({ ok: false, error: 'Bad place' }, 400, cors);
      if (!name || !comment) return json({ ok: false, error: 'Missing fields' }, 400, cors);
      if (!(rating >= 1 && rating <= 5)) return json({ ok: false, error: 'Bad rating' }, 400, cors);
      if (photo && !photo.startsWith(PHOTO_PREFIX)) photo = '';

      const ip = request.headers.get('CF-Connecting-IP') || '';
      const { results: recent } = await env.DB
        .prepare("SELECT COUNT(*) AS n FROM reviews WHERE ip = ? AND created_at > datetime('now','-1 hour')")
        .bind(ip).all();
      if (recent[0].n >= RATE_LIMIT) return json({ ok: false, error: 'Too many reviews, try later' }, 429, cors);

      await env.DB
        .prepare('INSERT INTO reviews (place, name, rating, comment, photo, lang, ip) VALUES (?,?,?,?,?,?,?)')
        .bind(place, name, rating, comment, photo, lang, ip).run();
      return json({ ok: true }, 200, cors);
    }

    /* ── Moderación (requiere ADMIN_KEY) ── */
    const key = url.searchParams.get('key') || '';
    const isAdmin = env.ADMIN_KEY && key === env.ADMIN_KEY;

    if (url.pathname === '/moderar') {
      if (!isAdmin) return new Response('Acceso denegado. Usa /moderar?key=TU_ADMIN_KEY', { status: 403 });
      const { results } = await env.DB
        .prepare("SELECT * FROM reviews WHERE status = 'pending' ORDER BY id ASC LIMIT 100").all();
      const rows = results.map(r => `
        <div class="card">
          <div class="meta"><b>${esc(r.name)}</b> · ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)} · <code>${esc(r.place)}</code> · ${esc(r.created_at)}</div>
          <p>${esc(r.comment)}</p>
          ${r.photo ? `<img src="${esc(r.photo)}" loading="lazy">` : ''}
          <div class="acts">
            <button class="ok" onclick="act(${r.id},'approve')">✓ Aprobar</button>
            <button class="no" onclick="act(${r.id},'reject')">✕ Rechazar</button>
          </div>
        </div>`).join('') || '<p>🎉 No hay reseñas pendientes.</p>';
      return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Moderación · Labateca</title>
<style>
body{font-family:system-ui;background:#f5efe3;color:#16352a;max-width:680px;margin:0 auto;padding:24px}
h1{font-size:1.4rem;margin-bottom:18px}
.card{background:#fff;border-radius:14px;padding:16px 18px;margin-bottom:14px;box-shadow:0 3px 10px rgba(22,53,42,.08)}
.meta{font-size:.82rem;color:#666;margin-bottom:8px}
.card p{font-size:.95rem;line-height:1.5;margin-bottom:10px}
.card img{max-width:220px;max-height:160px;border-radius:10px;display:block;margin-bottom:10px}
.acts{display:flex;gap:10px}
button{border:none;border-radius:99px;padding:9px 22px;font-weight:700;cursor:pointer;font-size:.9rem}
.ok{background:#16352a;color:#fff}.no{background:#eee;color:#a33}
</style></head><body>
<h1>🛡️ Moderación de reseñas (${results.length} pendientes)</h1>${rows}
<script>
async function act(id, action){
  const r = await fetch('/api/admin/' + action + '?key=' + encodeURIComponent('${key}'), {
    method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id })
  });
  const j = await r.json();
  if (j.ok) location.reload(); else alert(j.error || 'Error');
}
</'+'script></body></html>`.replace("</'+'script>", '<\/script>'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    if ((url.pathname === '/api/admin/approve' || url.pathname === '/api/admin/reject') && request.method === 'POST') {
      if (!isAdmin) return json({ ok: false, error: 'Forbidden' }, 403);
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: 'Bad JSON' }, 400); }
      const id = parseInt(body.id, 10);
      if (!id) return json({ ok: false, error: 'Bad id' }, 400);
      if (url.pathname.endsWith('approve')) {
        await env.DB.prepare("UPDATE reviews SET status = 'approved' WHERE id = ?").bind(id).run();
      } else {
        await env.DB.prepare('DELETE FROM reviews WHERE id = ?').bind(id).run();
      }
      return json({ ok: true });
    }

    return json({ ok: true, service: 'Reseñas de Labateca Turismo' }, 200, cors);
  },
};
