export const runtime = "nodejs";
const SCRIPT_FALLBACK_URL = "https://script.google.com/macros/s/AKfycbycS9Hn_apUDsvwrYjcLZKvK3PLeiuZ7I_b-Mr_g8AP3fyn_z9dWsp5OBq1iIj2Xrsa/exec";
const SCRIPT_FALLBACK_KEY = "123456";

function cleanEnv(v = "") {
  return String(v).trim().replace(/^['"]+|['"]+$/g, "");
}

function normalizeSecret(v = "") {
  return cleanEnv(v)
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
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

function isInvalidScriptDeployment(status: number, parsed: any, text: string) {
  const msg = String((parsed && parsed.error) || text || "");
  return (
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

export async function POST(req: Request) {
  try {
    const scriptUrl = cleanEnv(process.env.APPS_SCRIPT_URL || "");
    const adminKeyRaw = cleanEnv(process.env.ADMIN_KEY || "");
    const adminPassword = normalizeSecret(process.env.ADMIN_PASSWORD || (process.env as any).ADMIN_PASS || "");
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
    const incomingPassword = normalizeSecret((body && body.password) || "");
    if (!body || incomingPassword !== adminPassword) {
      return Response.json({ ok: false, error: "Senha invalida." }, { status: 401 });
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
        await trySend(SCRIPT_FALLBACK_URL, [SCRIPT_FALLBACK_KEY]);
      }
    }

    if (!lastResp) {
      return Response.json({ ok: false, error: "Falha ao enviar para Apps Script." }, { status: 502 });
    }
    const respAny = lastResp as any;

    if (!respAny.ok) {
      const errorMsg =
        (lastParsed && typeof lastParsed.error === "string" && lastParsed.error) ||
        `Apps Script retornou ${respAny.status}`;
      return Response.json(
        { ok: false, error: errorMsg, upstream_status: respAny.status, upstream_body: lastText || "" },
        { status: respAny.status }
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
          upstream_status: respAny.status,
          upstream_body: lastText.slice(0, 800),
        },
        { status: 502 }
      );
    }

    return Response.json({ ok: true, message: lastText || "OK" });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: `Erro interno em /api/admin: ${err?.message || "erro desconhecido"}` },
      { status: 500 }
    );
  }
}

