// Función de Vercel que llama a la IA sin exponer tu clave en el navegador.
// Funciona con OpenAI o con Anthropic: usa la que tenga clave configurada.
// La IA puede buscar en internet (búsqueda web) para datos actuales.
// Variables de entorno (Vercel → Settings → Environment Variables):
//   OPENAI_API_KEY      clave de OpenAI (modelo por defecto gpt-4o-mini, cámbialo con OPENAI_MODEL)
//   ANTHROPIC_API_KEY   clave de Anthropic (modelo por defecto claude-sonnet-5-5, cámbialo con ANTHROPIC_MODEL)
//   NINANCE_CODE        recomendada: código que la app pide una vez para que nadie más gaste tu saldo
//   WEB_SEARCH          pon 0 para desactivar la búsqueda en internet
// Si pones las dos claves, se usa OpenAI.
module.exports = async function handler(req, res) {
  const limpio = v => (typeof v === 'string' ? v.trim() : '');
  if (req.method === 'GET') {
    return res.status(200).json({
      funcion: 'ok',
      OPENAI_API_KEY: !!limpio(process.env.OPENAI_API_KEY),
      ANTHROPIC_API_KEY: !!limpio(process.env.ANTHROPIC_API_KEY),
      NINANCE_CODE: !!limpio(process.env.NINANCE_CODE),
      busqueda_web: limpio(process.env.WEB_SEARCH) !== '0',
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

  // Modo voz: respuestas cortas y rápidas (modelo ligero, sin búsqueda salvo que se pida).
  const rapido = body.voz === true && body.web !== true;
  const web = limpio(process.env.WEB_SEARCH) !== '0' && !rapido;
  const fuentesDe = lista => {
    const vistas = new Set(), out = [];
    for (const f of lista) {
      if (!f || !f.url || vistas.has(f.url)) continue;
      vistas.add(f.url);
      let host = '';
      try { host = new URL(f.url).hostname.replace(/^www\./, ''); } catch (e) {}
      out.push({ t: (f.title || host || f.url).slice(0, 90), u: f.url, h: host });
      if (out.length >= 5) break;
    }
    return out;
  };

  try {
    if (openaiKey) {
      const model = (rapido && process.env.OPENAI_FAST_MODEL) || process.env.OPENAI_MODEL || 'gpt-4o-mini';
      const headers = { Authorization: 'Bearer ' + openaiKey, 'content-type': 'application/json' };
      let r, j;
      if (web) {
        // Responses API con búsqueda web
        r = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST', headers,
          body: JSON.stringify({
            model, instructions: system, input: clean,
            tools: [{ type: 'web_search' }], max_output_tokens: 1500,
          }),
        });
        j = await r.json().catch(() => ({}));
        if (r.ok) {
          let text = '', cites = [];
          for (const it of j.output || []) {
            if (it.type !== 'message') continue;
            for (const c of it.content || []) {
              if (c.type === 'output_text') {
                text += c.text || '';
                for (const a of c.annotations || []) if (a.type === 'url_citation') cites.push(a);
              }
            }
          }
          return res.status(200).json({
            text, truncated: !!(j.incomplete_details && j.incomplete_details.reason === 'max_output_tokens'),
            fuentes: fuentesDe(cites),
          });
        }
        if (r.status === 429) return res.status(429).json({ error: 'Límite de uso o saldo agotado en OpenAI.' });
        if (r.status === 401 || r.status === 403) return res.status(500).json({ error: 'La clave de OpenAI no es válida.' });
        // Otro error (p. ej. el modelo no admite búsqueda): seguimos sin búsqueda.
      }
      r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST', headers,
        body: JSON.stringify({
          model, max_completion_tokens: rapido ? 350 : 1000,
          messages: [{ role: 'system', content: system }].concat(clean),
        }),
      });
      j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 429) return res.status(429).json({ error: 'Límite de uso o saldo agotado en OpenAI.' });
        if (r.status === 401 || r.status === 403) return res.status(500).json({ error: 'La clave de OpenAI no es válida.' });
        return res.status(502).json({ error: 'OpenAI no respondió bien' + (j.error && j.error.message ? ': ' + j.error.message : '.') });
      }
      const ch = (j.choices || [])[0] || {};
      return res.status(200).json({ text: (ch.message && ch.message.content) || '', truncated: ch.finish_reason === 'length', fuentes: [] });
    }

    const modeloPrincipal = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
    let model = rapido ? (process.env.ANTHROPIC_FAST_MODEL || 'claude-haiku-5-5') : modeloPrincipal;
    const headers = { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
    const pedir = conBusqueda => fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers,
      body: JSON.stringify(Object.assign({ model, max_tokens: rapido ? 350 : conBusqueda ? 1500 : 1000, system, messages: clean },
        conBusqueda ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] } : {})),
    });
    let r = await pedir(web);
    if (!r.ok && web && r.status === 400) r = await pedir(false);
    if (!r.ok && rapido && model !== modeloPrincipal && (r.status === 400 || r.status === 404)) { model = modeloPrincipal; r = await pedir(false); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 429) return res.status(429).json({ error: 'Límite de uso alcanzado. Prueba más tarde.' });
      if (r.status === 401 || r.status === 403) return res.status(500).json({ error: 'La clave de Anthropic no es válida.' });
      return res.status(502).json({ error: 'Anthropic no respondió bien.' });
    }
    let text = '', cites = [];
    for (const b of j.content || []) {
      if (b.type === 'text') { text += b.text || ''; for (const c of b.citations || []) cites.push(c); }
    }
    return res.status(200).json({ text, truncated: j.stop_reason === 'max_tokens', fuentes: fuentesDe(cites) });
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo conectar con la IA.' });
  }
};
