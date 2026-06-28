"use client";
import { useState } from "react";
import { updateUser } from "@/app/actions";
import { ROLES, ASSIGNABLE_ROLES } from "@/lib/roles";

export default function EditUserForm({ user, clients }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(user.roles || []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const toggle = (r) => setPicked((p) => (p.includes(r) ? p.filter((x) => x !== r) : [...p, r]));
  async function action(fd) {
    setBusy(true); setErr("");
    try { await updateUser(fd); setOpen(false); }
    catch (e) { setErr(e.message || "Could not save"); }
    setBusy(false);
  }
  return (
    <>
      <button className="btn btn-ghost" style={{ padding: "5px 11px", fontSize: 12.5 }} onClick={() => setOpen(true)}>Edit</button>
      {open && (
        <div className="overlay" onClick={() => setOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="closeX" onClick={() => setOpen(false)}>×</button>
            <form action={action}>
              <input type="hidden" name="id" value={user.id} />
              <div className="eyebrow">Edit user</div>
              <h2 className="mtitle">{user.full_name}</h2>
              <label className="lbl">Full name</label>
              <input className="input" name="full_name" defaultValue={user.full_name} required />
              <label className="lbl">Roles (tick one or more)</label>
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
                  <select className="input" name="client_id" defaultValue={user.client_id || ""}>
                    {(clients || []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
              <div className="mbtns">
                <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
