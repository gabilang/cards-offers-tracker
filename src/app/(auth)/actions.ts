"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/auth";
import { db } from "@/lib/db";

/** `values` lets the form refill what the user typed after an error (never the password). */
export type FormState = { error?: string; values?: Record<string, string> } | undefined;

const keep = (form: FormData, ...names: string[]) =>
  Object.fromEntries(names.map((n) => [n, String(form.get(n) ?? "")]));

export async function login(_: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: String(form.get("email") ?? "").toLowerCase(),
      password: String(form.get("password") ?? ""),
      redirectTo: "/offers",
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "Wrong email or password.", values: keep(form, "email") };
    throw e; // redirect
  }
}

const registerSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

/** Constant-time comparison; hashing first makes both sides the same length. */
function codeMatches(given: string, expected: string) {
  const h = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(h(given), h(expected));
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const invite = process.env.INVITE_CODE?.trim();
  if (invite && !codeMatches(String(form.get("inviteCode") ?? "").trim(), invite)) {
    return { error: "Invalid invite code.", values: keep(form, "name", "email", "inviteCode") };
  }
  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values: keep(form, "name", "email", "inviteCode") };
  const email = parsed.data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) {
    return { error: "An account with this email already exists.", values: keep(form, "name", "inviteCode") };
  }

  const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  // With ADMIN_EMAILS set (production), only those addresses are admins. Without it (local dev),
  // the first account on a fresh install becomes admin so someone can run scrapes.
  const isAdmin = adminEmails.length ? adminEmails.includes(email) : (await db.user.count()) === 0;
  await db.user.create({
    data: { name: parsed.data.name, email, passwordHash: await bcrypt.hash(parsed.data.password, 10), isAdmin },
  });
  await signIn("credentials", { email, password: parsed.data.password, redirectTo: "/preferences?welcome=1" });
}
