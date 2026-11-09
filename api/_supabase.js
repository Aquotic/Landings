// Llamadas a funciones (RPC) de Supabase con la clave pública: solo pueden hacer lo que cada función permite.
const URL_SB = (process.env.SUPABASE_URL || "https://eyuqdogsdwxnijswlads.supabase.co").replace(/\/$/, "");
const KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_sFyMqE-qsR5Pkg2RJidBVA_C9vFtxWX";

export async function rpc(nombre, cuerpo) {
  const r = await fetch(URL_SB + "/rest/v1/rpc/" + nombre, {
    method: "POST",
    headers: { "content-type": "application/json", apikey: KEY, authorization: "Bearer " + KEY },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(8000)
  });
  const txt = await r.text();
  if (!r.ok) throw new Error("Supabase " + nombre + " " + r.status + ": " + txt.slice(0, 200));
  return txt ? JSON.parse(txt) : null;
}
