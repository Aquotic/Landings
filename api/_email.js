// Emails automáticos a clientes, enviados con Resend (https://resend.com) desde hola@aquotic.com.
// Las respuestas del cliente van a REPLY_TO (Susana) y ella recibe copia oculta de las confirmaciones.

const DESDE = process.env.EMAIL_FROM || "Aquotic <hola@aquotic.com>";
const RESPONDER = process.env.EMAIL_REPLY_TO || "susana@aquotic.com";
const SITIO = "https://ia.aquotic.com";
const WHATSAPP = "34711518584";

export async function enviarEmail({ para, asunto, html, texto, copia }) {
  if (!process.env.RESEND_API_KEY) throw new Error("Falta RESEND_API_KEY");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: "Bearer " + process.env.RESEND_API_KEY.trim(), "content-type": "application/json" },
    body: JSON.stringify({ from: DESDE, to: [para], reply_to: RESPONDER, bcc: copia ? [RESPONDER] : undefined, subject: asunto, html, text: texto }),
    signal: AbortSignal.timeout(10000)
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Resend " + r.status + ": " + (j.message || JSON.stringify(j)).slice(0, 200));
  return j.id;
}

/* ---------- utilidades ---------- */
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const eur = n => Math.round(n).toLocaleString("es-ES", { useGrouping: "always" }) + " €";
const fecha = d => d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" });

// Calendario de pagos: 30 % del total un mes después de reservar; el resto, 65 días antes de la salida
export function calendario(r, salidaISO, diasUltimo) {
  const salida = new Date(salidaISO + "T12:00:00Z");
  const limite = new Date(salida); limite.setUTCDate(limite.getUTCDate() - diasUltimo);
  const base = r.pagada_at ? new Date(r.pagada_at) : new Date();
  const filas = [{ cuando: "Pagado al reservar", importe: r.a_pagar_hoy, hecho: true }];
  const resto = r.total - r.a_pagar_hoy;
  if (resto > 0) {
    const mes = new Date(base); mes.setMonth(mes.getMonth() + 1);
    const p30 = Math.round(r.total * 0.3);
    if (mes < limite) {
      filas.push({ cuando: fecha(mes) + " · 30 %", importe: p30 });
      filas.push({ cuando: fecha(limite) + " · resto", importe: resto - p30 });
    } else filas.push({ cuando: fecha(limite) + " · resto", importe: resto });
  }
  return filas;
}

