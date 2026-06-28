"use client";
import { useState } from "react";
import { adminResetPassword } from "@/app/actions";

export default function ResetPasswordButton({ id, name }) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setMsg("");
    try { await adminResetPassword(id, pw); setMsg("Done ✓ Share the new password."); }
    catch (e) { setMsg(e.message); }
    setBusy(false);
  }
  if (!open)
    return <button className="btn btn-ghost" style={{ padding: "5px 11px", fontSize: 12.5 }} onClick={() => setOpen(true)}>Reset password</button>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input className="input" style={{ width: 150, padding: "6px 10px" }} placeholder="new password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="cta" style={{ padding: "6px 12px", fontSize: 12.5 }} disabled={busy} onClick={go}>Set</button>
        <button className="btn btn-ghost" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => { setOpen(false); setMsg(""); setPw(""); }}>×</button>
      </div>
      {msg && <span style={{ fontSize: 11.5, color: msg.includes("✓") ? "#0F9B68" : "#B42318" }}>{msg}</span>}
    </div>
  );
}
