import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import { shortDate, dueInfo } from "@/lib/format";
import AccountActions from "@/components/AccountActions";

export const dynamic = "force-dynamic";
const rupee = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default async function AccountsPage() {
  const profile = await getProfile();
  if (!isAdmin(profile.roles)) redirect("/dashboard");
  const supabase = createClient();
  const [{ data: clients }, { data: payments }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at"),
    supabase.from("payments").select("client_id, amount, paid_at, note, method").order("paid_at", { ascending: false }),
  ]);
  const billed = (clients || []).filter((c) => Number(c.price) > 0);
  const collectedOf = (id) => (payments || []).filter((p) => p.client_id === id).reduce((a, p) => a + Number(p.amount), 0);
  const lastPay = (id) => (payments || []).find((p) => p.client_id === id);

  const totalDue = billed.reduce((a, c) => a + Number(c.price), 0);
  const totalCollected = billed.reduce((a, c) => a + collectedOf(c.id), 0);
  const totalOutstanding = totalDue - totalCollected;

  return (
    <div className="body">
      <h1>Accounts</h1>
      <p className="sub">What each doctor owes, what's collected, and who to follow up.</p>

      <div className="statrow">
        <div className="statbox" style={{ flex: 1, minWidth: 150 }}><div className="statnum">{rupee(totalDue)}</div><div className="statlbl">Total billed</div></div>
        <div className="statbox" style={{ flex: 1, minWidth: 150 }}><div className="statnum" style={{ color: "#0F9B68" }}>{rupee(totalCollected)}</div><div className="statlbl">Collected</div></div>
        <div className="statbox" style={{ flex: 1, minWidth: 150 }}><div className="statnum" style={{ color: "#B42318" }}>{rupee(totalOutstanding)}</div><div className="statlbl">Outstanding</div></div>
      </div>

      <table className="tbl" style={{ marginTop: 18 }}>
        <thead><tr><th>Doctor</th><th>Package</th><th>Total</th><th>Collected</th><th>Remaining</th><th>Last payment</th><th>Follow-up</th><th></th></tr></thead>
        <tbody>
          {billed.map((c) => {
            const collected = collectedOf(c.id);
            const remaining = Number(c.price) - collected;
            const fu = dueInfo(c.follow_up_date);
            return (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.name}</td>
                <td style={{ fontSize: 12.5, color: "#475569" }}>{c.package || "—"}</td>
                <td>{rupee(c.price)}</td>
                <td style={{ color: "#0F9B68" }}>{rupee(collected)}</td>
                <td style={{ fontWeight: 700, color: remaining > 0 ? "#B42318" : "#0F9B68" }}>{rupee(remaining)}</td>
                <td style={{ fontSize: 12 }}>{(() => { const lp = lastPay(c.id); return lp ? `${rupee(lp.amount)}${lp.method ? " · " + lp.method : ""}` : <span style={{ color: "#9aa1b3" }}>—</span>; })()}</td>
                <td style={{ fontSize: 12.5 }}>
                  {c.follow_up_date
                    ? <span style={{ color: fu?.level === "over" ? "#B42318" : "#475569" }}>📞 {shortDate(c.follow_up_date)}{c.follow_up_note ? ` · ${c.follow_up_note}` : ""}</span>
                    : <span style={{ color: "#9aa1b3" }}>—</span>}
                </td>
                <td style={{ textAlign: "right" }}><AccountActions client={c} /></td>
              </tr>
            );
          })}
          {billed.length === 0 && <tr><td colSpan="8" style={{ color: "#9aa1b3" }}>No paid packages yet. Set a price on a doctor under Doctors.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
