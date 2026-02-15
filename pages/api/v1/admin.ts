import type { NextApiRequest, NextApiResponse } from "next";
const SCRIPT_FALLBACK_URL = "https://script.google.com/macros/s/AKfycbycS9Hn_apUDsvwrYjcLZKvK3PLeiuZ7I_b-Mr_g8AP3fyn_z9dWsp5OBq1iIj2Xrsa/exec";
const DEFAULT_ADMIN_KEYS = ["123456", "admin123"];

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

function resolveAdminKeys(raw = "") {
  return parseAdminKeys([raw, ...DEFAULT_ADMIN_KEYS].filter(Boolean).join(","));
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

function isInvalidScriptDeployment(status: number, parsed: any, text: string) {
  const looksLikeHtml = /^\s*<!doctype html/i.test(text || "") || /^\s*<html/i.test(text || "");
  const msg = String((parsed && parsed.error) || text || "");
  return (
    looksLikeHtml ||
    status === 404 ||
    /NOT_FOUND/i.test(msg) ||
    /Apps Script invalido/i.test(msg) ||
    /implantacao web/i.test(msg) ||
    /doPost|doGet/i.test(msg)
  );
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Metodo nao permitido." });
  }

  const scriptUrl = process.env.APPS_SCRIPT_URL;
  const adminKeyRaw = process.env.ADMIN_KEY;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminKeys = resolveAdminKeys(adminKeyRaw || "");

  if (!scriptUrl) return res.status(500).json({ ok: false, error: "APPS_SCRIPT_URL nao configurada." });
  if (!adminPassword) return res.status(500).json({ ok: false, error: "ADMIN_PASSWORD nao configurada." });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  if (!body || body.password !== adminPassword) {
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
  let lastFetchError: any = null;

  async function trySend(url: string, keys: string[]) {
    for (const key of keys) {
      const payload = { ...normalizedPayload, key };
      try {
        const upstream = await fetch(url, {
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

        if (upstream.ok && !invalidKey) return true;
      } catch (err: any) {
        lastFetchError = err;
      }
    }
    return false;
  }

  const primaryOk = await trySend(scriptUrl, adminKeys);
  if (!primaryOk) {
    const lastStatus = Number((lastResp as any)?.status || 0);
    const fallbackDueToInvalid = !lastStatus || isInvalidScriptDeployment(lastStatus, lastParsed, lastText);
    const shouldFallback = fallbackDueToInvalid || !!lastFetchError;
    if (shouldFallback) {
      await trySend(SCRIPT_FALLBACK_URL, DEFAULT_ADMIN_KEYS);
    }
  }

  if (!lastResp) return res.status(502).json({ ok: false, error: "Falha ao enviar para Apps Script." });
  const respAny = lastResp as any;

  if (!respAny.ok) {
    const errorMsg =
      (lastParsed && typeof lastParsed.error === "string" && lastParsed.error) ||
      `Apps Script retornou ${respAny.status}`;
    return res.status(respAny.status).json({ ok: false, error: errorMsg, upstream_status: respAny.status, upstream_body: lastText || "" });
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
      upstream_status: respAny.status,
      upstream_body: lastText.slice(0, 800),
    });
  }

  return res.status(200).json({ ok: true, message: lastText || "OK" });
}


