import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import RealReportsView from "@/components/RealReportsView";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const profile = await getProfile();
  if (!isAdmin(profile.roles)) redirect("/dashboard");
  const supabase = createClient();
  const [{ data: people }, { data: videos }, { data: attendance }, { data: attendanceEvents }, { data: logs }, { data: clients }, { data: compensationRules }, { data: sundayCredits }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, roles, active"),
    supabase.from("videos").select("id, title, item_type, client_id, editor_id, writer_id, stage, created_at, submitted_at, posted_at, youtube_url, instagram_url, facebook_url, rejection_note, duration_seconds, calculated_units, approved_units, calculated_staff_units, approved_staff_units"),
    supabase.from("attendance").select("user_id, work_date, clock_in, clock_out, device_type, device_label, location_status, distance_m"),
    supabase.from("attendance_events").select("user_id, event_type, occurred_at, location_verified, distance_m"),
    supabase.from("task_time_logs").select("user_id, video_id, stage, seconds, started_at, ended_at"),
    supabase.from("clients").select("id, name, quota_videos, quota_posters, video_unit_price, video_discount_percent"),
    supabase.from("staff_compensation_rules").select("*"),
    supabase.from("sunday_duty_credits").select("*"),
  ]);
  return <RealReportsView generatedAt={new Date().toISOString()} people={people || []} videos={videos || []} attendance={attendance || []} attendanceEvents={attendanceEvents || []} logs={logs || []} clients={clients || []} compensationRules={compensationRules || []} sundayCredits={sundayCredits || []} />;
}
