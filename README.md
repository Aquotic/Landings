# Aquotic · Landings de captación

Páginas sencillas (HTML estático) para campañas de redes sociales con ManyChat.
Se publican en Vercel automáticamente cada vez que se sube un cambio a GitHub.

| Ruta | Qué es |
|---|---|
| `/crucero-gay` | Crucero gay MSC Seaview, 21–28 marzo 2027 |
| `/ochentero` | Tarifas El Barco Ochentero Canarias 2027 (+ PDF) |
| `/privacidad` | Política de privacidad de los formularios |

## Cómo crear una landing nueva
1. Duplica la carpeta `crucero-gay` con otro nombre (será la dirección, p. ej. `/canarias-2027`).
2. En `index.html`, cambia los textos y el bloque `CONFIG` (sobre todo `campania`).
3. Sube el cambio a GitHub. Vercel la publica sola en 1 minuto.

## Dónde van los datos
Supabase, proyecto **AQUOTIC IA**, tabla `leads`. La columna `campania` dice de qué landing viene cada contacto.
