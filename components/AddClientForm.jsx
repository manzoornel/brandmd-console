"use client";
import { useState } from "react";
import { addClient } from "@/app/actions";

export default function AddClientForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function action(fd) { setBusy(true); await addClient(fd); setBusy(false); setOpen(false); }
  if (!open) return <button className="cta" onClick={() => setOpen(true)}>+ Add doctor</button>;
  return (
    <form action={action} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginTop: 16, maxWidth: 640 }}>
      <h2>Add a doctor</h2>
      <label className="lbl">Name</label>
      <input className="input" name="name" required placeholder="Dr. Name" />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label className="lbl">Type</label>
          <select className="input" name="type"><option value="external">Client (external)</option><option value="internal">In-house</option></select>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label className="lbl">Package</label>
          <input className="input" name="package" placeholder="e.g. 8 reels/mo" />
        </div>
      </div>
      <div className="mbtns">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save doctor"}</button>
      </div>
    </form>
  );
}
