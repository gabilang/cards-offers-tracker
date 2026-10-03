"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/auth";
import { CARD_TYPES, FREQUENCIES, NETWORKS, TIERS } from "@/lib/banks";
import { db } from "@/lib/db";
import { runNotifications, sendTestEmail } from "@/notifications/digest";

const cardSchema = z.object({
  bankId: z.string().min(1),
  cardType: z.enum(CARD_TYPES),
  network: z.enum(NETWORKS),
  tier: z.union([z.enum(TIERS), z.literal("")]).transform((v) => v || null),
  nickname: z.string().trim().max(40).transform((v) => v || null),
});

export async function addCard(form: FormData) {
  const user = await requireUser();
  const data = cardSchema.parse(Object.fromEntries(form));
  if (!(await db.bank.findUnique({ where: { id: data.bankId } }))) throw new Error("Unknown bank");
  await db.userCard.create({ data: { ...data, userId: user.id } });
  // Following the card's bank keeps it in the default offers filter.
  await db.userBank.upsert({
    where: { userId_bankId: { userId: user.id, bankId: data.bankId } },
    create: { userId: user.id, bankId: data.bankId },
    update: {},
  });
  redirect("/preferences?notice=" + encodeURIComponent("Card added."));
}

export async function deleteCard(form: FormData) {
  const user = await requireUser();
  await db.userCard.deleteMany({ where: { id: String(form.get("id")), userId: user.id } });
  redirect("/preferences?notice=" + encodeURIComponent("Card removed."));
}

export async function savePreferences(form: FormData) {
  const user = await requireUser();
  const banks = form.getAll("banks").map(String).filter(Boolean);
  const categories = form.getAll("categories").map(String).filter(Boolean);
  const frequency = z.enum(FREQUENCIES).parse(form.get("digestFrequency"));
  await db.$transaction([
    db.userBank.deleteMany({ where: { userId: user.id } }),
    db.userBank.createMany({ data: banks.map((bankId) => ({ userId: user.id, bankId })) }),
    db.userCategory.deleteMany({ where: { userId: user.id } }),
    db.userCategory.createMany({ data: categories.map((category) => ({ userId: user.id, category })) }),
    db.user.update({
      where: { id: user.id },
      data: { digestFrequency: frequency, emailEnabled: form.get("emailEnabled") === "on" },
    }),
  ]);
  redirect("/preferences?saved=1");
}

export async function testEmail() {
  const user = await requireUser();
  let msg: string;
  try {
    const n = await sendTestEmail(user.id);
    msg = `Test email sent to ${user.email} (${n} matching offers).`;
  } catch (e) {
    msg = `Could not send email: ${(e as Error).message}`;
  }
  redirect(`/preferences?notice=${encodeURIComponent(msg)}`);
}

export async function sendNow() {
  const user = await requireUser();
  const [r] = await runNotifications({ force: true, userId: user.id });
  const msg = !r ? "Email notifications are turned off." : r.sent ? `Sent ${r.sent} offers to ${r.email}.` : `Nothing sent: ${r.skipped}.`;
  redirect(`/preferences?notice=${encodeURIComponent(msg)}`);
}
