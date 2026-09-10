import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import { shortDate, dueInfo } from "@/lib/format";
import AccountActions from "@/components/AccountActions";
import MonthlyInvoices from "@/components/MonthlyInvoices";
import {
  AddExpenseForm, DeleteExpenseButton,
  AddAssetForm, DeleteAssetButton,
  AddPartnerForm, DeletePartnerButton,
} from "@/components/AccountingForms";

export const dynamic = "force-dynamic";
const rupee = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default async function AccountsPage() {
  const profile = await getProfile();
  if (!isAdmin(profile.roles)) redirect("/dashboard");
  const supabase = createClient();
  const [{ data: clients }, { data: payments }, { data: expenses }, { data: assets }, { data: partners }, { data: invoices }] = await Promise.all([
    supabase.from("clients").select("*").order("created_at"),
    supabase.from("payments").select("client_id, amount, paid_at, note, method").order("paid_at", { ascending: false }),
    supabase.from("expenses").select("*").order("spent_at", { ascending: false }),
    supabase.from("assets").select("*").order("acquired_at", { ascending: false }),
    supabase.from("partners").select("*").order("created_at"),
    supabase.from("invoices").select("*").order("period_start", { ascending: false }),
  ]);

  const billed = (clients || []).filter((c) => Number(c.price) > 0);
  const collectedOf = (id) => (payments || []).filter((p) => p.client_id === id).reduce((a, p) => a + Number(p.amount), 0);
  const lastPay = (id) => (payments || []).find((p) => p.client_id === id);

  const totalDue = billed.reduce((a, c) => a + Number(c.price), 0);
  const totalCollected = (payments || []).reduce((a, p) => a + Number(p.amount), 0);
  const totalOutstanding = totalDue - billed.reduce((a, c) => a + collectedOf(c.id), 0);
  const totalExpenses = (expenses || []).reduce((a, e) => a + Number(e.amount), 0);
  const totalAssets = (assets || []).reduce((a, e) => a + Number(e.value), 0);
  const netProfit = totalCollected - totalExpenses;

  // expenses grouped by category
  const byCat = {};
  (expenses || []).forEach((e) => { byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount); });
  const catList = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

  return (
    <div className="body">
      <h1>Accounts</h1>
      <p className="sub">Money in, money out, what you own, and how profit splits.</p>

      {/* summary */}
      <div className="statrow">
        <div className="statbox" style={{ flex: 1, minWidth: 140 }}><div className="statnum" style={{ color: "#0F9B68" }}>{rupee(totalCollected)}</div><div className="statlbl">Collected</div></div>
        <div className="statbox" style={{ flex: 1, minWidth: 140 }}><div className="statnum" style={{ color: "#B42318" }}>{rupee(totalExpenses)}</div><div className="statlbl">Expenses</div></div>
        <div className="statbox" style={{ flex: 1, minWidth: 140 }}><div className="statnum" style={{ color: netProfit >= 0 ? "#0F9B68" : "#B42318" }}>{rupee(netProfit)}</div><div className="statlbl">Net profit</div></div>
        <div className="statbox" style={{ flex: 1, minWidth: 140 }}><div className="statnum">{rupee(totalOutstanding)}</div><div className="statlbl">Outstanding</div></div>
        <div className="statbox" style={{ flex: 1, minWidth: 140 }}><div className="statnum">{rupee(totalAssets)}</div><div className="statlbl">Assets</div></div>
      </div>

      {/* receivables */}
      <section className="acct-sec">
        <h2>Receivables — by doctor</h2>
        <p className="sub">What each doctor owes, what's collected, and who to follow up.</p>
        <table className="tbl">
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
      </section>

      <MonthlyInvoices invoices={invoices || []} clients={clients || []} payments={payments || []} />

      {/* expenses */}
      <section className="acct-sec">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div><h2>Expenses</h2><p className="sub">Rent, salary, tools, travel and more. Total: <b>{rupee(totalExpenses)}</b></p></div>
          <AddExpenseForm />
        </div>
        {catList.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "4px 0 12px" }}>
            {catList.map(([c, amt]) => <span key={c} className="catchip">{c}: {rupee(amt)}</span>)}
          </div>
        )}
        <table className="tbl">
          <thead><tr><th>Date</th><th>Category</th><th>Note</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {(expenses || []).map((e) => (
              <tr key={e.id}>
                <td style={{ fontSize: 12.5 }}>{shortDate(e.spent_at)}</td>
                <td><span className="catchip">{e.category}</span></td>
                <td style={{ fontSize: 12.5, color: "#475569" }}>{e.note || "—"}</td>
                <td style={{ fontWeight: 700, color: "#B42318" }}>{rupee(e.amount)}</td>
                <td style={{ textAlign: "right" }}><DeleteExpenseButton id={e.id} /></td>
              </tr>
            ))}
            {(expenses || []).length === 0 && <tr><td colSpan="5" style={{ color: "#9aa1b3" }}>No expenses recorded yet.</td></tr>}
          </tbody>
        </table>
      </section>

      {/* assets */}
      <section className="acct-sec">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div><h2>Assets</h2><p className="sub">Equipment and things you own. Total value: <b>{rupee(totalAssets)}</b></p></div>
          <AddAssetForm />
        </div>
        <table className="tbl">
          <thead><tr><th>Acquired</th><th>Asset</th><th>Note</th><th>Value</th><th></th></tr></thead>
          <tbody>
            {(assets || []).map((a) => (
              <tr key={a.id}>
                <td style={{ fontSize: 12.5 }}>{shortDate(a.acquired_at)}</td>
                <td style={{ fontWeight: 600 }}>{a.name}</td>
                <td style={{ fontSize: 12.5, color: "#475569" }}>{a.note || "—"}</td>
                <td style={{ fontWeight: 700 }}>{rupee(a.value)}</td>
                <td style={{ textAlign: "right" }}><DeleteAssetButton id={a.id} /></td>
              </tr>
            ))}
            {(assets || []).length === 0 && <tr><td colSpan="5" style={{ color: "#9aa1b3" }}>No assets recorded yet.</td></tr>}
          </tbody>
        </table>
      </section>

      {/* partners / profit share */}
      <section className="acct-sec">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div><h2>Profit share</h2><p className="sub">Net profit <b style={{ color: netProfit >= 0 ? "#0F9B68" : "#B42318" }}>{rupee(netProfit)}</b> split by partner share.</p></div>
          <AddPartnerForm />
        </div>
        <table className="tbl">
          <thead><tr><th>Partner</th><th>Share %</th><th>Share of profit</th><th></th></tr></thead>
          <tbody>
            {(partners || []).map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.name}</td>
                <td>{Number(p.share_pct)}%</td>
                <td style={{ fontWeight: 700, color: netProfit >= 0 ? "#0F9B68" : "#B42318" }}>{rupee(netProfit * Number(p.share_pct) / 100)}</td>
                <td style={{ textAlign: "right" }}><DeletePartnerButton id={p.id} /></td>
              </tr>
            ))}
            {(partners || []).length === 0 && <tr><td colSpan="4" style={{ color: "#9aa1b3" }}>No partners yet. Add partners (e.g. 50% / 50%) to see each share.</td></tr>}
          </tbody>
        </table>
        {(partners || []).length > 0 && Math.abs((partners || []).reduce((a, p) => a + Number(p.share_pct), 0) - 100) > 0.01 && (
          <p className="hint" style={{ color: "#B45309" }}>⚠ Shares add up to {(partners || []).reduce((a, p) => a + Number(p.share_pct), 0)}% (not 100%).</p>
        )}
      </section>
    </div>
  );
}
