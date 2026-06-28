import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Supabase client for Server Components & Server Actions (uses the user's session)
export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch (_) { /* called from a Server Component - safe to ignore */ }
        },
      },
    }
  );
}

// Admin client (service role) - server only. Used to create staff accounts.
import { createClient as createAdminBase } from "@supabase/supabase-js";
export function createAdminClient() {
  return createAdminBase(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Convenience: get the current user's profile (id, role, name, client_id)
export async function getProfile() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role, client_id, active")
    .eq("id", user.id)
    .single();
  return data ? { ...data, email: user.email } : null;
}
