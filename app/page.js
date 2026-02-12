"use client";

import { useEffect, useMemo, useState } from "react";

const YEAR = 2026;

const MONTHS = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
const DOW = ["DOM","SEG","TER","QUA","QUI","SEX","SÁB"];

function pad2(n){ return String(n).padStart(2,"0"); }
function monthName(m){ return MONTHS[m-1]; }
function dateKey(y,m,d){ return `${y}-${pad2(m)}-${pad2(d)}`; }
function deptLabelFromValue(v){ return v==="musica" ? "Música" : v==="ministerio" ? "Ministério" : ""; }

function buildCalendar(year){
  const out=[];
  for(let m=1;m<=12;m++){
    const first=new Date(year,m-1,1);
    const last=new Date(year,m,0);
    const startDow=first.getDay();
    const days=last.getDate();
    const cells=[];
    for(let i=0;i<startDow;i++) cells.push(null);
    for(let d=1;d<=days;d++) cells.push(d);
    while(cells.length%7!==0) cells.push(null);
    out.push({m,cells});
  }
  return out;
}

export default function Page(){
  const months = useMemo(()=>buildCalendar(YEAR), []);
  const [events,setEvents]=useState([]);
  const [loadError,setLoadError]=useState("");
  const [monthFilter,setMonthFilter]=useState("todos");
  const [deptFilter,setDeptFilter]=useState("ambos");
  const [adminOpen,setAdminOpen]=useState(false);
  const [adminPwd,setAdminPwd]=useState("");
  const [editing,setEditing]=useState(null);
  const [busy,setBusy]=useState(false);
  const [adminMsg,setAdminMsg]=useState("");

  async function refresh(){
    setLoadError("");
    try{
      const r = await fetch("/api/events",{ cache:"no-store" });
      const j = await r.json();
      if(!r.ok || j.ok===false) throw new Error(j.error||"Falha ao carregar");
      setEvents(j.events||[]);
    }catch(e){
      setLoadError(String(e.message||e));
    }
  }

  useEffect(()=>{ refresh(); }, []);
  useEffect(()=>{ if("serviceWorker" in navigator){ navigator.serviceWorker.register("/sw.js").catch(()=>{}); } }, []);

  const filtered = useMemo(()=>{
    return events.filter(e=>{
      if(!String(e.data||"").startsWith(String(YEAR))) return false;
      if(monthFilter!=="todos"){
        const mm = Number(String(e.data).slice(5,7));
        if(mm !== Number(monthFilter)) return false;
      }
      if(deptFilter!=="ambos"){
        if(e.departamento !== deptFilter) return false;
      }
      return true;
    });
  },[events,monthFilter,deptFilter]);

  const byDate = useMemo(()=>{
    const m=new Map();
    for(const e of filtered){
      const k=e.data;
      if(!m.has(k)) m.set(k,[]);
      m.get(k).push(e);
    }
    for(const [k,arr] of m.entries()){
      arr.sort((a,b)=>String(a.hora).localeCompare(String(b.hora)));
    }
    return m;
  },[filtered]);

  function openAdmin(){
    setAdminMsg("");
    setEditing(null);
    setAdminOpen(true);
    const saved=sessionStorage.getItem("admin_pwd");
    if(saved) setAdminPwd(saved);
  }
  function closeAdmin(){ setAdminOpen(false); setAdminMsg(""); setEditing(null); }
  function ensurePwd(){
    const p=adminPwd || sessionStorage.getItem("admin_pwd") || "";
    if(!p) return false;
    sessionStorage.setItem("admin_pwd", p);
    return true;
  }
  async function adminRequest(payload){
    if(!ensurePwd()) throw new Error("Informe a senha do Admin.");
    const r = await fetch("/api/admin",{
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ ...payload, password: adminPwd })
    });
    const j = await r.json();
    if(!r.ok || j.ok===false) throw new Error(j.error||"Falha no admin.");
    return j;
  }

  function startNew(){
    setEditing({ row:null, data:`${YEAR}-01-01`, hora:"", evento:"", destaque:false, departamento:"musica" });
    setAdminMsg("");
  }
  function startEdit(e){
    setEditing({ row:e.row, data:e.data, hora:e.hora||"", evento:e.evento||"", destaque:!!e.destaque, departamento:e.departamento||"musica" });
    setAdminMsg("");
  }

  async function saveEditing(){
    if(!editing) return;
    setBusy(true); setAdminMsg("");
    try{
      await adminRequest({
        action: editing.row ? "update" : "create",
        row: editing.row || undefined,
        data: editing.data,
        hora: editing.hora,
        evento: editing.evento,
        destaque: editing.destaque ? "Sim" : "",
        departamento: deptLabelFromValue(editing.departamento),
      });
      setAdminMsg("✅ Salvo!");
      await refresh();
    }catch(e){
      setAdminMsg("❌ " + String(e.message||e));
    }finally{ setBusy(false); }
  }

  async function deleteEditing(){
    if(!editing?.row) return;
    if(!confirm("Excluir este evento?")) return;
    setBusy(true); setAdminMsg("");
    try{
      await adminRequest({ action:"delete", row: editing.row });
      setAdminMsg("✅ Excluído!");
      setEditing(null);
      await refresh();
    }catch(e){
      setAdminMsg("❌ " + String(e.message||e));
    }finally{ setBusy(false); }
  }

  function logoutAdmin(){
    sessionStorage.removeItem("admin_pwd");
    setAdminPwd("");
    setAdminMsg("Sessão encerrada.");
  }

  return (
    <div style={{ maxWidth: 980, margin:"0 auto", padding:16 }}>
      <div style={{ background:"#fff", border:"1px solid #ddd", borderRadius:12, padding:12, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap", justifyContent:"space-between" }}>
        <div style={{ display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
          <label style={{ fontWeight:700 }}>Escolher mês:</label>
          <select value={monthFilter} onChange={(e)=>setMonthFilter(e.target.value)} style={{ padding:8, borderRadius:8 }}>
            <option value="todos">Todos</option>
            {Array.from({length:12},(_,i)=>i+1).map(m=>(
              <option key={m} value={String(m)}>{monthName(m)}</option>
            ))}
          </select>

          <label style={{ fontWeight:700, marginLeft:8 }}>Departamento:</label>
          <select value={deptFilter} onChange={(e)=>setDeptFilter(e.target.value)} style={{ padding:8, borderRadius:8 }}>
            <option value="ambos">Ambos</option>
            <option value="musica">Música</option>
            <option value="ministerio">Ministério</option>
          </select>

          <button onClick={openAdmin} style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #333", background:"#fff", cursor:"pointer", fontWeight:700 }}>
            Admin
          </button>
        </div>

        <button onClick={()=>window.print()} style={{ padding:"8px 14px", borderRadius:10, border:"1px solid #333", background:"#fff", cursor:"pointer", fontWeight:700 }}>
          Imprimir / Salvar PDF
        </button>
      </div>

      {loadError && (
        <div style={{ marginTop:12, background:"#fff3cd", border:"1px solid #ffeeba", padding:10, borderRadius:10 }}>
          ⚠️ Não foi possível carregar a planilha: {loadError}
        </div>
      )}

      <h1 style={{ textAlign:"center", margin:"28px 0 18px", fontSize:44 }}>Calendário {YEAR}</h1>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(3, minmax(0, 1fr))", gap:18 }}>
        {months.map(({m,cells})=>(
          <div key={m} style={{ background:"#fff", border:"1px solid #ccc", borderRadius:10, padding:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontWeight:800, marginBottom:6 }}>
              <span>{monthName(m)}</span><span>{YEAR}</span>
            </div>

            <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed" }}>
              <thead>
                <tr>
                  {DOW.map((d,idx)=>(
                    <th key={d} style={{ border:"1px solid #999", padding:"4px 2px", fontSize:12, color: idx===0 ? "#c00" : "#000" }}>{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({length: cells.length/7}, (_,w)=>w).map(w=>(
                  <tr key={w}>
                    {cells.slice(w*7,w*7+7).map((day,idx)=>{
                      const k = day ? dateKey(YEAR,m,day) : null;
                      const evts = k ? (byDate.get(k) || []) : [];
                      const isRed = evts.some(e=>e.destaque);
                      return (
                        <td key={idx} style={{ border:"1px solid #999", height:34, verticalAlign:"top", padding:"2px 3px", fontSize:12 }}>
                          {day && (
                            <div style={{ fontWeight: isRed ? 900 : 700, color: isRed ? "#c00" : "#000" }}>{day}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop:10 }}>
              {Array.from(byDate.entries())
                .filter(([k])=>Number(k.slice(5,7))===m)
                .sort(([a],[b])=>a.localeCompare(b))
                .map(([k,evts])=>(
                  <div key={k} style={{ marginBottom:8 }}>
                    <div style={{ fontWeight:800, fontSize:13 }}>{k.split("-").reverse().join("/")}</div>
                    {evts.map((e,i)=>(
                      <div key={i} style={{ fontSize:13, fontWeight: e.destaque ? 900 : 400, color: e.destaque ? "#c00" : "#000" }}>
                        {e.hora ? `${e.hora} - ` : ""}{e.evento}
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {adminOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.45)", display:"flex", alignItems:"center", justifyContent:"center", padding:14, zIndex:9999 }}>
          <div style={{ width:"min(860px, 100%)", maxHeight:"90vh", overflow:"auto", background:"#fff", borderRadius:14, border:"1px solid #ddd", padding:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
              <h2 style={{ margin:0 }}>Admin</h2>
              <button onClick={closeAdmin} style={{ padding:"6px 10px", borderRadius:10, border:"1px solid #333", background:"#fff", cursor:"pointer" }}>Fechar</button>
            </div>

            <div style={{ marginTop:10, display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
              <label style={{ fontWeight:700 }}>Senha:</label>
              <input type="password" value={adminPwd} onChange={(e)=>setAdminPwd(e.target.value)} placeholder="Senha do Admin" style={{ padding:8, borderRadius:10, border:"1px solid #bbb", minWidth:220 }} />
              <button onClick={logoutAdmin} style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #333", background:"#fff", cursor:"pointer" }}>Sair</button>
              <button onClick={startNew} style={{ padding:"8px 12px", borderRadius:10, border:"1px solid #333", background:"#fff", cursor:"pointer", fontWeight:700 }}>Novo</button>
            </div>

            {adminMsg && (
              <div style={{ marginTop:10, background:"#f7f7f7", border:"1px solid #ddd", padding:10, borderRadius:10 }}>{adminMsg}</div>
            )}

            {editing && (
              <div style={{ marginTop:12, border:"1px solid #ddd", borderRadius:12, padding:12 }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(2, minmax(0, 1fr))", gap:10 }}>
                  <div>
                    <div style={{ fontWeight:700 }}>Data</div>
                    <input type="date" value={editing.data} onChange={(e)=>setEditing({ ...editing, data:e.target.value })} style={{ width:"100%", padding:8, borderRadius:10, border:"1px solid #bbb" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight:700 }}>Hora</div>
                    <input type="time" value={editing.hora} onChange={(e)=>setEditing({ ...editing, hora:e.target.value })} style={{ width:"100%", padding:8, borderRadius:10, border:"1px solid #bbb" }} />
                  </div>
                  <div style={{ gridColumn:"1 / -1" }}>
                    <div style={{ fontWeight:700 }}>Evento</div>
                    <input value={editing.evento} onChange={(e)=>setEditing({ ...editing, evento:e.target.value })} style={{ width:"100%", padding:8, borderRadius:10, border:"1px solid #bbb" }} />
                  </div>
                  <div>
                    <div style={{ fontWeight:700 }}>Departamento</div>
                    <select value={editing.departamento} onChange={(e)=>setEditing({ ...editing, departamento:e.target.value })} style={{ width:"100%", padding:8, borderRadius:10 }}>
                      <option value="musica">Música</option>
                      <option value="ministerio">Ministério</option>
                    </select>
                  </div>
                  <div style={{ display:"flex", alignItems:"end", gap:10 }}>
                    <label style={{ display:"flex", alignItems:"center", gap:8, fontWeight:700 }}>
                      <input type="checkbox" checked={editing.destaque} onChange={(e)=>setEditing({ ...editing, destaque:e.target.checked })} />
                      Destaque (Sim)
                    </label>
                  </div>
                </div>

                <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap" }}>
                  <button disabled={busy} onClick={saveEditing} style={{ padding:"10px 14px", borderRadius:10, border:"1px solid #333", background:"#fff", cursor:"pointer", fontWeight:800 }}>Salvar</button>
                  <button disabled={busy || !editing.row} onClick={deleteEditing} style={{ padding:"10px 14px", borderRadius:10, border:"1px solid #c00", background:"#fff", cursor:"pointer", fontWeight:800, color:"#c00" }}>Excluir</button>
                </div>
              </div>
            )}

            <div style={{ marginTop:14 }}>
              <div style={{ fontWeight:800, marginBottom:8 }}>
                Eventos (filtro atual: {monthFilter==="todos" ? "Todos os meses" : monthName(Number(monthFilter))} / {deptFilter==="ambos" ? "Ambos" : deptLabelFromValue(deptFilter)})
              </div>
              <div style={{ border:"1px solid #ddd", borderRadius:12, overflow:"hidden" }}>
                <table style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr style={{ background:"#f3f3f3" }}>
                      <th style={{ textAlign:"left", padding:8, borderBottom:"1px solid #ddd" }}>Data</th>
                      <th style={{ textAlign:"left", padding:8, borderBottom:"1px solid #ddd" }}>Hora</th>
                      <th style={{ textAlign:"left", padding:8, borderBottom:"1px solid #ddd" }}>Evento</th>
                      <th style={{ textAlign:"left", padding:8, borderBottom:"1px solid #ddd" }}>Dept</th>
                      <th style={{ textAlign:"left", padding:8, borderBottom:"1px solid #ddd" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.sort((a,b)=>(a.data+a.hora).localeCompare(b.data+b.hora)).slice(0,200).map((e)=>(
                      <tr key={e.row}>
                        <td style={{ padding:8, borderBottom:"1px solid #eee" }}>{e.data.split("-").reverse().join("/")}</td>
                        <td style={{ padding:8, borderBottom:"1px solid #eee" }}>{e.hora}</td>
                        <td style={{ padding:8, borderBottom:"1px solid #eee", fontWeight:e.destaque?900:400, color:e.destaque?"#c00":"#000" }}>{e.evento}</td>
                        <td style={{ padding:8, borderBottom:"1px solid #eee" }}>{e.departamento_label || deptLabelFromValue(e.departamento)}</td>
                        <td style={{ padding:8, borderBottom:"1px solid #eee" }}>
                          <button onClick={()=>startEdit(e)} style={{ padding:"6px 10px", borderRadius:10, border:"1px solid #333", background:"#fff", cursor:"pointer" }}>Editar</button>
                        </td>
                      </tr>
                    ))}
                    {!filtered.length && (
                      <tr><td colSpan="5" style={{ padding:10 }}>Nenhum evento no filtro atual.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop:8, fontSize:12, color:"#555" }}>Dica: filtre por mês antes de editar.</div>
            </div>

          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          button, select, input, label, h2 { display:none !important; }
          body { background:#fff !important; }
          div[style*="position:fixed"] { display:none !important; }
        }
        @media (max-width: 900px) {
          div[style*="grid-template-columns:repeat(3"] { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
          h1 { font-size:34px !important; }
        }
      `}</style>
    </div>
  );
}
