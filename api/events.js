function cleanEnv(v) {
  return String(v || "").trim().replace(/^['"]+|['"]+$/g, "");
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }
    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cur.length || row.length) {
        row.push(cur);
        rows.push(row);
      }
      cur = "";
      row = [];
      continue;
    }
    cur += ch;
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

function normKey(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normDept(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function toISODate(s) {
  const v = String(s || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return v;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Metodo nao permitido." });
  }

  const csvUrl = cleanEnv(process.env.SHEET_CSV_URL);
  if (!csvUrl) {
    return res.status(500).json({ ok: false, error: "SHEET_CSV_URL nao configurada." });
  }

  let upstream;
  try {
    const freshUrl = `${csvUrl}${csvUrl.includes("?") ? "&" : "?"}cb=${Date.now()}`;
    upstream = await fetch(freshUrl, {
      redirect: "follow",
      headers: { Accept: "text/csv,text/plain,*/*", "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: `Erro ao ler SHEET_CSV_URL: ${err?.message || "erro"}` });
  }

  if (!upstream.ok) {
    return res.status(502).json({ ok: false, error: `Falha ao buscar CSV (${upstream.status})` });
  }

  const text = await upstream.text();
  const rows = parseCSV(text);
  const header = (rows[0] || []).map(normKey);
  const idx = (name) => header.indexOf(normKey(name));

  const iData = idx("data");
  const iHora = idx("hora");
  const iEvento = idx("evento");
  const iDestaque = idx("destaque");
  const iDept = idx("departamento");

  const events = rows
    .slice(1)
    .map((r, rowIndex) => {
      const data = toISODate(r[iData] ?? "");
      const hora = String(r[iHora] ?? "").trim();
      const evento = String(r[iEvento] ?? "").trim();
      const destaqueRaw = String(r[iDestaque] ?? "").trim();
      const deptRaw = String(r[iDept] ?? "").trim();
      return {
        row: rowIndex + 2,
        data,
        hora,
        evento,
        destaque: /^(sim|s|true|1)$/i.test(destaqueRaw),
        departamento: normDept(deptRaw),
        departamento_label: deptRaw,
      };
    })
    .filter((e) => e.data && e.evento);

  return res.status(200).json({ ok: true, data: events, events });
};

