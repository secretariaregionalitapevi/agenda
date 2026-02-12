export const runtime = "nodejs";

export async function POST(req: Request) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const adminKey = process.env.ADMIN_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!scriptUrl) {
    return new Response(JSON.stringify({ ok:false, error:"APPS_SCRIPT_URL não configurada." }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }
  if (!adminKey) {
    return new Response(JSON.stringify({ ok:false, error:"ADMIN_KEY não configurada." }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  // Senha simples para liberar o admin (fica só no servidor)
  if (!adminPassword) {
    return new Response(JSON.stringify({ ok:false, error:"ADMIN_PASSWORD não configurada." }), {
      status: 500,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  const body = await req.json().catch(() => ({}));

  // o front envia { password }, mas a chave real do Apps Script nunca vai pro navegador
  if (!body || body.password !== adminPassword) {
    return new Response(JSON.stringify({ ok:false, error:"Senha inválida." }), {
      status: 401,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  // remove a senha antes de repassar
  const { password, ...rest } = body;
  const payload = { ...rest, key: adminKey };

  const upstream = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const text = await upstream.text();
  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
