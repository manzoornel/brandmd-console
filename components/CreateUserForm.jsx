"use client";
import { useState } from "react";
import { createUser } from "@/app/actions";
import { ROLES, ASSIGNABLE_ROLES } from "@/lib/roles";

export default function CreateUserForm({ clients }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function action(fd) {
    setBusy(true); setErr("");
    try { await createUser(fd); setOpen(false); }
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
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 180 }}><label className="lbl">Temp password</label><input className="input" name="password" minLength={6} required placeholder="min 6 chars" /></div>
        <div style={{ flex: 1, minWidth: 180 }}>
          <label className="lbl">Role</label>
          <select className="input" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLES[r]}</option>)}
          </select>
        </div>
      </div>
      {role === "client" && (
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
