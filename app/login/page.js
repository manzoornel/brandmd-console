"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clockIn } from "@/app/actions";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (busy) return;
    setErr(""); setBusy(true);

    try {
      const supabase = createClient();
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Sign-in is taking too long. Please check your connection and try again.")), 15000);
      });
      const { error } = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        timeout,
      ]);

      if (error) throw error;

      // Attendance must never delay access to the workspace.
      clockIn().catch(() => {});
      window.location.replace("/dashboard");
    } catch (error) {
      setErr(error?.message || "Unable to sign in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div style={S.wrap}>
      <div style={{ ...S.glow, ...S.gA }} />
      <div style={{ ...S.glow, ...S.gB }} />
      <div style={S.card}>
        <Logo size={56} />
        <h1 style={S.title}>Brand MD Solutions</h1>
        <p style={S.sub}>Content Operations Console</p>

        <label className="lbl">Email</label>
        <input className="input" type="email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="you@brandmd.in" />
        <label className="lbl">Password</label>
        <input className="input" type="password" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••••••" />

        {err && <div style={S.err}>{err}</div>}

        <button className="cta btn-block" style={{ marginTop: 18 }} disabled={busy} onClick={submit}>
          {busy ? "Signing in…" : "Sign in →"}
        </button>
        <p style={S.note}>
          Logging in marks your attendance for the day. Accounts are created by your admin.
        </p>
      </div>
    </div>
  );
}

const S = {
  wrap: { minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, position: "relative", overflow: "hidden",
    background: "radial-gradient(120% 120% at 50% 0%, #221E3E 0%, #141124 55%, #0E0C1B 100%)" },
  glow: { position: "absolute", borderRadius: "50%", filter: "blur(80px)" },
  gA: { width: 340, height: 340, background: "#5B47FB", top: -80, left: -60, opacity: .5 },
  gB: { width: 300, height: 300, background: "#FF6A5A", bottom: -90, right: -50, opacity: .35 },
  card: { position: "relative", background: "#fff", borderRadius: 22, padding: 36, width: "min(420px,100%)",
    boxShadow: "0 30px 80px rgba(0,0,0,.5)" },
  title: { fontSize: 22, fontWeight: 780, color: "#17152A", margin: "18px 0 2px", letterSpacing: "-.5px" },
  sub: { fontSize: 13.5, color: "#6B7280", margin: "0 0 18px" },
  err: { marginTop: 12, background: "#FDECEC", color: "#B42318", borderRadius: 8, padding: "9px 12px", fontSize: 13 },
  note: { fontSize: 11.5, color: "#9AA0AE", marginTop: 16, lineHeight: 1.5 },
};

