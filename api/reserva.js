// Abre la pasarela de pago de Stripe para una reserva ya guardada en Supabase.
// El importe sale de Supabase (lo calcula la base de datos), nunca del navegador.
import { rpc } from "./_supabase.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORIGENES = ["https://buscadornuevo.vercel.app", "https://crucerosaquotic.vercel.app", "https://landings-ashen.vercel.app",
  "https://www.aquotic.com", "https://aquotic.com"];
const PRODUCTOS = {
  "seaview-gay-2027": { nombre: "Crucero gay MSC Seaview · 21-28 marzo 2027", ruta: "/crucero-gay/reserva" }
};
const CAMAROTE = { interior: "Interior", balcon: "Balcón" };
const MODO = { solo: "individual", amigo: "2 personas", buscar: "1 persona compartiendo" };

export default async function handler(req, res) {
  res.setHeader("cache-control", "no-store");
  // La página puede estar servida desde el dominio del buscador: permitimos esa llamada (CORS)
  if (ORIGENES.includes(req.headers.origin)) {
    res.setHeader("access-control-allow-origin", req.headers.origin);
    res.setHeader("vary", "origin");
    res.setHeader("access-control-allow-methods", "POST, OPTIONS");
    res.setHeader("access-control-allow-headers", "content-type");
  }
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Solo POST" });
  if (!process.env.STRIPE_SECRET_KEY) return res.status(503).json({ error: "Pagos no configurados" });
  let d = req.body;
  if (typeof d === "string") { try { d = JSON.parse(d); } catch { d = {}; } }
  d = d || {};
  if (!UUID.test(d.id || "") || !UUID.test(d.token || "")) return res.status(400).json({ error: "Datos no válidos" });

  let r;
  try { r = await rpc("reserva_para_pago", { p_id: d.id, p_token: d.token }); }
  catch { return res.status(502).json({ error: "No se pudo leer la reserva" }); }
  if (!r) return res.status(404).json({ error: "Reserva no encontrada" });
  if (r.estado !== "pendiente") return res.status(409).json({ error: "Esta reserva ya está " + r.estado });
  const prod = PRODUCTOS[r.campania];
  if (!prod) return res.status(400).json({ error: "Producto no válido" });

  const origen = ORIGENES.includes(req.headers.origin) ? req.headers.origin : ORIGENES[0];
  const todo = r.a_pagar_hoy >= r.total;
  const desc = `${CAMAROTE[r.camarote]} · ${MODO[r.modalidad]} · ${todo ? "pago total" : "depósito de reserva no reembolsable"}`;
  const p = new URLSearchParams({
    mode: "payment",
    locale: "es",
    customer_email: r.email,
    client_reference_id: r.id,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "eur",
    "line_items[0][price_data][unit_amount]": String(Math.round(r.a_pagar_hoy * 100)),
    "line_items[0][price_data][product_data][name]": prod.nombre,
    "line_items[0][price_data][product_data][description]": desc,
    "metadata[reserva_id]": r.id,
    "metadata[campania]": r.campania,
    "payment_intent_data[metadata][reserva_id]": r.id,
    "payment_intent_data[description]": prod.nombre + " · " + desc,
    success_url: `${origen}${prod.ruta}/gracias?id=${r.id}&t=${d.token}`,
    cancel_url: `${origen}${prod.ruta}?cancelado=1`
  });

  try {
    const s = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { authorization: "Bearer " + process.env.STRIPE_SECRET_KEY.trim(), "content-type": "application/x-www-form-urlencoded", "idempotency-key": "reserva-" + r.id + "-" + Math.floor(Date.now() / 6e5) },
      body: p.toString(),
      signal: AbortSignal.timeout(10000)
    });
    const j = await s.json();
    if (!s.ok || !j.url) { console.error("Stripe", s.status, j && j.error && j.error.message); return res.status(502).json({ error: "No se pudo abrir el pago" }); }
    await rpc("reserva_guardar_sesion", { p_id: r.id, p_token: d.token, p_session: j.id }).catch(() => { });
    return res.status(200).json({ url: j.url });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ error: "No se pudo abrir el pago" });
  }
}
