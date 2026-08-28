"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    const message = String(error?.message || error || "");
    const looksLikeStaleBuild = /chunk|loading|not a function|module/i.test(message);
    const alreadyReloaded = sessionStorage.getItem("brandmd-build-reload");

    if (looksLikeStaleBuild && !alreadyReloaded) {
      sessionStorage.setItem("brandmd-build-reload", "1");
      window.location.reload();
      return;
    }

    sessionStorage.removeItem("brandmd-build-reload");
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#141124", color: "#fff" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <div style={{ width: "min(440px, 100%)", background: "#fff", color: "#17152A", borderRadius: 18, padding: 28 }}>
            <h1 style={{ marginTop: 0, fontSize: 22 }}>Brand MD needs a quick refresh</h1>
            <p style={{ color: "#667085", lineHeight: 1.6 }}>Your work is safe. Refresh the latest version and continue.</p>
            <button onClick={() => window.location.reload()} style={{ border: 0, borderRadius: 10, padding: "11px 16px", background: "#5B47FB", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Refresh workspace</button>
            <button onClick={reset} style={{ marginLeft: 8, border: "1px solid #D0D5DD", borderRadius: 10, padding: "10px 16px", background: "#fff", color: "#344054", fontWeight: 700, cursor: "pointer" }}>Try again</button>
          </div>
        </main>
      </body>
    </html>
  );
}

