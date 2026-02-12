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

export async function POST(req) {
  const body = await req.json();

  if (!process.env.ADMIN_PASSWORD) {
    return Response.json({ ok: false, error: "ADMIN_PASSWORD não configurada." }, { status: 500 });
  }
  if (body.password !== process.env.ADMIN_PASSWORD) {
    return Response.json({ ok: false, error: "Senha inválida." }, { status: 401 });
  }

  const appsUrl = process.env.APPS_SCRIPT_URL;
  const key = process.env.ADMIN_KEY;

  if (!appsUrl || !key) {
    return Response.json({ ok: false, error: "APPS_SCRIPT_URL/ADMIN_KEY não configuradas." }, { status: 500 });
  }

  const payload = {
    key,
    action: body.action,      // create|update|delete
    row: body.row,            // update/delete
    data: body.data,
    hora: body.hora,
    evento: body.evento,
    destaque: body.destaque,  // "Sim" ou ""
    departamento: body.departamento // "Música"/"Ministério" ou "musica"/"ministerio"
  };

  const r = await fetch(appsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const j = await r.json().catch(() => ({}));
  return Response.json(j, { status: r.ok ? 200 : 400 });
}


function getPwd() {
  let p = sessionStorage.getItem("admin_pwd");
  if (!p) {
    p = prompt("Senha do Admin:");
    if (!p) return null;
    sessionStorage.setItem("admin_pwd", p);
  }
  return p;
}

async function adminAction(payload) {
  const password = getPwd();
  if (!password) throw new Error("Cancelado.");

  const res = await fetch("/api/admin", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ ...payload, password })
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) throw new Error(data.error || "Falha no admin.");
  return data;
}
