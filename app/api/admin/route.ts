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

  let upstream: Response;
  try {
    upstream = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: `Falha ao conectar no Apps Script: ${err?.message || "erro de rede"}` },
      { status: 502 }
    );
  }

  const text = await upstream.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!upstream.ok) {
    const errorMsg =
      (parsed && typeof parsed.error === "string" && parsed.error) ||
      `Apps Script retornou ${upstream.status}`;
    return Response.json(
      { ok: false, error: errorMsg, upstream_status: upstream.status, upstream_body: text || "" },
      { status: upstream.status }
    );
  }

  // Se o Apps Script já retorna JSON, respeitamos o payload.
  if (parsed && typeof parsed === "object") {
    if (typeof parsed.ok === "boolean") return Response.json(parsed);
    return Response.json({ ok: true, ...parsed });
  }

  // HTML de erro do Apps Script (ex.: "Função de script não encontrada: doPost")
  const looksLikeHtml = /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
  const missingFn = /Fun..o de script n.o encontrada:\s*(doPost|doGet)/i.test(text);
  if (looksLikeHtml || missingFn) {
    return Response.json(
      {
        ok: false,
        error:
          "Apps Script inválido para Web App. A URL atual não expõe doPost/doGet. Publique novamente a implantação web.",
        upstream_status: upstream.status,
        upstream_body: text.slice(0, 800),
      },
      { status: 502 }
    );
  }

  // Fallback para respostas texto simples de sucesso (ex.: "OK")
  return Response.json({ ok: true, message: text || "OK" });
}
