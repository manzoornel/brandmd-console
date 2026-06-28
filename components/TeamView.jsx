"use client";
import { useState, useMemo } from "react";
import { rolesLabel } from "@/lib/roles";
import { hms } from "@/lib/format";

const ymd = (d) => new Date(d).toLocaleDateString("en-CA"); // YYYY-MM-DD local
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

export default function TeamView({ people, attendance, logs, videos }) {
  const [range, setRange] = useState("today");
  const [customDay, setCustomDay] = useState(ymd(new Date()));

  const { start, end, isToday } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (range === "today") return { start: today, end: new Date(), isToday: true };
    if (range === "week") { const s = new Date(today); s.setDate(s.getDate() - 6); return { start: s, end: new Date(), isToday: true }; }
    const d = new Date(customDay + "T00:00:00"); const e = new Date(d); e.setHours(23, 59, 59);
    return { start: d, end: e, isToday: ymd(d) === ymd(new Date()) };
  }, [range, customDay]);

  const inRange = (t) => t && new Date(t) >= start && new Date(t) <= end;
  const dayInRange = (wd) => { const d = new Date(wd + "T00:00:00"); return d >= start && d <= new Date(ymd(end) + "T23:59:59"); };

  const rows = useMemo(() => {
    const staff = people.filter((p) => (p.roles || []).some((r) => ["editor", "writer", "designer", "admin"].includes(r)));
    return staff.map((p) => {
      const att = attendance.filter((a) => a.user_id === p.id && dayInRange(a.work_date))
        .sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));
      const hours = att.reduce((s, a) => {
        const out = a.clock_out || (isToday ? new Date().toISOString() : a.clock_in);
        return s + Math.max(0, (new Date(out) - new Date(a.clock_in)) / 36e5);
      }, 0);
      const active = logs.filter((l) => l.user_id === p.id && inRange(l.started_at)).reduce((s, l) => s + (l.seconds || 0), 0);
      const submitted = videos.filter((v) => v.editor_id === p.id && inRange(v.submitted_at)).length;
      const published = videos.filter((v) => v.writer_id === p.id && inRange(v.posted_at)).length;
      const score = published * 3 + submitted * 2 + hours;
      const daysPresent = new Set(att.map((a) => a.work_date)).size;
      const delta = daysPresent ? hours - 7.5 * daysPresent : 0; // standard 9:30–5:00 = 7.5h/day
      return { p, firstIn: att[0]?.clock_in, lastOut: att.some((a) => !a.clock_out) && isToday ? null : att[att.length - 1]?.clock_out,
        hours, active, submitted, published, score, delta, daysPresent };
    });
  }, [people, attendance, logs, videos, start, end]);

  const topScore = Math.max(0, ...rows.map((r) => r.score));

  const Btn = ({ k, label }) => (
    <button onClick={() => setRange(k)} className="btn" style={{
      padding: "7px 14px", fontSize: 13,
      background: range === k ? "var(--violet)" : "#fff",
      color: range === k ? "#fff" : "#475569",
      border: range === k ? "none" : "1px solid var(--border)", fontWeight: 650 }}>{label}</button>
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 14, marginBottom: 6 }}>
        <Btn k="today" label="Today" /><Btn k="week" label="This week" /><Btn k="custom" label="Custom day" />
        {range === "custom" && <input className="input" style={{ width: "auto" }} type="date" value={customDay} onChange={(e) => setCustomDay(e.target.value)} />}
        <span style={{ fontSize: 11.5, color: "#94A3B8", marginLeft: "auto" }}>Standard 9:30–5:00 = 7.5h/day · OT = overtime</span>
      </div>

      <table className="tbl" style={{ marginTop: 12 }}>
        <thead><tr><th>Person</th><th>Roles</th><th>In</th><th>Out</th><th>Hours</th><th>Active work</th><th>Submitted</th><th>Published</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const isTop = topScore > 0 && r.score === topScore;
            return (
              <tr key={r.p.id} style={isTop ? { background: "linear-gradient(90deg, rgba(91,71,251,.06), transparent)" } : null}>
                <td style={{ fontWeight: 600 }}>
                  {r.p.full_name}
                  {isTop && <span className="tag" style={{ marginLeft: 8, background: "linear-gradient(90deg,#5B47FB,#FF6A5A)", color: "#fff" }}>🏆 Top</span>}
                </td>
                <td style={{ fontSize: 12.5, color: "#475569" }}>{rolesLabel(r.p.roles)}</td>
                <td>{fmtTime(r.firstIn)}</td>
                <td>{r.lastOut ? fmtTime(r.lastOut) : (r.firstIn ? <span style={{ color: "#0F9B68", fontWeight: 600 }}>Active</span> : "—")}</td>
                <td style={{ fontWeight: 700 }}>
                  {r.hours.toFixed(1)} h
                  {r.daysPresent > 0 && Math.abs(r.delta) >= 0.25 && (
                    <span className={"ot " + (r.delta > 0 ? "ot-over" : "ot-under")} style={{ marginLeft: 6 }}>
                      {r.delta > 0 ? `+${r.delta.toFixed(1)} OT` : `${r.delta.toFixed(1)}`}
                    </span>
                  )}
                </td>
                <td>{hms(r.active)}</td>
                <td>{r.submitted}</td>
                <td>{r.published}</td>
              </tr>
            );
          })}
          {rows.length === 0 && <tr><td colSpan="8" style={{ color: "#9aa1b3" }}>No staff yet — add them under Users.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
