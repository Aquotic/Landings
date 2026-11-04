// La landing avisa aquí cada vez que el visitante completa un paso del formulario.
// El servidor lee ese lead de Supabase (solo con su token secreto) y lo envía a Clientify.
// Así la clave de Clientify nunca sale del servidor.
import { enviarLead } from "./_clientify.js";

const SUPABASE_URL = (process.env.SUPABASE_URL || "https://eyuqdogsdwxnijswlads.supabase.co").replace(/\/$/, "");
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_sFyMqE-qsR5Pkg2RJidBVA_C9vFtxWX";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function rpc(nombre, cuerpo) {
  const r = await fetch(SUPABASE_URL + "/rest/v1/rpc/" + nombre, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: SUPABASE_KEY, authorization: "Bearer " + SUPABASE_KEY },
    body: JSON.stringify(cuerpo)
  });
  if (!r.ok) throw new Error("Supabase " + r.status + ": " + (await r.text()).slice(0, 200));
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });
  let d = req.body;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};
  if (!UUID.test(d.id || "") || !UUID.test(d.token || "")) return res.status(400).json({ error: "Datos no válidos" });

  let lead;
  try { lead = await rpc("lead_para_sync", { p_id: d.id, p_token: d.token }); }
  catch (e) { return res.status(502).json({ error: "No se pudo leer el lead" }); }
  if (!lead) return res.status(404).json({ error: "Lead no encontrado" });

  const marcar = (estado, contacto, error) =>
    rpc("lead_marcar_clientify", { p_id: d.id, p_token: d.token, p_estado: estado, p_contacto: contacto || null, p_error: error || null }).catch(() => { });

  if (!process.env.CLIENTIFY_API_KEY) { await marcar("sin_clave", null, null); return res.status(200).json({ ok: true, clientify: "sin_clave" }); }
  try {
    const r = await enviarLead(lead);
    await marcar(r.errores.length ? "error" : "enviado", r.id, r.errores.length ? "No se pudieron guardar: " + r.errores.join(", ") : null);
    return res.status(200).json({ ok: true });
  } catch (e) {
    await marcar("error", null, String(e && e.message || e).slice(0, 480));
    return res.status(200).json({ ok: false });
  }
}
