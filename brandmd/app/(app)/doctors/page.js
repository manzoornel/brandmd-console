import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import { fmt } from "@/lib/format";
import AddClientForm from "@/components/AddClientForm";

export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  const profile = await getProfile();
  const supabase = createClient();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const [{ data: clients }, { data: videos }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at"),
    supabase.from("videos").select("client_id, stage, item_type, yt_views, ig_views, fb_views, created_at"),
  ]);
  const stat = (c) => {
    const ts = (videos || []).filter((v) => v.client_id === c.id);
    const pub = ts.filter((v) => v.stage === "published");
    const views = pub.reduce((a, v) => a + v.yt_views + v.ig_views + v.fb_views, 0);
    const thisMonth = ts.filter((v) => v.created_at >= monthStart);
    const usedV = thisMonth.filter((v) => v.item_type === "video").length;
    const usedP = thisMonth.filter((v) => v.item_type === "poster").length;
    return { total: ts.length, pub: pub.length, views, usedV, usedP };
  };
  return (
    <div className="body">
      <div className="head">
        <div><h1>Doctors & packages</h1><p className="sub">In-house brands plus external doctors you produce for.</p></div>
        {isAdmin(profile.roles) && <AddClientForm />}
      </div>
      <div className="clientgrid">
        {(clients || []).map((c) => {
          const s = stat(c);
          const internal = c.type === "internal";
          return (
            <div className="clientcard" key={c.id}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tag" style={{ background: internal ? "rgba(24,181,122,.12)" : "rgba(91,71,251,.12)", color: internal ? "#0F9B68" : "#4938D6" }}>
                  {internal ? "In-house" : "Client"}
                </span>
                {c.self_approver && <span className="tag" style={{ background: "rgba(244,161,43,.14)", color: "#B45309" }}>Self-approves</span>}
              </div>
              <div className="cname">{c.name}</div>
              <div className="cpkg">{c.package || "—"}</div>
              {(c.quota_videos > 0 || c.quota_posters > 0) && (
                <div className="cpkg" style={{ color: "#475569" }}>
                  This month: {s.usedV}/{c.quota_videos} videos · {s.usedP}/{c.quota_posters} posters
                </div>
              )}
              <div className="cstats">
                <span><b>{s.total}</b> items</span><span><b>{s.pub}</b> live</span><span><b>{fmt(s.views)}</b> views</span>
              </div>
            </div>
          );
        })}
        {(clients || []).length === 0 && <p className="sub">No doctors yet.</p>}
      </div>
    </div>
  );
}
