import { getProfile } from "@/lib/supabase/server";
import { rolesLabel } from "@/lib/roles";
import ChangePasswordForm from "@/components/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const profile = await getProfile();
  return (
    <div className="body">
      <h1>My account</h1>
      <p className="sub">{profile.full_name} · {rolesLabel(profile.roles)} · {profile.email}</p>
      <div style={{ marginTop: 18 }}><ChangePasswordForm /></div>
    </div>
  );
}
