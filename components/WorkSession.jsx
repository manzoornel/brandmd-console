"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clockIn, clockOut } from "@/app/actions";

const IDLE_MS = 15 * 60 * 1000; // auto clock-out after 15 min idle

export default function WorkSession({ name }) {
  const router = useRouter();
  const [clock, setClock] = useState("");
  const [locationWarning, setLocationWarning] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const idle = useRef(null);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    tick(); const t = setInterval(tick, 30000);

    const reset = () => {
      if (idle.current) clearTimeout(idle.current);
      idle.current = setTimeout(async () => { await clockOut(true); doSignOut(); }, IDLE_MS);
    };
    const evts = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    evts.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => { clearInterval(t); evts.forEach((e) => window.removeEventListener(e, reset)); if (idle.current) clearTimeout(idle.current); };
  }, []);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const base = {
      device_type: /Android|iPhone|iPad|Mobile/i.test(ua) ? "Phone / tablet" : "Computer",
      device_label: `${/iPhone|iPad/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : "Unknown OS"} · ${/Edg\//i.test(ua) ? "Edge" : /Chrome\//i.test(ua) ? "Chrome" : /Firefox\//i.test(ua) ? "Firefox" : /Safari\//i.test(ua) ? "Safari" : "Web browser"}`,
    };
    let live = true;
    const verify = () => {
      // Attendance is recorded even without GPS; GPS only verifies office presence.
      clockIn(base).catch(() => {});
      if (!navigator.geolocation) { if (live) { setLocationWarning(true); setLocationMessage("Location is not available on this device."); } return; }
      navigator.geolocation.getCurrentPosition(async p => {
        try {
          const result = await clockIn({ ...base, latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy_m: p.coords.accuracy });
          if (live) { setLocationWarning(!result?.verified); setLocationMessage(result?.verified ? "" : result?.locationStatus || "Location could not be verified."); }
        } catch (_) { if (live) { setLocationWarning(true); setLocationMessage("Attendance marked, but office location could not be verified."); } }
      }, () => { if (live) { setLocationWarning(true); setLocationMessage("Please allow location to verify BrandMD office attendance."); } }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
    };
    verify();
    const reminder = setInterval(verify, 30 * 60 * 1000);
    return () => { live = false; clearInterval(reminder); };
  }, []);

  async function doSignOut() {
    await createClient().auth.signOut();
    router.push("/login"); router.refresh();
  }
  async function handleOut() {
    await clockOut(false); doSignOut();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", position: "relative" }}>
      <span style={{ fontSize: 12.5, color: "#6B7280" }}>
        <span className="signal-dot" />Clocked in · {clock}
      </span>
      <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 13 }} onClick={handleOut}>
        Clock out
      </button>
      <div className="me" title={name}>{(name || "?").split(" ").slice(-1)[0][0]}</div>
      {locationWarning && <div role="alert" style={{ position:"fixed", right:18, top:72, zIndex:1000, maxWidth:360, background:"#FFF7ED", color:"#9A3412", border:"1px solid #FDBA74", padding:"12px 14px", borderRadius:12, boxShadow:"0 10px 30px rgba(0,0,0,.12)", fontSize:13 }}>
        <b>Location permission needed</b><div style={{marginTop:3}}>{locationMessage}</div>
        <button className="btn btn-ghost" style={{marginTop:8, padding:"6px 10px"}} onClick={() => window.location.reload()}>Allow / try again</button>
      </div>}
    </div>
  );
}

