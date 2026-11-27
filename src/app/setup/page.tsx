import { supabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "Setup · First Light" };

export default function SetupPage() {
  const ready = !!supabaseConfig();
  return (
    <div className="card space-y-3">
      <h1 className="text-xl font-semibold">{ready ? "Supabase is connected" : "One more step: connect Supabase"}</h1>
      {ready ? (
        <p>You&apos;re all set. Head to the home page to sign up.</p>
      ) : (
        <>
          <p>
            First Light uses Supabase for accounts and to store orders. Add your Supabase URL and key to a file
            called <code>.env.local</code> (copy <code>.env.example</code>), then restart the app.
          </p>
          <p className="text-sm text-muted">Step-by-step instructions are in SETUP.md in the project.</p>
        </>
      )}
    </div>
  );
}
