import { createClient, getProfile } from "@/lib/supabase/server";
import Board from "@/components/Board";
import AdminLiveOverview from "@/components/AdminLiveOverview";
import { isAdmin } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getProfile();
  const supabase = createClient();
  const [{ data: videos }, { data: clients }, { data: people }, { data: attendance }, { data: logs }] = await Promise.all([
    supabase.from("videos").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name, type, parent_id, is_firm, posting_plan_mode, monthly_video_target, weekly_video_target, preferred_weekday, quota_videos"),
    supabase.from("profiles").select("id, full_name, roles"),
    supabase.from("attendance").select("user_id, clock_in, clock_out, work_date, device_type, device_label, location_status, distance_m"),
    supabase.from("task_time_logs").select("user_id, seconds, started_at"),
  ]);
  return (
    <><div className="body" style={{ paddingBottom: 0 }}>{isAdmin(profile.roles) && <AdminLiveOverview people={people || []} attendance={attendance || []} logs={logs || []} />}</div><Board
      roles={profile.roles}
      myId={profile.id}
      myClientId={profile.client_id}
      videos={videos || []}
      clients={clients || []}
      people={(people || []).map((p) => ({ ...p, roles: p.roles || [] }))}
    /></>
  );
}
