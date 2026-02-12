export const runtime = 'nodejs';

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (c === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(cur);
      cur = '';
    } else if (c === '\n') {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
    } else if (c === '\r') {
      // ignore
    } else {
      cur += c;
    }
  }
  row.push(cur);
  rows.push(row);
  return rows.filter(r => r.some(cell => String(cell).trim() !== ''));
}

export async function GET() {
  const csvUrl = process.env.SHEET_CSV_URL;
  if (!csvUrl) {
    return new Response(JSON.stringify({ ok: false, error: 'SHEET_CSV_URL não configurada.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  const res = await fetch(csvUrl, { next: { revalidate: 60 } });
  if (!res.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: `Falha ao buscar CSV: ${res.status}` }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }

  const text = await res.text();
  const table = parseCSV(text);
  const header = (table[0] || []).map(h => String(h).trim().toLowerCase());

  const idx = (name: string) => header.indexOf(name);

  const iData = idx('data');
  const iHora = idx('hora');
  const iEvento = idx('evento');
  const iDestaque = idx('destaque');
  const iDept = idx('departamento');

  const data = table
    .slice(1)
    .map((r, k) => {
      const get = (i: number) => (i >= 0 ? (r[i] ?? '') : '');
      return {
        row: k + 2, // sheet row for admin edits
        data: String(get(iData)).trim(),
        hora: String(get(iHora)).trim(),
        evento: String(get(iEvento)).trim(),
        destaque: String(get(iDestaque)).trim(),
        departamento: String(get(iDept)).trim(),
      };
    })
    .filter(e => e.data && e.evento);

  return new Response(JSON.stringify({ ok: true, data }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
    },
  });
}
