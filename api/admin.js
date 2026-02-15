function parseAdminKeys(raw = "") {
  const base = String(raw)
    .split(/[\r\n,;]+/)
    .map((v) => String(v || "").trim())
    .filter(Boolean)
    .map((v) => v.replace(/^['"]+|['"]+$/g, ""));

  const out = [];
  const seen = new Set();
  const push = (k) => {
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

async function readUpstream(resp) {
  const text = await resp.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  return { text, parsed };
}

function normalizeDepartamentoLabel(v) {
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

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo nao permitido." });
  }

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const adminKeyRaw = process.env.ADMIN_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminKeys = adminKeyRaw ? parseAdminKeys(adminKeyRaw) : [];

  if (!scriptUrl) return res.status(500).json({ ok: false, error: "APPS_SCRIPT_URL nao configurada." });
  if (!adminKeyRaw || adminKeys.length === 0) return res.status(500).json({ ok: false, error: "ADMIN_KEY nao configurada." });
  if (!adminPassword) return res.status(500).json({ ok: false, error: "ADMIN_PASSWORD nao configurada." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!body || body.password !== adminPassword) {
    return res.status(401).json({ ok: false, error: "Senha invalida." });
  }

  const { password, ...rest } = body;
  const normalizedPayload = { ...rest };
  if ("departamento" in normalizedPayload) {
    normalizedPayload.departamento = normalizeDepartamentoLabel(normalizedPayload.departamento);
  }

  let lastResp = null;
  let lastText = "";
  let lastParsed = null;

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
    return res.status(lastResp.status).json({ ok: false, error: errorMsg, upstream_status: lastResp.status, upstream_body: lastText || "" });
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

  return res.status(200).json({ ok: true, message: lastText || "OK" });
};
