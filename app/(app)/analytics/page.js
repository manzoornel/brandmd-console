import { createClient, getProfile } from "@/lib/supabase/server";
import AnalyticsView from "@/components/AnalyticsView";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const profile = await getProfile();
  const supabase = createClient();
  let q = supabase.from("videos").select("id, title, client_id, yt_views, ig_views, fb_views").eq("stage", "published");
  if ((profile.roles || []).includes("client") && profile.client_id) q = q.eq("client_id", profile.client_id);
  const [{ data: vids }, { data: clients }] = await Promise.all([
    q.order("posted_at", { ascending: false }),
    supabase.from("clients").select("id, name"),
  ]);
  return (
    <div className="body">
      <h1>Analytics</h1>
      <p className="sub">Views per doctor. Click a doctor to see their videos. Auto-pull from YouTube once the API key is set.</p>
      <AnalyticsView videos={vids || []} clients={clients || []} />
    </div>
  );
}
