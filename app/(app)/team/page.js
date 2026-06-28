import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import { STAGES } from "@/lib/stages";
import TeamView from "@/components/TeamView";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const profile = await getProfile();
  if (!isAdmin(profile.roles)) redirect("/dashboard");
  const supabase = createClient();
  const [{ data: people }, { data: videos }, { data: att }, { data: logs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, roles"),
    supabase.from("videos").select("editor_id, writer_id, stage, submitted_at, posted_at"),
    supabase.from("attendance").select("user_id, clock_in, clock_out, work_date"),
    supabase.from("task_time_logs").select("user_id, seconds, started_at"),
  ]);
  return (
    <div className="body">
      <h1>Team performance</h1>
      <p className="sub">Hours, in/out times, active work and output — by day, week or any date.</p>
      <TeamView
        people={(people || []).map((p) => ({ ...p, roles: p.roles || [] }))}
        attendance={att || []} logs={logs || []} videos={videos || []}
      />
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
