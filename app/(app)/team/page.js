import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin, rolesLabel } from "@/lib/roles";
import { hoursBetween, hms } from "@/lib/format";
import { STAGES } from "@/lib/stages";

export const dynamic = "force-dynamic";
const fmtTime = (t) => (t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—");

export default async function TeamPage() {
  const profile = await getProfile();
  if (!isAdmin(profile.roles)) redirect("/dashboard");
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: people }, { data: videos }, { data: att }, { data: logs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, roles"),
    supabase.from("videos").select("*"),
    supabase.from("attendance").select("user_id, clock_in, clock_out, work_date"),
    supabase.from("task_time_logs").select("user_id, seconds"),
  ]);

  const staff = (people || []).filter((p) => (p.roles || []).some((r) => ["editor", "writer", "designer", "admin"].includes(r)));

  const todays = (uid) => (att || []).filter((a) => a.user_id === uid && a.work_date === today)
    .sort((a, b) => new Date(a.clock_in) - new Date(b.clock_in));
  const firstIn = (uid) => { const r = todays(uid); return r[0]?.clock_in; };
  const lastOut = (uid) => { const r = todays(uid); const open = r.some((a) => !a.clock_out); return open ? null : r[r.length - 1]?.clock_out; };
  const hoursToday = (uid) => todays(uid).reduce((s, a) => s + (hoursBetween(a.clock_in, a.clock_out || new Date().toISOString()) || 0), 0);
  const taskSeconds = (uid) => (logs || []).filter((l) => l.user_id === uid).reduce((s, l) => s + (l.seconds || 0), 0);

  const output = (p) => {
    const roles = p.roles || [];
    if (roles.includes("writer")) {
      const mine = (videos || []).filter((v) => v.writer_id === p.id && v.stage === "published");
      const turn = avg(mine.map((v) => hoursBetween(v.approved_at, v.posted_at)));
      return [["Published", mine.length], ["Avg post time", turn != null ? turn.toFixed(1) + " h" : "—"]];
    }
    const mine = (videos || []).filter((v) => v.editor_id === p.id);
    const sub = mine.filter((v) => v.submitted_at);
    return [["Submitted", sub.length], ["Sent back", mine.filter((v) => v.rejection_note).length]];
  };

  return (
    <div className="body">
      <h1>Team performance</h1>
      <p className="sub">Today's hours, in/out times, active work time and output for each person.</p>

      <table className="tbl" style={{ marginTop: 14 }}>
        <thead><tr><th>Person</th><th>Roles</th><th>Clocked in</th><th>Clocked out</th><th>Hours today</th><th>Active work</th><th>Output</th></tr></thead>
        <tbody>
          {staff.map((p) => {
            const out = output(p);
            return (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.full_name}</td>
                <td style={{ fontSize: 12.5, color: "#475569" }}>{rolesLabel(p.roles)}</td>
                <td>{fmtTime(firstIn(p.id))}</td>
                <td>{lastOut(p.id) ? fmtTime(lastOut(p.id)) : (firstIn(p.id) ? <span style={{ color: "#0F9B68", fontWeight: 600 }}>Active now</span> : "—")}</td>
                <td style={{ fontWeight: 700 }}>{hoursToday(p.id).toFixed(1)} h</td>
                <td>{hms(taskSeconds(p.id))}</td>
                <td style={{ fontSize: 12.5 }}>{out.map(([k, v]) => `${k}: ${v}`).join(" · ")}</td>
              </tr>
            );
          })}
          {staff.length === 0 && <tr><td colSpan="7" style={{ color: "#9aa1b3" }}>No staff yet — add them under Users.</td></tr>}
        </tbody>
      </table>

      <h2 style={{ marginTop: 28 }}>Pipeline snapshot</h2>
      <div className="statrow">
        {STAGES.map((s) => (
          <div className="statbox" key={s.key} style={{ flex: 1 }}>
            <span className="cdot" style={{ background: s.color, display: "inline-block", marginBottom: 6 }} />
            <div className="statnum">{(videos || []).filter((v) => v.stage === s.key).length}</div>
            <div className="statlbl">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
function avg(a) { const f = a.filter((x) => x != null); return f.length ? f.reduce((x, y) => x + y, 0) / f.length : null; }
