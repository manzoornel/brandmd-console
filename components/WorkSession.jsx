"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clockOut } from "@/app/actions";

const IDLE_MS = 15 * 60 * 1000; // auto clock-out after 15 min idle

export default function WorkSession({ name }) {
  const router = useRouter();
  const [clock, setClock] = useState("");
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

  async function doSignOut() {
    await createClient().auth.signOut();
    router.push("/login"); router.refresh();
  }
  async function handleOut() {
    await clockOut(false); doSignOut();
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 12.5, color: "#6B7280" }}>
        <span className="signal-dot" />Clocked in · {clock}
      </span>
      <button className="btn btn-ghost" style={{ padding: "7px 12px", fontSize: 13 }} onClick={handleOut}>
        Clock out
      </button>
      <div className="me" title={name}>{(name || "?").split(" ").slice(-1)[0][0]}</div>
    </div>
  );
}
