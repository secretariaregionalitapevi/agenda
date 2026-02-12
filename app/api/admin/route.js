function canonDeptLabel(v="") {
  const s = String(v).trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g,"");
  if (s === "musica") return "Música";
  if (s === "ministerio") return "Ministério";
  return String(v).trim();
}

export async function POST(req) {
  try {
    const body = await req.json();

    if (!process.env.ADMIN_PASSWORD) {
      return Response.json({ ok: false, error: "ADMIN_PASSWORD não configurada." }, { status: 500 });
    }
    if (body?.password !== process.env.ADMIN_PASSWORD) {
      return Response.json({ ok: false, error: "Senha inválida." }, { status: 401 });
    }

    const appsUrl = process.env.APPS_SCRIPT_URL;
    const key = process.env.ADMIN_KEY;

    if (!appsUrl || !key) {
      return Response.json({ ok: false, error: "APPS_SCRIPT_URL/ADMIN_KEY não configuradas." }, { status: 500 });
    }

    const payload = {
      key,
      action: body.action,
      row: body.row,
      data: body.data,
      hora: body.hora,
      evento: body.evento,
      destaque: body.destaque,
      departamento: canonDeptLabel(body.departamento || ""),
    };

    const r = await fetch(appsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => ({}));
    return Response.json(j, { status: r.ok ? 200 : 400 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
