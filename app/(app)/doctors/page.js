import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import { fmt } from "@/lib/format";
import AddClientForm from "@/components/AddClientForm";

export const dynamic = "force-dynamic";

export default async function DoctorsPage() {
  const profile = await getProfile();
  const supabase = createClient();
  const [{ data: clients }, { data: videos }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at"),
    supabase.from("videos").select("client_id, stage, yt_views, ig_views, fb_views"),
  ]);
  const stat = (cid) => {
    const ts = (videos || []).filter((v) => v.client_id === cid);
    const pub = ts.filter((v) => v.stage === "published");
    const views = pub.reduce((a, v) => a + v.yt_views + v.ig_views + v.fb_views, 0);
    return { total: ts.length, pub: pub.length, views };
  };
  return (
    <div className="body">
      <div className="head">
        <div><h1>Doctors & packages</h1><p className="sub">In-house brands plus external doctors you produce for.</p></div>
        {isAdmin(profile.role) && <AddClientForm />}
      </div>
      <div className="clientgrid">
        {(clients || []).map((c) => {
          const s = stat(c.id);
          const internal = c.type === "internal";
          return (
            <div className="clientcard" key={c.id}>
              <span className="tag" style={{ background: internal ? "rgba(24,181,122,.12)" : "rgba(91,71,251,.12)", color: internal ? "#0F9B68" : "#4938D6" }}>
                {internal ? "In-house" : "Client"}
              </span>
              <div className="cname">{c.name}</div>
              <div className="cpkg">{c.package || "—"}</div>
              <div className="cstats">
                <span><b>{s.total}</b> videos</span><span><b>{s.pub}</b> live</span><span><b>{fmt(s.views)}</b> views</span>
              </div>
            </div>
          );
        })}
        {(clients || []).length === 0 && <p className="sub">No doctors yet.</p>}
      </div>
    </div>
  );
}
