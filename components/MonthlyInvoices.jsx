"use client";

import { useState } from "react";
import { generateMonthlyInvoices } from "@/app/actions";

const rupee = n => `₹${Number(n || 0).toLocaleString("en-IN")}`;

export default function MonthlyInvoices({ invoices, clients, payments }) {
  const [month,setMonth]=useState(new Date().toISOString().slice(0,7)); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  async function generate(){setBusy(true);setError("");try{await generateMonthlyInvoices(month)}catch(e){setError(e.message);setBusy(false)}}
  const paid = id => payments.filter(p=>p.client_id===id).reduce((s,p)=>s+Number(p.amount||0),0);
  return <section className="acct-sec"><div style={{display:"flex",justifyContent:"space-between",gap:12,flexWrap:"wrap",alignItems:"flex-start"}}><div><h2>Monthly video invoices</h2><p className="sub">Generated from finished video duration and the doctor’s unit price. Existing advance payments are deducted from the balance.</p></div><div style={{display:"flex",gap:8}}><input className="input" style={{width:155}} type="month" value={month} onChange={e=>setMonth(e.target.value)}/><button className="cta" disabled={busy} onClick={generate}>{busy?"Generating…":"Generate drafts"}</button></div></div>{error&&<p className="hint" style={{color:"#B42318"}}>{error}</p>}<table className="tbl"><thead><tr><th>Doctor / firm</th><th>Period</th><th>Invoice</th><th>Advance received</th><th>Balance</th><th>Status</th></tr></thead><tbody>{invoices.map(i=>{const c=clients.find(c=>c.id===i.client_id);const advance=paid(i.client_id);const balance=Number(i.total)-advance;return <tr key={i.id}><td><b>{c?.name||"Unknown"}</b></td><td>{i.period_start} – {i.period_end}</td><td><b>{rupee(i.total)}</b></td><td style={{color:"#047857"}}>{rupee(advance)}</td><td style={{fontWeight:700,color:balance>0?"#B42318":"#047857"}}>{rupee(Math.max(0,balance))}{balance<0&&<small> · {rupee(-balance)} credit</small>}</td><td><span className="tag">{i.status}</span></td></tr>})}{!invoices.length&&<tr><td colSpan="6" style={{color:"#94A3B8"}}>No invoice drafts yet. Choose a month and generate them.</td></tr>}</tbody></table><p className="hint">Draft generation counts only completed videos with a saved duration. This prevents unfinished work from being billed.</p></section>
}
