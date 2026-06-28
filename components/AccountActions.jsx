"use client";
import { useState } from "react";
import { recordPayment, setFollowUp } from "@/app/actions";

export default function AccountActions({ client }) {
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function pay(fd) {
    setBusy(true); setErr("");
    try { await recordPayment(fd); setMode(null); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  async function fup(fd) {
    setBusy(true); setErr("");
    try { await setFollowUp(fd); setMode(null); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  return (
    <>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="cta" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={() => setMode("pay")}>Record payment</button>
        <button className="btn btn-ghost" style={{ padding: "6px 12px", fontSize: 12.5 }} onClick={() => setMode("fup")}>Follow-up</button>
      </div>

      {mode === "pay" && (
        <Overlay onClose={() => setMode(null)}>
          <form action={pay}>
            <input type="hidden" name="client_id" value={client.id} />
            <div className="eyebrow">Record payment</div>
            <h2 className="mtitle">{client.name}</h2>
            <label className="lbl">Amount received (₹)</label>
            <input className="input" name="amount" type="number" min="1" required placeholder="e.g. 10000" />
            <label className="lbl">Note (optional)</label>
            <input className="input" name="note" placeholder="e.g. Advance via UPI" />
            {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
            <div className="mbtns">
              <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>Cancel</button>
              <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save payment"}</button>
            </div>
          </form>
        </Overlay>
      )}

      {mode === "fup" && (
        <Overlay onClose={() => setMode(null)}>
          <form action={fup}>
            <input type="hidden" name="client_id" value={client.id} />
            <div className="eyebrow">Follow-up / call</div>
            <h2 className="mtitle">{client.name}</h2>
            <label className="lbl">Call back on</label>
            <input className="input" name="follow_up_date" type="date" defaultValue={client.follow_up_date || ""} />
            <label className="lbl">Note</label>
            <input className="input" name="follow_up_note" defaultValue={client.follow_up_note || ""} placeholder="e.g. Promised balance by month-end" />
            {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
            <div className="mbtns">
              <button type="button" className="btn btn-ghost" onClick={() => setMode(null)}>Cancel</button>
              <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save follow-up"}</button>
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
