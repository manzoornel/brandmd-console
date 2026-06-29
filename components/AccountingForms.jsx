"use client";

import { useState } from "react";
import {
  addExpense, deleteExpense, addAsset, deleteAsset, addPartner, deletePartner,
} from "@/app/actions";

const CATEGORIES = ["Rent", "Electricity", "Salary", "Tools / Subscriptions", "Maintenance", "Food", "Travel", "Other"];

export function AddExpenseForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function action(fd) {
    setBusy(true); setErr("");
    try { await addExpense(fd); setOpen(false); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  if (!open) return <button className="cta" onClick={() => setOpen(true)}>+ Add expense</button>;
  return (
    <form action={action} style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 150 }}>
          <label className="lbl">Category</label>
          <select className="input" name="category">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="lbl">Amount (₹)</label>
          <input className="input" name="amount" type="number" min="1" required />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label className="lbl">Date</label>
          <input className="input" name="spent_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>
      <label className="lbl">Note (optional)</label>
      <input className="input" name="note" placeholder="e.g. June office rent" />
      {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
      <div className="mbtns">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save expense"}</button>
      </div>
    </form>
  );
}

export function AddAssetForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function action(fd) {
    setBusy(true); setErr("");
    try { await addAsset(fd); setOpen(false); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  if (!open) return <button className="cta" onClick={() => setOpen(true)}>+ Add asset</button>;
  return (
    <form action={action} style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 180 }}>
          <label className="lbl">Asset name</label>
          <input className="input" name="name" required placeholder="e.g. Sony A7 IV camera" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="lbl">Value (₹)</label>
          <input className="input" name="value" type="number" min="0" defaultValue="0" />
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label className="lbl">Acquired</label>
          <input className="input" name="acquired_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>
      <label className="lbl">Note (optional)</label>
      <input className="input" name="note" placeholder="e.g. Bought for shoots" />
      {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
      <div className="mbtns">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save asset"}</button>
      </div>
    </form>
  );
}

export function AddPartnerForm() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function action(fd) {
    setBusy(true); setErr("");
    try { await addPartner(fd); setOpen(false); } catch (e) { setErr(e.message); }
    setBusy(false);
  }
  if (!open) return <button className="cta" onClick={() => setOpen(true)}>+ Add partner</button>;
  return (
    <form action={action} style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 180 }}>
          <label className="lbl">Partner name</label>
          <input className="input" name="name" required placeholder="e.g. Dr. Manzoor" />
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <label className="lbl">Share (%)</label>
          <input className="input" name="share_pct" type="number" min="0" max="100" step="0.1" required />
        </div>
      </div>
      {err && <p className="hint" style={{ color: "#B42318" }}>{err}</p>}
      <div className="mbtns">
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
        <button className="cta" disabled={busy}>{busy ? "Saving…" : "Save partner"}</button>
      </div>
    </form>
  );
}

function ConfirmDelete({ onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirm) return <button className="btn btn-danger" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => setConfirm(true)}>Delete</button>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#B42318" }}>Sure?</span>
      <button className="btn btn-danger" style={{ padding: "4px 9px", fontSize: 12 }} disabled={busy} onClick={async () => { setBusy(true); await onDelete(); }}>Yes</button>
      <button className="btn btn-ghost" style={{ padding: "4px 9px", fontSize: 12 }} onClick={() => setConfirm(false)}>No</button>
    </span>
  );
}

export function DeleteExpenseButton({ id }) { return <ConfirmDelete onDelete={() => deleteExpense(id)} />; }
export function DeleteAssetButton({ id }) { return <ConfirmDelete onDelete={() => deleteAsset(id)} />; }
export function DeletePartnerButton({ id }) { return <ConfirmDelete onDelete={() => deletePartner(id)} />; }
