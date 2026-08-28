import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import RealReportsView from "@/components/RealReportsView";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const profile = await getProfile();
  if (!isAdmin(profile.roles)) redirect("/dashboard");
  const supabase = createClient();
  const [{ data: people }, { data: videos }, { data: attendance }, { data: logs }, { data: clients }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, roles, active"),
    supabase.from("videos").select("id, title, item_type, client_id, editor_id, writer_id, stage, created_at, submitted_at, posted_at, youtube_url, instagram_url, facebook_url, rejection_note"),
    supabase.from("attendance").select("user_id, work_date, clock_in, clock_out"),
    supabase.from("task_time_logs").select("user_id, video_id, stage, seconds, started_at, ended_at"),
    supabase.from("clients").select("id, name, quota_videos, quota_posters"),
  ]);
  return <RealReportsView people={people || []} videos={videos || []} attendance={attendance || []} logs={logs || []} clients={clients || []} />;
}

