import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { logIn } from "@/app/auth/actions";
import { supabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "Log in · First Light" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (!supabaseConfig()) redirect("/setup");
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const error = params.error === "confirm" ? "That confirmation link didn't work. Try logging in, or sign up again." : undefined;
  return <AuthForm mode="login" action={logIn} next={next} initialError={error} />;
}
