"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthState } from "@/app/auth/actions";

type Props = {
  mode: "login" | "signup";
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>;
  next?: string;
  initialError?: string;
};

export default function AuthForm({ mode, action, next, initialError }: Props) {
  const [state, formAction, pending] = useActionState(action, { error: initialError });
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="card mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">{isSignup ? "Create your First Light account" : "Log in"}</h1>
      {isSignup && (
        <label className="block text-sm">
          Business name
          <input name="business_name" className="input" placeholder="e.g. Sage & Rust" />
        </label>
      )}
      <label className="block text-sm">
        Email
        <input name="email" type="email" required autoComplete="email" className="input" />
      </label>
      <label className="block text-sm">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={isSignup ? 8 : undefined}
          autoComplete={isSignup ? "new-password" : "current-password"}
          className="input"
        />
      </label>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && <p className="text-sm text-red-700">{state.error}</p>}
      {state.message && <p className="text-sm text-green-700">{state.message}</p>}
      <button className="btn w-full" disabled={pending}>
        {pending ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
      </button>
      <p className="text-center text-sm text-muted">
        {isSignup ? (
          <>
            Already have an account? <Link href="/login" className="text-brand underline">Log in</Link>
          </>
        ) : (
          <>
            New here? <Link href="/signup" className="text-brand underline">Create an account</Link>
          </>
        )}
      </p>
    </form>
  );
}
