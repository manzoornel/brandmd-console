"use client";
import { useState } from "react";
import { addClient } from "@/app/actions";

export default function AddClientForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function action(fd) {
    setBusy(true); setErr("");
    try { await addClient(fd); setOpen(false); }
    catch (e) { setErr(e.message || "Could not add doctor"); }
    setBusy(false);
  }
  if (!open) return <button className="cta" onClick={() => setOpen(true)}>+ Add doctor</button>;
  return (
    <form action={action} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginTop: 16, maxWidth: 640 }}>
      <h2>Add a doctor</h2>
      <label className="lbl">Name</label>
      <input className="input" name="name" required placeholder="Dr. Name" />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Type</label>
          <select className="input" name="type"><option value="external">Client (external)</option><option value="internal">In-house</option></select>
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Package name</label>
          <input className="input" name="package" placeholder="e.g. Growth" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Videos / month</label>
          <input className="input" name="quota_videos" type="number" min="0" defaultValue="0" />
        </div>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Posters / month</label>
          <input className="input" name="quota_posters" type="number" min="0" defaultValue="0" />
        </div>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13.5, color: "#475569" }}>
        <input type="checkbox" name="self_approver" /> This doctor approves their own content
      </label>
      {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
      <div className="mbtns">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save doctor"}</button>
      </div>
    </form>
  );
}
