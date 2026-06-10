export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    try {
      const body = await request.json();
      const question = body.question || '';
      const lang     = body.lang || 'es';
      const places   = body.places || [];

      // Construir contexto con los lugares del sitio
      const ctx = places.slice(0, 12).map(function(p) {
        const nombre = ((p.nombre || p.name || {})[lang]) || '';
        const desc   = ((p.desc   || {})[lang]) || '';
        const dist   = ((p.dist   || {})[lang]) || '';
        const como   = ((p.comoLlegar || {})[lang]) || '';
        const rec    = ((p.recomendacion || p.rec || {})[lang]) || '';
        if (!nombre) return '';
        var line = '• ' + nombre + ': ' + desc;
        if (dist) line += ' Distancia: ' + dist + '.';
        if (como) line += ' Cómo llegar: ' + como + '.';
        if (rec)  line += ' Tip: ' + rec;
        return line.trim();
      }).filter(Boolean).join('\n');

      const sysES = 'Eres el asistente turístico de Labateca (Volcanes de Dios), Norte de Santander, Colombia. '
        + 'Altitud: 1.566 m.s.n.m., clima templado ~20°C, a ~113 km de Cúcuta (~3.5h en bus). '
        + 'Responde preguntas sobre turismo, cómo llegar, gastronomía y actividades. '
        + 'Sé amable y conciso (máximo 3-4 oraciones). '
        + 'Si no tienes el dato exacto, sugiere contactar la alcaldía o un guía local.\n\n'
        + 'Lugares disponibles:\n' + ctx;

      const sysEN = 'You are the tourism assistant for Labateca (God\'s Volcanoes), Norte de Santander, Colombia. '
        + 'Altitude 1,566 m, mild climate ~20°C, ~113 km from Cúcuta (~3.5h by bus). '
        + 'Answer questions about tourism, directions, food and activities. '
        + 'Be friendly and concise (max 3-4 sentences). '
        + 'If you lack the specific info, suggest contacting the town hall or a local guide.\n\n'
        + 'Available places:\n' + ctx;

      var systemPrompt = (lang === 'es') ? sysES : sysEN;

      var ai_result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: question }
        ],
        max_tokens: 400,
        temperature: 0.7
      });

      var answer = ai_result.response
        || (ai_result.result && ai_result.result.response)
        || ((lang === 'es')
            ? 'No pude generar una respuesta. Intenta de nuevo.'
            : 'Could not generate a response. Please try again.');

      return new Response(JSON.stringify({ ok: true, answer: answer }), {
        headers: Object.assign({}, cors, { 'Content-Type': 'application/json' })
      });

    } catch (err) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 500,
        headers: Object.assign({}, cors, { 'Content-Type': 'application/json' })
      });
    }
  }
};
