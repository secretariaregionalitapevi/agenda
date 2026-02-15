function cleanEnv(v = "") {
  return String(v).trim().replace(/^['"]+|['"]+$/g, "");
}

function normalizeSecret(v = "") {
  return cleanEnv(v)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

function parseAdminKeys(raw = "") {
  const base = String(raw)
    .split(/[\r\n,;]+/)
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .map((v) => v.replace(/^['"]+|['"]+$/g, ""));

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

function normalizeDepartamentoLabel(v: unknown): string {
  const key = String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

  if (key === "musica") return "M\u00FAsica";
  if (key === "ministerio") return "Minist\u00E9rio";
  return "";
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

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo nao permitido." });
  }

  try {
    const scriptUrl = cleanEnv(process.env.APPS_SCRIPT_URL || "");
    const adminKeyRaw = cleanEnv(process.env.ADMIN_KEY || "");
    const adminPassword = normalizeSecret(process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || "");
    const adminKeys = adminKeyRaw ? parseAdminKeys(adminKeyRaw) : [];

    if (!scriptUrl) return res.status(500).json({ ok: false, error: "APPS_SCRIPT_URL nao configurada." });
    if (!adminKeyRaw || adminKeys.length === 0) return res.status(500).json({ ok: false, error: "ADMIN_KEY nao configurada." });
    if (!adminPassword) return res.status(500).json({ ok: false, error: "ADMIN_PASSWORD nao configurada." });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const incomingPassword = normalizeSecret((body && body.password) || "");
    if (!body || incomingPassword !== adminPassword) {
      return res.status(401).json({ ok: false, error: "Senha invalida." });
    }

    const { password, ...rest } = body;
    const normalizedPayload = { ...rest } as Record<string, unknown>;
    if ("departamento" in normalizedPayload) {
      normalizedPayload.departamento = normalizeDepartamentoLabel(normalizedPayload.departamento);
    }

    let lastResp: Response | null = null;
    let lastText = "";
    let lastParsed: any = null;

    for (const key of adminKeys) {
      const payload = { ...normalizedPayload, key };
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
    }

    if (!lastResp) return res.status(502).json({ ok: false, error: "Falha ao enviar para Apps Script." });

    if (!lastResp.ok) {
      const errorMsg =
        (lastParsed && typeof lastParsed.error === "string" && lastParsed.error) ||
        `Apps Script retornou ${lastResp.status}`;
      return res.status(lastResp.status).json({
        ok: false,
        error: errorMsg,
        upstream_status: lastResp.status,
        upstream_body: lastText || "",
      });
    }

    if (lastParsed && typeof lastParsed === "object") {
      if (typeof lastParsed.ok === "boolean") {
        if (!lastParsed.ok && String(lastParsed.error || "").toLowerCase().includes("chave inv")) {
          return res.status(401).json({
            ok: false,
            error: "Chave invalida no Apps Script. Verifique a constante ADMIN_KEY do script.",
            tried_keys: adminKeys.length,
          });
        }
        return res.status(200).json(lastParsed);
      }
      return res.status(200).json({ ok: true, ...lastParsed });
    }

    const looksLikeHtml = /^\s*<!doctype html/i.test(lastText) || /^\s*<html/i.test(lastText);
    const missingFn = /Fun..o de script n.o encontrada:\s*(doPost|doGet)/i.test(lastText);
    if (looksLikeHtml || missingFn) {
      return res.status(502).json({
        ok: false,
        error: "Apps Script invalido para Web App. Publique novamente a implantacao web.",
        upstream_status: lastResp.status,
        upstream_body: lastText.slice(0, 800),
      });
    }

    return res.status(200).json({ ok: true, message: lastText || "OK" });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      error: `Erro interno em /api/admin: ${err?.message || "erro desconhecido"}`,
    });
  }
}
