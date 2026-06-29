import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/roles";
import CreatePackageForm from "@/components/CreatePackageForm";
import DeletePackageButton from "@/components/DeletePackageButton";

export const dynamic = "force-dynamic";
const rupee = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

export default async function PackagesPage() {
  const profile = await getProfile();
  if (!isAdmin(profile.roles)) redirect("/dashboard");
  const supabase = createClient();
  const [{ data: packages }, { data: clients }] = await Promise.all([
    supabase.from("packages").select("*").order("created_at"),
    supabase.from("clients").select("package_id"),
  ]);
  const usedBy = (id) => (clients || []).filter((c) => c.package_id === id).length;
  return (
    <div className="body">
      <div className="head">
        <div><h1>Packages</h1><p className="sub">Reusable packages you can attach to any doctor.</p></div>
        <CreatePackageForm />
      </div>
      <table className="tbl" style={{ marginTop: 8 }}>
        <thead><tr><th>Package</th><th>Videos</th><th>Posters</th><th>Price</th><th>Doctors using</th><th></th></tr></thead>
        <tbody>
          {(packages || []).map((p) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 600 }}>{p.name}</td>
              <td>{p.quota_videos}</td>
              <td>{p.quota_posters}</td>
              <td style={{ fontWeight: 600 }}>{rupee(p.price)}</td>
              <td>{usedBy(p.id)}</td>
              <td style={{ textAlign: "right" }}><DeletePackageButton id={p.id} name={p.name} /></td>
            </tr>
          ))}
          {(packages || []).length === 0 && <tr><td colSpan="6" style={{ color: "#9aa1b3" }}>No packages yet. Create one, then pick it when adding a doctor.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
