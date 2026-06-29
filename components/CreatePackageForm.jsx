"use client";
import { useState } from "react";
import { createPackage } from "@/app/actions";

export default function CreatePackageForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function action(fd) {
    setBusy(true); setErr("");
    try { await createPackage(fd); setOpen(false); }
    catch (e) { setErr(e.message || "Could not save"); }
    setBusy(false);
  }
  if (!open) return <button className="cta" onClick={() => setOpen(true)}>+ New package</button>;
  return (
    <form action={action} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginTop: 16, maxWidth: 640 }}>
      <h2>Create a package</h2>
      <label className="lbl">Package name</label>
      <input className="input" name="name" required placeholder="e.g. Premium" />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="lbl">Videos / month</label>
          <input className="input" name="quota_videos" type="number" min="0" defaultValue="0" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="lbl">Posters / month</label>
          <input className="input" name="quota_posters" type="number" min="0" defaultValue="0" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="lbl">Price (₹)</label>
          <input className="input" name="price" type="number" min="0" defaultValue="0" />
        </div>
      </div>
      {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
      <div className="mbtns">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save package"}</button>
      </div>
    </form>
  );
}
