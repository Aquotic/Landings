// Envío de los leads de las landings a Clientify (API v2), con el mismo sistema que el buscador:
// crea o actualiza el contacto (por email y, si no, por teléfono), rellena los campos aq_* y
// pone las etiquetas que disparan las automatizaciones de Clientify.

const BASE = "https://api-plus.clientify.com/v2";

// Cómo se describe cada campaña en Clientify. Para una landing nueva, añade aquí su "campania".
export const CAMPANIAS = {
  "seaview-gay-2027": {
    crucero: "Crucero gay · MSC Seaview · 21/03/2027 · 7 noches · Lisboa a Barcelona",
    origen: "landing-crucero-gay",
    fuente: "Landing crucero gay",
    etiqueta: "landing-seaview-gay-2027"
  }
};

const ACOMPANANTE = {
  solo: { texto: "Viaja solo (camarote individual)", etiqueta: "viaja-solo" },
  amigo: { texto: "Viaja con un amigo o su pareja", etiqueta: "viaja-acompanado" },
  buscar: { texto: "Quiere que le busquemos compañero de camarote", etiqueta: "busca-companero" }
};

async function cfy(ruta, metodo, cuerpo) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: { "content-type": "application/json", authorization: "Token " + process.env.CLIENTIFY_API_KEY.trim() },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    signal: AbortSignal.timeout(8000)
  });
  const txt = await r.text();
  let j = null; try { j = txt ? JSON.parse(txt) : null; } catch { }
  if (!r.ok) throw new Error(metodo + " " + ruta.split("?")[0] + " → " + r.status + " " + txt.slice(0, 180));
  return j;
}

const primero = l => l && l.results && l.results[0] && l.results[0].id;

// paso: 1 WhatsApp · 2 nombre · 3 con quién viaja · 4 email (o lo salta) = formulario completo
export async function enviarLead(lead) {
  const camp = CAMPANIAS[lead.campania] || { crucero: lead.campania, origen: "landing", fuente: "Landing", etiqueta: "landing-" + lead.campania };
  let id = lead.clientify_id || null;

  // 1) Buscar el contacto si aún no lo tenemos enlazado
  if (!id && lead.email) id = primero(await cfy("/contacts/?query=" + encodeURIComponent(lead.email) + "&page_size=1&fields=id", "GET"));
  if (!id && lead.whatsapp) id = primero(await cfy("/contacts/?phone=" + encodeURIComponent(lead.whatsapp) + "&page_size=1&fields=id", "GET"));

  // 2) Crear o completar
  if (!id) {
    const datos = { contact_source: camp.fuente, gdpr_accept: !!lead.consentimiento };
    if (lead.nombre) datos.first_name = lead.nombre;
    if (lead.email) datos.emails = [{ email: lead.email }];
    if (lead.whatsapp) datos.phones = [{ phone: lead.whatsapp, whatsapp: true }];
    const c = await cfy("/contacts/", "POST", datos);
    id = c && c.id;
    if (!id) throw new Error("Clientify no devolvió el id del contacto");
  } else {
    const cambios = {};
    if (lead.nombre) cambios.first_name = lead.nombre;
    if (Object.keys(cambios).length) await cfy("/contacts/" + id + "/", "PATCH", cambios);
    if (lead.whatsapp) {
      try {
        const c = await cfy("/contacts/" + id + "/?fields=id,phones", "GET");
        const tiene = (c && c.phones || []).some(p => String(p.phone || "").replace(/\D/g, "").endsWith(lead.whatsapp.replace(/\D/g, "").slice(-9)));
        if (!tiene) await cfy("/contacts/" + id + "/phones/", "POST", { phone: lead.whatsapp, whatsapp: true });
      } catch { /* si falla el teléfono, el resto sigue */ }
    }
  }

  // 3) Campos aq_* (uno a uno; si ya existe, se actualiza)
  const acomp = ACOMPANANTE[lead.compania];
  const valores = {
    aq_origen: camp.origen + (lead.utm_source ? " · " + lead.utm_source : "") + (lead.instagram ? " · @" + lead.instagram : ""),
    aq_crucero: camp.crucero,
    aq_acompanante: acomp && acomp.texto,
    aq_ultima_accion: lead.paso >= 4 ? "landing-formulario-completo" : "landing-paso-" + lead.paso,
    aq_consentimiento_comercial: lead.consentimiento ? "sí" : "no"
  };
  const errores = [], previos = {};
  try {
    const l = await cfy("/contacts/" + id + "/customfields/?page_size=100", "GET");
    for (const v of (l && (l.results || l)) || []) if (v && v.field && v.id) previos[v.field] = v.id;
  } catch { }
  for (const [field, value] of Object.entries(valores)) {
    if (value == null || value === "") continue;
    try {
      if (previos[field]) await cfy("/contacts/" + id + "/customfields/" + previos[field] + "/", "PATCH", { value: String(value) });
      else await cfy("/contacts/" + id + "/customfields/", "POST", { field, value: String(value) });
    } catch { errores.push(field); }
  }

  // 4) Etiquetas al final (son las que arrancan las automatizaciones, con los campos ya rellenos)
  const tags = [camp.etiqueta];
  if (acomp) tags.push(acomp.etiqueta);
  if (lead.whatsapp) tags.push("whatsapp-ok");
  if (lead.paso >= 4) tags.push(camp.etiqueta + "-completo");
  if (lead.utm_source === "prueba") tags.push("prueba-web");
  for (const name of tags) { try { await cfy("/contacts/" + id + "/tags/", "POST", { name }); } catch { errores.push("tag:" + name); } }

  return { id: String(id), errores };
}
