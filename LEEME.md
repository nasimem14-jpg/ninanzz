# Ninanz en Vercel

1. Sube esta carpeta a Vercel (vercel.com/new o `vercel` desde la carpeta).
2. En el proyecto: Settings → Environment Variables, añade (marcando Production, Preview y Development):
   - OPENAI_API_KEY: tu clave de platform.openai.com (o ANTHROPIC_API_KEY si prefieres Claude)
   - NINANCE_CODE: un código que inventes tú (la app lo pide una vez en cada dispositivo)
3. Deployments → los tres puntos del último despliegue → Redeploy, para que las variables se apliquen.
4. Abre la web en el móvil y añádela a la pantalla de inicio.

Tus datos se guardan en el propio dispositivo. La IA gasta saldo de tu cuenta de la API.
