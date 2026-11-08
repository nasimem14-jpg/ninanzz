# Ninanz en Vercel

1. Sube esta carpeta a Vercel (vercel.com/new o `vercel` desde la carpeta).
2. En el proyecto: Settings → Environment Variables, añade (marcando Production, Preview y Development):
   - OPENAI_API_KEY: tu clave de platform.openai.com (o ANTHROPIC_API_KEY si prefieres Claude)
   - NINANCE_CODE: un código que inventes tú (la app lo pide una vez en cada dispositivo)
3. Deployments → los tres puntos del último despliegue → Redeploy, para que las variables se apliquen.
4. Abre la web en el móvil y añádela a la pantalla de inicio.

Tus datos se guardan en el propio dispositivo. La IA gasta saldo de tu cuenta de la API.

## Búsqueda en internet
Ninanz Sidekick puede buscar en internet (OpenAI web_search o la búsqueda web de Anthropic) cuando la pregunta depende de datos actuales. Se activa sola; para desactivarla añade la variable `WEB_SEARCH=0` en Vercel. En el chat muestra las fuentes consultadas. Solo funciona en la web publicada en Vercel, no en la vista previa del artefacto.

## Voz
Di «Oye Jawa» con la app abierta (Chrome/Edge). Se activa sola al abrir la app; el botón del micrófono la apaga.

## Voz de ElevenLabs
Para que Ninanz Sidekick hable con una voz de ElevenLabs, añade en Vercel (Settings → Environment Variables) y vuelve a desplegar:
- `ELEVENLABS_API_KEY`: tu clave de ElevenLabs (obligatoria).
- `ELEVENLABS_VOICE_ID`: el ID de la voz que quieras (opcional). La voz tiene que estar en «My Voices» de tu cuenta.
- `ELEVENLABS_MODEL`: opcional; por defecto `eleven_flash_v2_5` (la más rápida).
Si no hay clave, o falla, usa la voz del navegador.