/* ---------- plantilla común (tablas e estilos en línea: así se ve bien en Gmail, Outlook y Apple Mail) ---------- */
function plantilla({ preheader, foto, titulo, intro, cuerpo, boton }) {
  const F = "Figtree,'Helvetica Neue',Helvetica,Arial,sans-serif";
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f6f4f4;font-family:${F};color:#1d1a1c">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f4"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
  <tr><td style="padding:0 4px 14px;font-size:24px;font-weight:800;letter-spacing:-.5px;color:#f0394e">Aquotic</td></tr>
  <tr><td style="background:#ffffff;border-radius:18px;overflow:hidden">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${foto ? `<tr><td><img src="${foto}" width="600" alt="" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-radius:18px 18px 0 0"></td></tr>
      <tr><td style="height:5px;line-height:5px;font-size:0;background:#e40303;background-image:linear-gradient(90deg,#e40303,#ff8c00,#ffed00,#008026,#24408e,#732982)">&nbsp;</td></tr>` : ""}
      <tr><td style="padding:28px 28px 8px">
        <h1 style="margin:0;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-.5px;color:#1d1a1c">${titulo}</h1>
        <p style="margin:10px 0 0;font-size:16px;line-height:1.55;color:#4a4346">${intro}</p>
      </td></tr>
      ${cuerpo}
      ${boton ? `<tr><td style="padding:8px 28px 28px"><a href="${boton.href}" style="display:block;background:#f0394e;color:#ffffff;text-decoration:none;font-weight:700;font-size:17px;text-align:center;padding:15px 20px;border-radius:999px">${esc(boton.texto)}</a></td></tr>` : ""}
    </table>
  </td></tr>
  <tr><td style="padding:18px 8px;font-size:13px;line-height:1.6;color:#6f686b;text-align:center">
    ¿Dudas? Responde a este email o escríbenos por <a href="https://wa.me/${WHATSAPP}" style="color:#d42a3e">WhatsApp al 711 518 584</a>.<br>
    Aquotic · 17 años especialistas en cruceros · <a href="https://aquotic.com" style="color:#6f686b">aquotic.com</a>
  </td></tr>
</table></td></tr></table></body></html>`;
}

const bloque = (titulo, html) => `<tr><td style="padding:16px 28px 4px">
  <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#6f686b">${titulo}</p>${html}</td></tr>`;

const fila = (izq, der, opts = {}) => `<tr>
  <td style="padding:9px 0;border-top:1px solid #e9e4e5;font-size:15px;color:${opts.ok ? "#1f7a55" : "#4a4346"}">${opts.ok ? "✓ " : ""}${izq}</td>
  <td align="right" style="padding:9px 0;border-top:1px solid #e9e4e5;font-size:15px;font-weight:700;color:#1d1a1c;white-space:nowrap">${der}</td></tr>`;

/* ---------- Crucero gay: reserva confirmada ---------- */
const CAM = { interior: "Interior", balcon: "Balcón" };
const MOD = { solo: "individual", amigo: "doble", buscar: "compartido (te buscamos compañero)" };

export function emailReservaConfirmada(r) {
  const ref = "R-" + String(r.id).slice(0, 6).toUpperCase();
  const nombre = esc(r.nombre || "");
  const viajeros = (r.viajeros || []).map(v => esc(`${v.nombre} ${v.apellidos}`)).join("<br>");
  const pagos = calendario(r, "2027-03-21", 65);
  const msgWa = encodeURIComponent(`Hola, soy ${r.nombre || ""} 🌈 Tengo reservado el crucero gay del MSC Seaview. Referencia ${ref}.`);

  const cuerpo =
    bloque("Tu crucero", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f4f4;border-radius:14px"><tr><td style="padding:16px 18px">
      <p style="margin:0;font-size:20px;font-weight:800;color:#1d1a1c">Lisboa → Barcelona</p>
      <p style="margin:4px 0 0;font-size:15px;color:#4a4346">MSC Seaview · del 21 al 28 de marzo de 2027 · 7 noches<br>Escalas en Casablanca, Málaga y Palma</p>
    </td></tr></table>`) +
    bloque("Tu reserva", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${fila("Referencia", ref)}
      ${fila("Camarote", CAM[r.camarote] + " " + MOD[r.modalidad])}
      ${fila("Viajeros", viajeros)}
      ${fila("Total del crucero", eur(r.total))}
    </table>
    <p style="margin:8px 0 0;font-size:13.5px;line-height:1.5;color:#6f686b">Incluye tasas, propinas, paquete de bebidas Pack Easy y actividades con el grupo. Excursiones y seguro, aparte.</p>`) +
    bloque("Tus pagos", `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${pagos.map(p => fila(esc(p.cuando), eur(p.importe), { ok: p.hecho })).join("")}
    </table>
    <p style="margin:8px 0 0;font-size:13.5px;line-height:1.5;color:#6f686b">Unos días antes de cada pago te enviamos un email con el importe y el enlace para pagar. El depósito de reserva no es reembolsable.</p>`) +
    bloque("Y ahora", `<p style="margin:0;font-size:15px;line-height:1.7;color:#4a4346">
      1. Confirmamos tu camarote con MSC y te enviamos el número de reserva de la naviera.<br>
      2. Más adelante te pedimos el DNI o pasaporte de cada viajero. Para Casablanca hace falta pasaporte.<br>
      3. Antes de salir te mandamos toda la información del viaje y del grupo.</p>`);

  const html = plantilla({
    preheader: `Reserva ${ref} confirmada: MSC Seaview, 21-28 de marzo de 2027.`,
    foto: SITIO + "/crucero-gay/img/piscina-panoramica.jpg",
    titulo: `¡Nos vamos de crucero${nombre ? ", " + nombre : ""}!`,
    intro: `Hemos recibido tu pago de <b>${eur(r.a_pagar_hoy)}</b> y tu plaza en el crucero gay del MSC Seaview está reservada. Guarda este email: aquí tienes todo lo importante.`,
    cuerpo,
    boton: { texto: "Escríbenos por WhatsApp", href: `https://wa.me/${WHATSAPP}?text=${msgWa}` }
  });

  const texto = [
    `¡Nos vamos de crucero${r.nombre ? ", " + r.nombre : ""}!`,
    `Hemos recibido tu pago de ${eur(r.a_pagar_hoy)} y tu plaza está reservada.`,
    ``,
    `Crucero gay MSC Seaview · Lisboa → Barcelona · 21-28 marzo 2027 (7 noches)`,
    `Referencia: ${ref}`,
    `Camarote: ${CAM[r.camarote]} ${MOD[r.modalidad]}`,
    `Total del crucero: ${eur(r.total)}`,
    ``,
    `Tus pagos:`,
    ...pagos.map(p => `- ${p.cuando}: ${eur(p.importe)}${p.hecho ? " (pagado)" : ""}`),
    ``,
    `¿Dudas? Responde a este email o escríbenos por WhatsApp al 711 518 584.`,
    `Aquotic · aquotic.com`
  ].join("\n");

  return { asunto: `Reserva confirmada ${ref} · Crucero gay MSC Seaview 🌈`, html, texto };
}
