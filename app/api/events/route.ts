function parseCSV(text) {
  const rows = [];
  let row = [], cur = "", inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQuotes = !inQuotes; continue; }

    if (ch === "," && !inQuotes) { row.push(cur); cur = ""; continue; }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (cur.length || row.length) { row.push(cur); rows.push(row); }
      cur = ""; row = [];
      continue;
    }
    cur += ch;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }

  return rows.filter(r => r.some(c => String(c).trim() !== ""));
}

function normKey(v = "") {
  return String(v).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normDept(v = "") {
  // "Música" -> "musica" | "Ministério" -> "ministerio"
  return String(v)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");
}

function toISODate(s = "") {
  const v = String(s).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return v;
}

export async function GET() {
  const csvUrl = process.env.SHEET_CSV_URL;
  if (!csvUrl) {
    return Response.json({ ok: false, error: "SHEET_CSV_URL não configurada." }, { status: 500 });
  }

  const res = await fetch(csvUrl, {
    redirect: "follow",
    headers: { "Accept": "text/csv,text/plain,*/*", "User-Agent": "Mozilla/5.0" },
    next: { revalidate: 60 }
  });

  if (!res.ok) {
    return Response.json({ ok: false, error: `Falha ao buscar CSV (${res.status})` }, { status: 502 });
  }

  const text = await res.text();
  const rows = parseCSV(text);
  const header = (rows[0] || []).map(normKey);
  const idx = (name) => header.indexOf(normKey(name));

  const iData = idx("data");
  const iHora = idx("hora");
  const iEvento = idx("evento");
  const iDestaque = idx("destaque");
  const iDept = idx("departamento");

  const events = rows.slice(1).map((r, rowIndex) => {
    const data = toISODate(r[iData] ?? "");
    const hora = String(r[iHora] ?? "").trim();
    const evento = String(r[iEvento] ?? "").trim();
    const destaqueRaw = String(r[iDestaque] ?? "").trim();
    const deptRaw = String(r[iDept] ?? "").trim();

    return {
      row: rowIndex + 2, // linha real na planilha (para editar/apagar)
      data,
      hora,
      evento,
      destaque: /^(sim|s|true|1)$/i.test(destaqueRaw),
      departamento: normDept(deptRaw), // musica | ministerio | ""
      departamento_label: deptRaw
    };
  }).filter(e => e.data && e.evento);

  return Response.json({ ok: true, data: events, events });
}
