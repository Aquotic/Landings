// Stripe avisa aquí cuando un pago se completa. Comprobamos la firma, marcamos la reserva como pagada
// en Supabase y ponemos la etiqueta en Clientify (sin datos de documentos).
import crypto from "node:crypto";
import { rpc } from "./_supabase.js";
import { marcarReserva } from "./_clientify.js";

export const config = { api: { bodyParser: false } };

async function cuerpoCrudo(req) {
  const trozos = [];
  for await (const t of req) trozos.push(typeof t === "string" ? Buffer.from(t) : t);
  return Buffer.concat(trozos).toString("utf8");
}

function firmaValida(crudo, cabecera, secreto) {
  const partes = Object.fromEntries(String(cabecera || "").split(",").map(x => x.split("=")).filter(x => x.length === 2).map(([k, v]) => [k.trim(), v]));
  const v1s = String(cabecera || "").split(",").filter(x => x.startsWith("v1=")).map(x => x.slice(3));
  const t = Number(partes.t);
  if (!t || !v1s.length || Math.abs(Date.now() / 1000 - t) > 600) return false;
  const esperado = crypto.createHmac("sha256", secreto).update(`${t}.${crudo}`).digest("hex");
  return v1s.some(v => v.length === esperado.length && crypto.timingSafeEqual(Buffer.from(v), Buffer.from(esperado)));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const secreto = process.env.STRIPE_WEBHOOK_SECRET, clave = process.env.RESERVAS_SECRET;
  if (!secreto || !clave) return res.status(503).json({ error: "Webhook no configurado" });
  const crudo = await cuerpoCrudo(req);
  if (!firmaValida(crudo, req.headers["stripe-signature"], secreto.trim())) return res.status(400).json({ error: "Firma no válida" });

  let ev; try { ev = JSON.parse(crudo); } catch { return res.status(400).end(); }
  const tipos = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!tipos.includes(ev.type)) return res.status(200).json({ ignorado: ev.type });
  const s = ev.data && ev.data.object;
  if (!s || s.payment_status !== "paid") return res.status(200).json({ pendiente: true });
  const id = (s.metadata && s.metadata.reserva_id) || s.client_reference_id;
  if (!id) return res.status(200).json({ sin_reserva: true });

  let r;
  try {
    r = await rpc("reserva_confirmar_pago", { p_clave: clave.trim(), p_id: id, p_session: s.id, p_payment_intent: s.payment_intent || null, p_importe_cent: s.amount_total || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "No se pudo guardar el pago" }); // Stripe lo reintentará
  }
  if (!r) return res.status(200).json({ sin_reserva: true });

  // Clientify: si falla, el pago ya está guardado; se apunta el error para revisarlo
  let estado = "sin_clave";
  if (process.env.CLIENTIFY_API_KEY) {
    try { const c = await marcarReserva(r); estado = c.errores.length ? "error: " + c.errores.join(", ") : "enviado " + c.id; }
    catch (e) { estado = "error: " + String(e && e.message || e).slice(0, 250); }
  }
  await rpc("reserva_marcar_clientify", { p_clave: clave.trim(), p_id: id, p_estado: estado }).catch(() => { });
  return res.status(200).json({ ok: true });
}
