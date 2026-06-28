"use client";
import { useState, useMemo } from "react";
import { fmt } from "@/lib/format";

export default function AnalyticsView({ videos, clients }) {
  const [open, setOpen] = useState({});
  const nameOf = (id) => clients.find((c) => c.id === id)?.name || "— No doctor —";

  const groups = useMemo(() => {
    const g = {};
    videos.forEach((v) => { (g[v.client_id] || (g[v.client_id] = [])).push(v); });
    return Object.entries(g).map(([cid, arr]) => {
      const yt = arr.reduce((a, v) => a + (v.yt_views || 0), 0);
      const ig = arr.reduce((a, v) => a + (v.ig_views || 0), 0);
      const fb = arr.reduce((a, v) => a + (v.fb_views || 0), 0);
      return { cid, name: nameOf(cid), items: arr, yt, ig, fb, total: yt + ig + fb };
    }).sort((a, b) => b.total - a.total);
  }, [videos, clients]);

  const sum = (k) => videos.reduce((a, v) => a + (v[k] || 0), 0);
  const totals = [["YouTube", sum("yt_views")], ["Instagram", sum("ig_views")], ["Facebook", sum("fb_views")],
    ["Total", sum("yt_views") + sum("ig_views") + sum("fb_views")]];

  return (
    <div>
      <div className="statrow">
        {totals.map(([k, v]) => (
          <div className="statbox" key={k} style={{ flex: 1, minWidth: 130 }}>
            <div className="statnum">{fmt(v)}</div><div className="statlbl">{k} views</div>
          </div>
        ))}
      </div>

      <h2 style={{ marginTop: 28 }}>By doctor</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
        {groups.map((g) => {
          const expanded = open[g.cid];
          return (
            <div key={g.cid} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 13, overflow: "hidden" }}>
              <button onClick={() => setOpen((o) => ({ ...o, [g.cid]: !o[g.cid] }))}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "none", padding: "14px 16px", textAlign: "left", flexWrap: "wrap" }}>
                <span style={{ color: "#94A3B8", fontSize: 12 }}>{expanded ? "▾" : "▸"}</span>
                <span style={{ fontWeight: 700, color: "var(--ink)", flex: 1, minWidth: 140 }}>{g.name}</span>
                <span style={{ fontSize: 12.5, color: "#475569" }}>{g.items.length} videos</span>
                <span className="tag" style={{ background: "rgba(255,0,0,.08)", color: "#C4302B" }}>YT {fmt(g.yt)}</span>
                <span className="tag" style={{ background: "rgba(225,48,108,.1)", color: "#C13584" }}>IG {fmt(g.ig)}</span>
                <span className="tag" style={{ background: "rgba(24,119,242,.1)", color: "#1877F2" }}>FB {fmt(g.fb)}</span>
                <span className="tag" style={{ background: "rgba(91,71,251,.12)", color: "#4938D6", fontWeight: 750 }}>Total {fmt(g.total)}</span>
              </button>
              {expanded && (
                <table className="tbl" style={{ border: "none", borderRadius: 0 }}>
                  <thead><tr><th>Video</th><th>YT</th><th>IG</th><th>FB</th><th>Total</th></tr></thead>
                  <tbody>
                    {g.items.map((v) => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>{v.title}</td>
                        <td>{fmt(v.yt_views)}</td><td>{fmt(v.ig_views)}</td><td>{fmt(v.fb_views)}</td>
                        <td style={{ fontWeight: 700 }}>{fmt(v.yt_views + v.ig_views + v.fb_views)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          );
        })}
        {groups.length === 0 && <p className="sub">No published videos yet.</p>}
      </div>
    </div>
  );
}
