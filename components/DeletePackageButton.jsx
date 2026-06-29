"use client";
import { useState } from "react";
import { deletePackage } from "@/app/actions";

export default function DeletePackageButton({ id, name }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirm)
    return <button className="btn btn-danger" style={{ padding: "5px 11px", fontSize: 12.5 }} onClick={() => setConfirm(true)}>Delete</button>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span style={{ fontSize: 12, color: "#B42318" }}>Sure?</span>
      <button className="btn btn-danger" style={{ padding: "5px 10px", fontSize: 12 }} disabled={busy}
        onClick={async () => { setBusy(true); await deletePackage(id); }}>Yes</button>
      <button className="btn btn-ghost" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => setConfirm(false)}>No</button>
    </span>
  );
}
