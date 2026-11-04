# Aquotic · Landings de captación

Páginas sencillas (HTML estático) para campañas de redes sociales con ManyChat.
Se publican en Vercel automáticamente cada vez que se sube un cambio a GitHub.

| Ruta | Qué es |
|---|---|
| `/crucero-gay` | Crucero gay MSC Seaview, 21–28 marzo 2027 |
| `/ochentero` | Tarifas El Barco Ochentero Canarias 2027 (+ PDF) |
| `/privacidad` | Política de privacidad de los formularios |
| `/api/lead` | Pasa cada lead a Clientify (campos `aq_*` + etiquetas), igual que el buscador |

## Cómo crear una landing nueva
1. Duplica la carpeta `crucero-gay` con otro nombre (será la dirección, p. ej. `/canarias-2027`).
2. En `index.html`, cambia los textos y el bloque `CONFIG` (sobre todo `campania`).
3. Sube el cambio a GitHub. Vercel la publica sola en 1 minuto.

## Dónde van los datos
Supabase, proyecto **AQUOTIC IA**, tabla `leads`. La columna `campania` dice de qué landing viene cada contacto.

## Clientify
Cada paso del formulario se guarda en Supabase (tabla `leads`) y el servidor lo pasa a Clientify (`api/_clientify.js`):
- Campos: `aq_origen`, `aq_crucero`, `aq_acompanante`, `aq_ultima_accion`, `aq_consentimiento_comercial`.
- Etiquetas: `landing-<campaña>` al dejar el email; `viaja-solo` / `viaja-acompanado` / `busca-companero`; `whatsapp-ok`; y `landing-<campaña>-completo` al terminar (la que arranca la automatización).
- Variable en Vercel (Settings → Environment Variables): `CLIENTIFY_API_KEY`, la misma que usa el buscador.
- Si Clientify falla, el lead queda en Supabase con `clientify_estado = 'error'` y el motivo en `clientify_error`.
- Para una campaña nueva, añádela en `CAMPANIAS` dentro de `api/_clientify.js`.
- Para probar sin ensuciar: abre la landing con `?utm_source=prueba` y el contacto lleva la etiqueta `prueba-web`.
