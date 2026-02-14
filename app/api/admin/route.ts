export const runtime = "nodejs";

function cleanEnv(v = "") {
  return String(v).trim().replace(/^['"]+|['"]+$/g, "");
}

function parseAdminKeys(raw: string) {
  const base = raw
    .split(/[\r\n,;]+/)
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .map((v) => v.replace(/^['\"]+|['\"]+$/g, ""));

  const out: string[] = [];
  const seen = new Set<string>();
  const push = (k: string) => {
    const key = String(k || "").trim();
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(key);
  };

  for (const k of base) {
    push(k);
    push(`${k}'`);
    if (k.endsWith("'")) push(k.slice(0, -1));
    push(`${k}*`);
    if (k.endsWith("*")) push(k.slice(0, -1));
    const root = k.replace(/['*]+$/g, "");
    push(root);
    push(`${root}'`);
    push(`${root}*`);
    push(`${root}'*`);
    push(`${root}*'`);
    push(root.replace(/['"]/g, ""));
  }
  return out;
}

async function readUpstream(resp: Response) {
  const text = await resp.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  return { text, parsed };
}

export async function POST(req: Request) {
  const scriptUrl = cleanEnv(process.env.APPS_SCRIPT_URL || "");
  const adminKeyRaw = cleanEnv(process.env.ADMIN_KEY || "");
  const adminPassword = cleanEnv(process.env.ADMIN_PASSWORD || "");
  const adminKeys = adminKeyRaw ? parseAdminKeys(adminKeyRaw) : [];

  if (!scriptUrl) {
    return Response.json({ ok: false, error: "APPS_SCRIPT_URL nao configurada." }, { status: 500 });
  }
  if (!adminKeyRaw || adminKeys.length === 0) {
    return Response.json({ ok: false, error: "ADMIN_KEY nao configurada." }, { status: 500 });
  }
  if (!adminPassword) {
    return Response.json({ ok: false, error: "ADMIN_PASSWORD nao configurada." }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  if (!body || body.password !== adminPassword) {
    return Response.json({ ok: false, error: "Senha invalida." }, { status: 401 });
  }

  const { password, ...rest } = body;
  let lastResp: Response | null = null;
  let lastText = "";
  let lastParsed: any = null;

  for (const key of adminKeys) {
    const payload = { ...rest, key };
    try {
      const upstream = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const { text, parsed } = await readUpstream(upstream);
      lastResp = upstream;
      lastText = text;
      lastParsed = parsed;

      const invalidKey =
        parsed &&
        typeof parsed === "object" &&
        String(parsed.error || "").toLowerCase().includes("chave inv");

      if (upstream.ok && !invalidKey) break;
    } catch (err: any) {
      return Response.json(
        { ok: false, error: `Falha ao conectar no Apps Script: ${err?.message || "erro de rede"}` },
        { status: 502 }
      );
    }
  }

  if (!lastResp) {
    return Response.json({ ok: false, error: "Falha ao enviar para Apps Script." }, { status: 502 });
  }

  if (!lastResp.ok) {
    const errorMsg =
      (lastParsed && typeof lastParsed.error === "string" && lastParsed.error) ||
      `Apps Script retornou ${lastResp.status}`;
    return Response.json(
      { ok: false, error: errorMsg, upstream_status: lastResp.status, upstream_body: lastText || "" },
      { status: lastResp.status }
    );
  }

  if (lastParsed && typeof lastParsed === "object") {
    if (typeof lastParsed.ok === "boolean") {
      if (!lastParsed.ok && String(lastParsed.error || "").toLowerCase().includes("chave inv")) {
        return Response.json(
          {
            ok: false,
            error: "Chave invalida no Apps Script. Verifique a constante ADMIN_KEY do script.",
            tried_keys: adminKeys.length,
          },
          { status: 401 }
        );
      }
      return Response.json(lastParsed);
    }
    return Response.json({ ok: true, ...lastParsed });
  }

  const looksLikeHtml = /^\s*<!doctype html/i.test(lastText) || /^\s*<html/i.test(lastText);
  const missingFn = /Fun..o de script n.o encontrada:\s*(doPost|doGet)/i.test(lastText);
  if (looksLikeHtml || missingFn) {
    return Response.json(
      {
        ok: false,
        error: "Apps Script invalido para Web App. Publique novamente a implantacao web.",
        upstream_status: lastResp.status,
        upstream_body: lastText.slice(0, 800),
      },
      { status: 502 }
    );
  }

  return Response.json({ ok: true, message: lastText || "OK" });
}
