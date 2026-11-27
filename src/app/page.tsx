import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (supabaseConfig()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) redirect("/dashboard");
  }
  return (
    <section className="space-y-6 py-10">
      <h1 className="max-w-2xl text-4xl font-semibold leading-tight">
        Your Instagram, WhatsApp and Shopify sales, finally in one place.
      </h1>
      <p className="max-w-xl text-lg text-muted">
        Bring in the orders you track in Excel, see what&apos;s actually selling, and get plain advice on what to do
        next. You always make the final call.
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className="btn">
          Get started
        </Link>
        <Link href="/login" className="btn-secondary">
          Log in
        </Link>
      </div>
    </section>
  );
}
