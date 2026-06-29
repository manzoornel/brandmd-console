"use client";

import { useState } from "react";
import { editClient, deleteClient } from "@/app/actions";

export default function DoctorActions({ client, packages = [], firms = [] }) {
  const [mode, setMode] = useState(null); // 'edit' | 'confirm' | null
  const [pkgId, setPkgId] = useState(client.package_id || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const c = client;

  async function save(fd) {
    setBusy(true); setErr("");
    try { await editClient(fd); setMode(null); }
    catch (e) { setErr(e.message || "Could not save"); }
    setBusy(false);
  }
  async function remove() {
    setBusy(true);
    try { await deleteClient(c.id); setMode(null); }
    catch (e) { setErr(e.message); setBusy(false); }
  }
  const usingPkg = !!pkgId;

  return (
    <>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button className="btn btn-ghost" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => setMode("edit")}>Edit</button>
        <button className="btn btn-danger" style={{ padding: "5px 12px", fontSize: 12.5 }} onClick={() => setMode("confirm")}>Delete</button>
      </div>

      {mode === "confirm" && (
        <Overlay onClose={() => setMode(null)}>
          <div className="eyebrow">Delete doctor</div>
          <h2 className="mtitle">Remove {c.name}?</h2>
          <p className="hint">Their items stay in the pipeline but lose the doctor link. This can't be undone.</p>
          {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
          <div className="mbtns">
            <button className="btn btn-ghost" onClick={() => setMode(null)}>Cancel</button>
            <button className="btn btn-danger" disabled={busy} onClick={remove}>{busy ? "Deleting…" : "Yes, delete"}</button>
          </div>
        </Overlay>
      )}

      {mode === "edit" && (
        <Overlay onClose={() => setMode(null)}>
          <form action={save}>
            <input type="hidden" name="id" value={c.id} />
            <div className="eyebrow">Edit doctor</div>
            <h2 className="mtitle">{c.name}</h2>
            <label className="lbl">Name</label>
            <input className="input" name="name" defaultValue={c.name} required />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label className="lbl">Type</label>
                <select className="input" name="type" defaultValue={c.type}>
                  <option value="external">Client (external)</option>
                  <option value="internal">In-house</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 150 }}>
                <label className="lbl">Package (from catalog)</label>
                <select className="input" name="package_id" value={pkgId} onChange={(e) => setPkgId(e.target.value)}>
                  <option value="">— Custom —</option>
                  {packages.map((p) => <option key={p.id} value={p.id}>{p.name} · ₹{Number(p.price).toLocaleString("en-IN")}</option>)}
                </select>
              </div>
            </div>
            {usingPkg ? (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label className="lbl">Discount (₹)</label>
                  <input className="input" name="discount" type="number" min="0" defaultValue={c.discount || 0} />
                </div>
                <div style={{ flex: 1, minWidth: 150 }}>
                  <label className="lbl">Label (optional)</label>
                  <input className="input" name="package" defaultValue={c.package} />
                </div>
              </div>
            ) : (
              <>
                <label className="lbl">Custom package label</label>
                <input className="input" name="package" defaultValue={c.package} />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 110 }}><label className="lbl">Videos / month</label><input className="input" name="quota_videos" type="number" min="0" defaultValue={c.quota_videos} /></div>
                  <div style={{ flex: 1, minWidth: 110 }}><label className="lbl">Posters / month</label><input className="input" name="quota_posters" type="number" min="0" defaultValue={c.quota_posters} /></div>
                  <div style={{ flex: 1, minWidth: 110 }}><label className="lbl">Price (₹)</label><input className="input" name="price" type="number" min="0" defaultValue={c.price} /></div>
                </div>
              </>
            )}
            <div style={{ background: "#F7F8FC", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px", marginTop: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#475569" }}>
                <input type="checkbox" name="is_firm" defaultChecked={c.is_firm} /> This is a <b>firm / hospital</b> (groups several doctors under it)
              </label>
              <label className="lbl" style={{ marginTop: 12 }}>Belongs to a firm / hospital (optional)</label>
              <select className="input" name="parent_id" defaultValue={c.parent_id || ""}>
                <option value="">— Standalone (no firm) —</option>
                {firms.filter((f) => f.id !== c.id).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13.5, color: "#475569" }}>
              <input type="checkbox" name="self_approver" defaultChecked={c.self_approver} /> This doctor approves their own content
            </label>
            {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
            <div className="mbtns">
              <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>Cancel</button>
              <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </Overlay>
      )}
    </>
  );
}

function Overlay({ children, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="closeX" onClick={onClose}>×</button>
        {children}
      </div>
    </div>
  );
}
