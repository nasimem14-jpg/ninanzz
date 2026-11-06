// Función de Vercel que llama a la IA sin exponer tu clave en el navegador.
// Funciona con OpenAI o con Anthropic: usa la que tenga clave configurada.
// Variables de entorno (Vercel → Settings → Environment Variables):
//   OPENAI_API_KEY      clave de OpenAI (modelo por defecto gpt-4o-mini, cámbialo con OPENAI_MODEL)
//   ANTHROPIC_API_KEY   clave de Anthropic (modelo por defecto claude-sonnet-5-5, cámbialo con ANTHROPIC_MODEL)
//   NINANCE_CODE        recomendada: código que la app pide una vez para que nadie más gaste tu saldo
// Si pones las dos claves, se usa OpenAI.
module.exports = async function handler(req, res) {
  const limpio = v => (typeof v === 'string' ? v.trim() : '');
  // Abrir /api/chat en el navegador muestra qué variables ve el servidor (solo sí/no, nunca las claves).
  if (req.method === 'GET') {
    return res.status(200).json({
      funcion: 'ok',
      OPENAI_API_KEY: !!limpio(process.env.OPENAI_API_KEY),
      ANTHROPIC_API_KEY: !!limpio(process.env.ANTHROPIC_API_KEY),
      NINANCE_CODE: !!limpio(process.env.NINANCE_CODE),
    });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const openaiKey = limpio(process.env.OPENAI_API_KEY);
  const anthropicKey = limpio(process.env.ANTHROPIC_API_KEY);
  if (!openaiKey && !anthropicKey) {
    return res.status(500).json({ error: 'Falta OPENAI_API_KEY (o ANTHROPIC_API_KEY) en las variables de Vercel.' });
  }

  const code = limpio(process.env.NINANCE_CODE);
  if (code && req.headers['x-ninance-code'] !== code) return res.status(401).json({ error: 'Código incorrecto' });

  const body = req.body || {};
  const system = typeof body.system === 'string' ? body.system.slice(0, 20000) : '';
  const msgs = Array.isArray(body.messages) ? body.messages : [];
  const clean = msgs
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
  while (clean.length && clean[0].role !== 'user') clean.shift();
  if (!clean.length || clean[clean.length - 1].role !== 'user') return res.status(400).json({ error: 'Mensaje no válido' });

  try {
    if (openaiKey) {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + openaiKey, 'content-type': 'application/json' },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          max_completion_tokens: 1000,
          messages: [{ role: 'system', content: system }].concat(clean),
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 429) return res.status(429).json({ error: 'Límite de uso o saldo agotado en OpenAI.' });
        if (r.status === 401 || r.status === 403) return res.status(500).json({ error: 'La clave de OpenAI no es válida.' });
        return res.status(502).json({ error: 'OpenAI no respondió bien' + (j.error && j.error.message ? ': ' + j.error.message : '.') });
      }
      const ch = (j.choices || [])[0] || {};
      return res.status(200).json({ text: (ch.message && ch.message.content) || '', truncated: ch.finish_reason === 'length' });
    }

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 1000,
        system,
        messages: clean,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 429) return res.status(429).json({ error: 'Límite de uso alcanzado. Prueba más tarde.' });
      if (r.status === 401 || r.status === 403) return res.status(500).json({ error: 'La clave de Anthropic no es válida.' });
      return res.status(502).json({ error: 'Anthropic no respondió bien.' });
    }
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return res.status(200).json({ text, truncated: j.stop_reason === 'max_tokens' });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo conectar con la IA.' });
  }
};
