function cleanEnv(v) {
  return String(v || "").trim().replace(/^['"]+|['"]+$/g, "");
}

function normalizeSecret(v) {
  return cleanEnv(v)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
}

async function readRawBody(req) {
  return await new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      // 1MB guard
      if (data.length > 1024 * 1024) {
        reject(new Error("Payload muito grande"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  const raw = await readRawBody(req);
  if (!raw || !raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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
  const adminPassword = normalizeSecret(process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS);
  const adminKeys = parseAdminKeys(cleanEnv(process.env.ADMIN_KEY));

  if (!scriptUrl) return res.status(500).json({ ok: false, error: "APPS_SCRIPT_URL nao configurada." });
  if (!adminPassword) return res.status(500).json({ ok: false, error: "ADMIN_PASSWORD nao configurada." });
  if (!adminKeys.length) return res.status(500).json({ ok: false, error: "ADMIN_KEY nao configurada." });

  let body = {};
  try {
    body = await parseJsonBody(req);
  } catch {
    body = {};
  }

  if (!body || normalizeSecret(body.password) !== adminPassword) {
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
