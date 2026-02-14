function cleanEnv(v) {
  return String(v || "").trim().replace(/^['"]+|['"]+$/g, "");
}

function parseAdminKeys(raw) {
  const base = String(raw || "")
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
  }
  return out;
}

async function parseResp(resp) {
  const text = await resp.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { text, json };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo nao permitido." });
  }

  const scriptUrl = cleanEnv(process.env.APPS_SCRIPT_URL);
  const adminPassword = cleanEnv(process.env.ADMIN_PASSWORD);
  const adminKeys = parseAdminKeys(cleanEnv(process.env.ADMIN_KEY));

  if (!scriptUrl) return res.status(500).json({ ok: false, error: "APPS_SCRIPT_URL nao configurada." });
  if (!adminPassword) return res.status(500).json({ ok: false, error: "ADMIN_PASSWORD nao configurada." });
  if (!adminKeys.length) return res.status(500).json({ ok: false, error: "ADMIN_KEY nao configurada." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!body || body.password !== adminPassword) {
    return res.status(401).json({ ok: false, error: "Senha invalida." });
  }

  const { password, ...rest } = body;
  let last = null;

  for (const key of adminKeys) {
    const payload = { ...rest, key };
    let upstream;
    try {
      upstream = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return res.status(502).json({ ok: false, error: `Falha ao conectar no Apps Script: ${err?.message || "erro"}` });
    }

    const parsed = await parseResp(upstream);
    last = { status: upstream.status, ...parsed };
    const invalidKey = parsed.json && String(parsed.json.error || "").toLowerCase().includes("chave inv");
    if (upstream.ok && !invalidKey) break;
  }

  if (!last) return res.status(502).json({ ok: false, error: "Falha ao enviar para Apps Script." });
  if (last.status >= 400) return res.status(last.status).json({ ok: false, error: (last.json && last.json.error) || `Falha (${last.status})` });
  if (last.json && typeof last.json === "object") return res.status(200).json(last.json.ok === undefined ? { ok: true, ...last.json } : last.json);
  return res.status(200).json({ ok: true, message: last.text || "OK" });
};

