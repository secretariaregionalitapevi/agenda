export const runtime = "nodejs";

export async function POST(req: Request) {
  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const adminKey = process.env.ADMIN_KEY;

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

  const body = await req.json().catch(() => ({}));
  const payload = { ...body, key: adminKey };

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
