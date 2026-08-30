"use client";

import { useMemo } from "react";
import { rolesLabel } from "@/lib/roles";
import { hms } from "@/lib/format";

const time = (value) => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export default function AdminLiveOverview({ people, attendance, logs }) {
  const rows = useMemo(() => {
    const now = new Date();
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    return people.filter(p => !(p.roles || []).includes("client")).map(p => {
      const sessions = attendance.filter(a => a.user_id === p.id && new Date(a.clock_in) >= start && new Date(a.clock_in) <= end);
      const open = sessions.find(a => !a.clock_out);
      const hours = sessions.reduce((sum, a) => sum + Math.max(0, (new Date(a.clock_out || now) - new Date(a.clock_in)) / 36e5), 0);
      const active = logs.filter(l => l.user_id === p.id && new Date(l.started_at) >= start && new Date(l.started_at) <= end).reduce((sum, l) => sum + Number(l.seconds || 0), 0);
      return { ...p, firstIn: sessions.sort((a,b) => new Date(a.clock_in)-new Date(b.clock_in))[0]?.clock_in, open, hours, active };
    }).filter(r => r.firstIn).sort((a,b) => Number(!!b.open)-Number(!!a.open));
  }, [people, attendance, logs]);

  return <section className="card" style={{ marginBottom: 18 }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:12 }}>
      <div><h2 style={{ margin:0, fontSize:17 }}>Live attendance</h2><p className="sub" style={{ margin:"4px 0 0" }}>Today’s login time, current status and worked duration</p></div>
      <span className="tag" style={{ background:"#ECFDF3", color:"#047857" }}>● {rows.filter(r=>r.open).length} working now</span>
    </div>
    <div style={{ overflowX:"auto" }}><table className="tbl"><thead><tr><th>Staff</th><th>Login time</th><th>Status</th><th>Worked today</th><th>Active task time</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id}><td><b>{r.full_name}</b><br/><small>{rolesLabel(r.roles)}</small></td><td>{time(r.firstIn)}</td><td>{r.open ? <b style={{ color:"#059669" }}>● Live</b> : <span style={{ color:"#64748B" }}>Clocked out</span>}</td><td><b>{r.hours.toFixed(1)} h</b></td><td>{hms(r.active)}</td></tr>)}
      {!rows.length && <tr><td colSpan="5" style={{ color:"#94A3B8" }}>No staff login recorded today.</td></tr>}
    </tbody></table></div>
  </section>;
}
