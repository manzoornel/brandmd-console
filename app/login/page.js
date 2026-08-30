"use client";

import { useState } from "react";
import { clockIn, loginWithPassword } from "@/app/actions";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  function loginContext() {
    const ua = navigator.userAgent || "";
    const device_type = /Android|iPhone|iPad|Mobile/i.test(ua) ? "Phone / tablet" : "Computer";
    const os = /iPhone|iPad/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "Unknown OS";
    const browser = /Edg\//i.test(ua) ? "Edge" : /Chrome\//i.test(ua) ? "Chrome" : /Firefox\//i.test(ua) ? "Firefox" : /Safari\//i.test(ua) ? "Safari" : "Web browser";
    const base = { device_type, device_label: `${os} · ${browser}`, latitude: null, longitude: null, accuracy_m: null };
    if (!navigator.geolocation) return Promise.resolve(base);
    return new Promise(resolve => navigator.geolocation.getCurrentPosition(
      p => resolve({ ...base, latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy_m: p.coords.accuracy }),
      () => resolve(base), { enableHighAccuracy: true, timeout: 2500, maximumAge: 60000 }
    ));
  }

  async function submit() {
    if (busy) return;
    setErr(""); setBusy(true);

    try {
      const contextPromise = loginContext();
      const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Sign-in is taking too long. Please check your connection and try again.")), 15000);
      });
      const result = await Promise.race([
        loginWithPassword(email, password),
        timeout,
      ]);

      if (result?.error) throw new Error(result.error);

      // Record device and office verification, but never let attendance block access.
      const context = await contextPromise;
      await Promise.race([clockIn(context), new Promise(resolve => setTimeout(resolve, 1800))]).catch(() => {});
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
