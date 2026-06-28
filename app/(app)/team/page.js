import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin, ROLES } from "@/lib/roles";
import { hoursBetween, hms } from "@/lib/format";
import { STAGES } from "@/lib/stages";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const profile = await getProfile();
  if (!isAdmin(profile.role)) redirect("/dashboard");
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: people }, { data: videos }, { data: att }, { data: logs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").in("role", ["editor", "writer", "admin"]),
    supabase.from("videos").select("*"),
    supabase.from("attendance").select("user_id, clock_in, clock_out, work_date"),
    supabase.from("task_time_logs").select("user_id, seconds"),
  ]);

  const hoursToday = (uid) =>
    (att || []).filter((a) => a.user_id === uid && a.work_date === today)
      .reduce((s, a) => s + (hoursBetween(a.clock_in, a.clock_out || new Date().toISOString()) || 0), 0);
  const taskSeconds = (uid) => (logs || []).filter((l) => l.user_id === uid).reduce((s, l) => s + (l.seconds || 0), 0);

  const editorStats = (uid) => {
    const mine = (videos || []).filter((v) => v.editor_id === uid);
    const sub = mine.filter((v) => v.submitted_at);
    const turn = avg(sub.map((v) => hoursBetween(v.created_at, v.submitted_at)));
    return [["Videos submitted", sub.length], ["Sent back", mine.filter((v) => v.rejection_note).length],
      ["Avg edit turnaround", turn != null ? turn.toFixed(1) + " h" : "—"]];
  };
  const writerStats = (uid) => {
    const mine = (videos || []).filter((v) => v.writer_id === uid && v.stage === "published");
    const turn = avg(mine.map((v) => hoursBetween(v.approved_at, v.posted_at)));
    return [["Posts published", mine.length], ["Active work time", hms(taskSeconds(uid))],
      ["Avg post turnaround", turn != null ? turn.toFixed(1) + " h" : "—"]];
  };

  return (
    <div className="body">
      <h1>Team performance</h1>
      <p className="sub">Hours today, output, and turnaround for each person.</p>

      <div className="statrow">
        {(people || []).map((p) => {
          const stats = p.role === "writer" ? writerStats(p.id)
            : p.role === "editor" ? editorStats(p.id)
            : [["Role", "Admin"], ["Hours today", hoursToday(p.id).toFixed(1) + " h"]];
          return (
            <div className="person" key={p.id}>
              <div className="avatar">{(p.full_name || "?").split(" ").slice(-1)[0][0]}</div>
              <div style={{ flex: 1 }}>
                <div className="pname">{p.full_name}</div>
                <div className="prole">{ROLES[p.role]} · {hoursToday(p.id).toFixed(1)}h today</div>
                <div className="statgrid">
                  {stats.map(([k, v]) => (
                    <div className="statbox" key={k}><div className="statnum">{v}</div><div className="statlbl">{k}</div></div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {(people || []).length === 0 && <p className="sub">No staff yet — add them under Users.</p>}
      </div>

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
