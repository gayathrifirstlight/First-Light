import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { signUp } from "@/app/auth/actions";
import { supabaseConfig } from "@/lib/supabase/config";

export const metadata = { title: "Sign up · First Light" };

export default function SignupPage() {
  if (!supabaseConfig()) redirect("/setup");
  return <AuthForm mode="signup" action={signUp} />;
}
