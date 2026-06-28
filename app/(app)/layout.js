import { redirect } from "next/navigation";
import { getProfile } from "@/lib/supabase/server";
import { ROLES } from "@/lib/roles";
import Sidebar from "@/components/Sidebar";
import WorkSession from "@/components/WorkSession";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="app">
      <Sidebar role={profile.role} />
      <main className="main">
        <header className="top">
          <span className="crumb">Content Operations · {ROLES[profile.role]}</span>
          <div className="top-right">
            <WorkSession name={profile.full_name} />
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
