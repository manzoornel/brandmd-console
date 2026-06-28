"use client";
import { setUserActive } from "@/app/actions";
export default function UserActiveToggle({ id, active }) {
  return (
    <button className="btn btn-ghost" style={{ padding: "5px 11px", fontSize: 12.5 }}
      onClick={() => setUserActive(id, !active)}>
      {active ? "Deactivate" : "Activate"}
    </button>
  );
}
