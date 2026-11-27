import Link from "next/link";
import { connection } from "next/server";
import { signOut } from "@/app/auth/actions";
import { supabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function Header() {
  await connection(); // always render per request (shows who is logged in)
  let email: string | null = null;
  if (supabaseConfig()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    email = data.user?.email ?? null;
  }

  return (
    <header className="border-b border-line bg-surface">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
        <Link href={email ? "/dashboard" : "/"} className="text-base font-semibold text-brand">
          First Light
        </Link>
        {email ? (
          <>
            <Link href="/dashboard">Overview</Link>
            <Link href="/orders">Orders</Link>
            <Link href="/import">Import</Link>
            <form action={signOut} className="ml-auto flex items-center gap-3">
              <span className="hidden text-muted sm:inline">{email}</span>
              <button className="btn-secondary py-1">Log out</button>
            </form>
          </>
        ) : (
          <div className="ml-auto flex gap-3">
            <Link href="/login" className="btn-secondary py-1">
              Log in
            </Link>
            <Link href="/signup" className="btn py-1">
              Sign up
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
