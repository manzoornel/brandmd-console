"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ChangePasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState(null); // {ok, text}
  const [busy, setBusy] = useState(false);
  async function save() {
    if (pw.length < 6) return setMsg({ ok: false, text: "Password must be at least 6 characters." });
    if (pw !== pw2) return setMsg({ ok: false, text: "The two passwords don't match." });
    setBusy(true); setMsg(null);
    const { error } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (error) setMsg({ ok: false, text: error.message });
    else { setMsg({ ok: true, text: "Password changed. Use it next time you sign in." }); setPw(""); setPw2(""); }
  }
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 14, padding: 22, maxWidth: 460 }}>
      <h2>Change my password</h2>
      <label className="lbl">New password</label>
      <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="at least 6 characters" />
      <label className="lbl">Confirm new password</label>
      <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
      {msg && <p className="hint" style={{ color: msg.ok ? "#0F9B68" : "#B42318" }}>{msg.text}</p>}
      <div className="mbtns"><button className="cta" disabled={busy} onClick={save}>{busy ? "Saving…" : "Update password"}</button></div>
    </div>
  );
}
