// Voz de ElevenLabs para Ninanz Sidekick. Devuelve audio MP3.
// Variables de entorno en Vercel:
//   ELEVENLABS_API_KEY   tu clave de ElevenLabs (obligatoria)
//   ELEVENLABS_VOICE_ID  id de la voz (opcional; por defecto una voz masculina multilingüe)
//   ELEVENLABS_MODEL     modelo (opcional; por defecto eleven_flash_v2_5, el más rápido)
//   NINANCE_CODE         el mismo código de acceso que usa /api/chat
module.exports = async function handler(req, res) {
  const limpio = v => (typeof v === 'string' ? v.trim() : '');
  const key = limpio(process.env.ELEVENLABS_API_KEY);
  if (req.method === 'GET') return res.status(200).json({ listo: !!key });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
  if (!key) return res.status(500).json({ error: 'Falta ELEVENLABS_API_KEY en Vercel.' });
  const code = limpio(process.env.NINANCE_CODE);
  if (code && req.headers['x-ninance-code'] !== code) return res.status(401).json({ error: 'Código incorrecto' });
  const text = limpio((req.body || {}).text).slice(0, 700);
  if (!text) return res.status(400).json({ error: 'Sin texto' });
  const voice = limpio(process.env.ELEVENLABS_VOICE_ID) || 'pNInz6obpgDQGcFmaJgB';
  const model = limpio(process.env.ELEVENLABS_MODEL) || 'eleven_flash_v2_5';
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voice) + '?output_format=mp3_44100_64', {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!r.ok) {
      const msg = r.status === 401 ? 'La clave de ElevenLabs no es válida.' : r.status === 402 || r.status === 429 ? 'Sin créditos o límite de ElevenLabs.' : 'ElevenLabs no respondió bien.';
      return res.status(502).json({ error: msg });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).json({ error: 'No se pudo conectar con ElevenLabs.' });
  }
};
