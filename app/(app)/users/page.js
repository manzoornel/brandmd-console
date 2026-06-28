import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { isAdmin, rolesLabel } from "@/lib/roles";
import CreateUserForm from "@/components/CreateUserForm";
import UserActiveToggle from "@/components/UserActiveToggle";
import ResetPasswordButton from "@/components/ResetPasswordButton";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const profile = await getProfile();
  if (!isAdmin(profile.roles)) redirect("/dashboard");
  const supabase = createClient();
  const [{ data: people }, { data: clients }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("clients").select("id, name"),
  ]);
  const cname = (id) => clients?.find((c) => c.id === id)?.name || "";
  return (
    <div className="body">
      <div className="head">
        <div><h1>Users & roles</h1><p className="sub">Create logins, give one or more roles, reset passwords.</p></div>
        <CreateUserForm clients={clients} />
      </div>
      <table className="tbl" style={{ marginTop: 8 }}>
        <thead><tr><th>Name</th><th>Roles</th><th>Doctor</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {(people || []).map((p) => {
            const roles = p.roles || [];
            return (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.full_name || "—"}</td>
                <td>{rolesLabel(roles)}</td>
                <td>{roles.includes("client") ? cname(p.client_id) : "—"}</td>
                <td><span className="tag" style={{ background: p.active ? "rgba(24,181,122,.12)" : "#FEECEC", color: p.active ? "#0F9B68" : "#B42318" }}>{p.active ? "Active" : "Inactive"}</span></td>
                <td style={{ textAlign: "right" }}>
                  {!roles.includes("super_admin") && (
                    <div style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <ResetPasswordButton id={p.id} name={p.full_name} />
                      <UserActiveToggle id={p.id} active={p.active} />
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
