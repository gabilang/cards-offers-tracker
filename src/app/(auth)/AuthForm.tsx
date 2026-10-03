"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormState } from "./actions";

export function AuthForm({
  mode,
  action,
}: {
  mode: "login" | "register";
  action: (state: FormState, form: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const isLogin = mode === "login";
  return (
    <div className="mx-auto mt-10 max-w-sm">
      <h1 className="text-2xl font-semibold">{isLogin ? "Sign in" : "Create your account"}</h1>
      <p className="mt-1 text-sm text-muted">
        {isLogin ? "Get offers matched to your cards." : "Save your cards and get emails when new offers match them."}
      </p>
      <form action={formAction} className="card mt-6 space-y-4 p-5">
        {!isLogin && (
          <div>
            <label className="label" htmlFor="name">Name</label>
            <input className="input" id="name" name="name" required autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            required
            minLength={isLogin ? 1 : 8}
            autoComplete={isLogin ? "current-password" : "new-password"}
          />
        </div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <button className="btn-primary w-full" disabled={pending}>
          {pending ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-muted">
        {isLogin ? (
          <>No account? <Link href="/register" className="text-accent">Create one</Link></>
        ) : (
          <>Already registered? <Link href="/login" className="text-accent">Sign in</Link></>
        )}
      </p>
    </div>
  );
}
