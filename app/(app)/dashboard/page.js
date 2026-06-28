import { createClient, getProfile } from "@/lib/supabase/server";
import Board from "@/components/Board";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getProfile();
  const supabase = createClient();
  const [{ data: videos }, { data: clients }, { data: people }] = await Promise.all([
    supabase.from("videos").select("*").order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name, type"),
    supabase.from("profiles").select("id, full_name, roles"),
  ]);
  return (
    <Board
      roles={profile.roles}
      myId={profile.id}
      myClientId={profile.client_id}
      videos={videos || []}
      clients={clients || []}
      people={(people || []).map((p) => ({ ...p, roles: p.roles || [] }))}
    />
  );
}
