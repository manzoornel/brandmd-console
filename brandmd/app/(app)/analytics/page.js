import { createClient, getProfile } from "@/lib/supabase/server";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const profile = await getProfile();
  const supabase = createClient();
  let q = supabase.from("videos").select("*").eq("stage", "published");
  if ((profile.roles || []).includes("client") && profile.client_id) q = q.eq("client_id", profile.client_id);
  const [{ data: vids }, { data: clients }] = await Promise.all([
    q.order("posted_at", { ascending: false }),
    supabase.from("clients").select("id, name"),
  ]);
  const cname = (id) => clients?.find((c) => c.id === id)?.name || "—";
  const sum = (k) => (vids || []).reduce((a, v) => a + (v[k] || 0), 0);
  const totals = [
    ["YouTube", sum("yt_views")], ["Instagram", sum("ig_views")],
    ["Facebook", sum("fb_views")],
    ["Total", sum("yt_views") + sum("ig_views") + sum("fb_views")],
  ];
  return (
    <div className="body">
      <h1>Analytics</h1>
      <p className="sub">Views across published videos. Auto-pull from YouTube once the API key is set (Phase 3).</p>
      <div className="statrow">
        {totals.map(([k, v]) => (
          <div className="statbox" key={k} style={{ flex: 1, minWidth: 130 }}>
            <div className="statnum">{fmt(v)}</div><div className="statlbl">{k} views</div>
          </div>
        ))}
      </div>
      <h2 style={{ marginTop: 28 }}>Published videos</h2>
      <table className="tbl">
        <thead><tr><th>Video</th><th>Doctor</th><th>YT</th><th>IG</th><th>FB</th><th>Total</th></tr></thead>
        <tbody>
          {(vids || []).map((v) => (
            <tr key={v.id}>
              <td style={{ fontWeight: 600 }}>{v.title}</td>
              <td>{cname(v.client_id)}</td>
              <td>{fmt(v.yt_views)}</td><td>{fmt(v.ig_views)}</td><td>{fmt(v.fb_views)}</td>
              <td style={{ fontWeight: 700 }}>{fmt(v.yt_views + v.ig_views + v.fb_views)}</td>
            </tr>
          ))}
          {(vids || []).length === 0 && <tr><td colSpan="6" style={{ color: "#9aa1b3" }}>No published videos yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
