"use client";
import { useState } from "react";
import { createUser } from "@/app/actions";
import { ROLES, ASSIGNABLE_ROLES } from "@/lib/roles";

export default function CreateUserForm({ clients }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(["editor"]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (r) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  async function action(fd) {
    setBusy(true); setErr("");
    try { await createUser(fd); setOpen(false); setPicked(["editor"]); }
    catch (e) { setErr(e.message || "Could not create user"); }
    setBusy(false);
  }
  if (!open) return <button className="cta" onClick={() => setOpen(true)}>+ Create user</button>;
  return (
    <form action={action} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 20, marginTop: 16, maxWidth: 640 }}>
      <h2>Create a user</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}><label className="lbl">Full name</label><input className="input" name="full_name" required /></div>
        <div style={{ flex: 1, minWidth: 180 }}><label className="lbl">Email</label><input className="input" name="email" type="email" required /></div>
      </div>
      <div style={{ flex: 1, minWidth: 180 }}><label className="lbl">Temporary password</label><input className="input" name="password" minLength={6} required placeholder="min 6 chars — they can change it later" /></div>
      <label className="lbl">Roles (tick one or more — a person can do several jobs)</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {ASSIGNABLE_ROLES.map((r) => (
          <label key={r} style={{ display: "flex", alignItems: "center", gap: 7, border: "1px solid var(--border)", borderRadius: 9, padding: "8px 12px", fontSize: 13.5, cursor: "pointer", background: picked.includes(r) ? "rgba(91,71,251,.08)" : "#fff" }}>
            <input type="checkbox" name="roles" value={r} checked={picked.includes(r)} onChange={() => toggle(r)} />
            {ROLES[r]}
          </label>
        ))}
      </div>
      {picked.includes("client") && (
        <div><label className="lbl">Which doctor is this login for?</label>
          <select className="input" name="client_id">
            {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      )}
      {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
      <div className="mbtns">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="cta" disabled={busy}>{busy ? "Creating…" : "Create user"}</button>
      </div>
    </form>
  );
}
