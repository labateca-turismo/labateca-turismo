/* ============================================================
   WORKER DE AUTENTICACIÓN — Sveltia CMS · Labateca Turismo
   Permite entrar al panel /admin con cuenta de GitHub.

   CONFIGURACIÓN (variables del worker en el dashboard):
     GITHUB_CLIENT_ID     → de la GitHub OAuth App
     GITHUB_CLIENT_SECRET → de la GitHub OAuth App (tipo "Secret")

   La OAuth App de GitHub debe tener como callback URL:
     https://labateca-cms-auth.labatecacolombia.workers.dev/callback
   ============================================================ */

const ALLOWED_SITES = [
  'labateca-turismo.labatecacolombia.workers.dev',
  'localhost:8000',
  'localhost:8765',
];

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

/* Página que devuelve el resultado al CMS (protocolo Decap/Sveltia via postMessage) */
function callbackPage(provider, payload, ok) {
  const state = ok ? 'success' : 'error';
  const content = JSON.stringify(payload);
  return html(`<!doctype html><html><body><script>
(function () {
  function receiveMessage() {
    window.opener.postMessage(
      'authorization:${provider}:${state}:${content.replace(/[\\\\']/g, '\\\\$&')}',
      '*'
    );
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:${provider}', '*');
})();
<\/script><p>Autenticando…</p></body></html>`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth') {
      const siteId = url.searchParams.get('site_id') || '';
      if (!ALLOWED_SITES.includes(siteId)) {
        return html('<p>Sitio no autorizado.</p>', 403);
      }
      const state = crypto.randomUUID();
      const ghUrl = new URL('https://github.com/login/oauth/authorize');
      ghUrl.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
      ghUrl.searchParams.set('scope', 'repo,user');
      ghUrl.searchParams.set('state', state);
      return new Response(null, {
        status: 302,
        headers: {
          Location: ghUrl.href,
          'Set-Cookie': `csrf=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
        },
      });
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookie = (request.headers.get('Cookie') || '').match(/csrf=([\w-]+)/);
      if (!code || !state || !cookie || cookie[1] !== state) {
        return callbackPage('github', { error: 'Solicitud inválida (CSRF)' }, false);
      }
      const resp = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code,
        }),
      });
      const data = await resp.json();
      if (data.error || !data.access_token) {
        return callbackPage('github', { error: data.error_description || 'Sin token' }, false);
      }
      return callbackPage('github', { provider: 'github', token: data.access_token }, true);
    }

    return html('<p>Servicio de autenticación del CMS de Labateca Turismo.</p>');
  },
};
