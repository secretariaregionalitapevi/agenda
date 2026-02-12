export const runtime = "nodejs";

export async function POST(req: Request) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const adminKey = process.env.ADMIN_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!scriptUrl) {
    return Response.json(
      { ok: false, error: "APPS_SCRIPT_URL nao configurada." },
      { status: 500 }
    );
  }
  if (!adminKey) {
    return Response.json(
      { ok: false, error: "ADMIN_KEY nao configurada." },
      { status: 500 }
    );
  }
  if (!adminPassword) {
    return Response.json(
      { ok: false, error: "ADMIN_PASSWORD nao configurada." },
      { status: 500 }
    );
  }

  const body = await req.json().catch(() => ({}));
  if (!body || body.password !== adminPassword) {
    return Response.json({ ok: false, error: "Senha invalida." }, { status: 401 });
  }

  const { password, ...rest } = body;
  const payload = { ...rest, key: adminKey };

  const upstream = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();

  return new Response(text, {
    status: upstream.status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
