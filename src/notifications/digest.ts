import type { User, UserCard } from "@prisma/client";
import { db, parseJsonArray } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { cardLabel, matchingCards, parseDateParam, todayInColombo } from "@/lib/matching";

const MAX_OFFERS_IN_EMAIL = 60;
const HOUR = 3_600_000;
const INTERVAL: Record<string, number> = { INSTANT: 0, DAILY: 23 * HOUR, WEEKLY: 7 * 24 * HOUR - HOUR };

type UserWithPrefs = User & { cards: UserCard[]; categories: { category: string }[] };

/** Active, not-yet-expired offers that match the user's cards and that they have not been emailed about. */
export async function pendingOffersFor(user: UserWithPrefs) {
  if (!user.cards.length) return [];
  const today = parseDateParam(todayInColombo())!;
  const rows = await db.offer.findMany({
    where: {
      isActive: true,
      bankId: { in: [...new Set(user.cards.map((c) => c.bankId))] },
      OR: [{ validTo: null }, { validTo: { gte: today } }],
      notifications: { none: { userId: user.id } },
      ...(user.categories.length ? { category: { in: user.categories.map((c) => c.category) } } : {}),
    },
    include: { bank: { select: { name: true } } },
    orderBy: [{ firstSeenAt: "desc" }, { discountPct: { sort: "desc", nulls: "last" } }],
  });
  return rows
    .map((o) => {
      const fields = { bankId: o.bankId, cardTypes: parseJsonArray(o.cardTypes), networks: parseJsonArray(o.networks), tiers: parseJsonArray(o.tiers) };
      return { ...o, matched: matchingCards(fields, user.cards) };
    })
    .filter((o) => o.matched.length > 0);
}

type Pending = Awaited<ReturnType<typeof pendingOffersFor>>[number];

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const fmt = (d: Date | null) => (d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "");

export function renderDigest(user: Pick<User, "name">, offers: Pending[], appUrl: string) {
  // Split the cap across banks so one bank with hundreds of offers cannot crowd out the rest.
  const allByBank = new Map<string, Pending[]>();
  for (const o of offers) allByBank.set(o.bank.name, [...(allByBank.get(o.bank.name) ?? []), o]);
  const perBank = Math.max(5, Math.floor(MAX_OFFERS_IN_EMAIL / allByBank.size));
  const byBank = new Map([...allByBank].map(([bank, list]) => [bank, list.slice(0, perBank)]));
  const shown = [...byBank.values()].flat();

  const validity = (o: Pending) =>
    o.validTo ? `Until ${fmt(o.validTo)}${o.recurrence ? ` · ${o.recurrence.replace(/,/g, ", ")} only` : ""}` : o.rawValidity ?? "Validity not stated";

  const htmlSections = [...byBank].map(([bank, list]) => `
    <h2 style="font:600 16px system-ui;margin:24px 0 8px;color:#111">${esc(bank)}</h2>
    ${list.map((o) => `
      <div style="border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;margin:0 0 8px">
        <div style="font:600 14px system-ui;color:#111">
          ${o.discountPct ? `<span style="background:#dcfce7;color:#166534;border-radius:6px;padding:1px 6px;margin-right:6px">${o.discountPct}%</span>` : ""}
          <a href="${esc(o.url)}" style="color:#111;text-decoration:none">${esc(o.title)}</a>
        </div>
        <div style="font:13px system-ui;color:#555;margin-top:4px">${esc(validity(o))}</div>
        <div style="font:12px system-ui;color:#777;margin-top:4px">For your ${esc(o.matched.map((c) => c.nickname || `${cardLabel(c)} card`).join(", "))}</div>
      </div>`).join("")}`).join("");

  const more =
    offers.length > shown.length
      ? `<p style="font:13px system-ui">…and ${offers.length - shown.length} more in the app.</p>`
      : "";
  const html = `<div style="max-width:640px;margin:0 auto;padding:16px">
    <h1 style="font:700 20px system-ui;margin:0 0 4px">New card offers for you</h1>
    <p style="font:14px system-ui;color:#555;margin:0">Hi ${esc(user.name ?? "there")}, ${offers.length} new offer${offers.length === 1 ? "" : "s"} match your saved cards.</p>
    ${htmlSections}${more}
    <p style="font:13px system-ui;margin-top:24px"><a href="${appUrl}/offers?mine=1">See all your offers</a> · <a href="${appUrl}/preferences">Email preferences</a></p>
  </div>`;

  const text = [
    `${offers.length} new card offers match your saved cards.`,
    ...[...byBank].flatMap(([bank, list]) => ["", bank.toUpperCase(), ...list.map((o) => `- ${o.title} (${validity(o)}) ${o.url ?? ""}`)]),
    offers.length > shown.length ? `…and ${offers.length - shown.length} more.` : "",
    "",
    `All offers: ${appUrl}/offers?mine=1`,
  ].join("\n");

  return { subject: `${offers.length} new card offer${offers.length === 1 ? "" : "s"} for your cards`, html, text };
}

export interface NotifyResult {
  userId: string;
  email: string;
  sent: number;
  skipped?: string;
}

/** Email every user whose digest is due. `force` ignores the frequency window (used by "send now"). */
export async function runNotifications({
  force = false,
  userId,
  frequencies,
}: { force?: boolean; userId?: string; frequencies?: string[] } = {}) {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const users = await db.user.findMany({
    where: {
      emailEnabled: true,
      ...(userId ? { id: userId } : {}),
      ...(frequencies ? { digestFrequency: { in: frequencies } } : {}),
    },
    include: { cards: true, categories: true },
  });
  const results: NotifyResult[] = [];
  for (const user of users) {
    const due = force || !user.lastDigestAt || Date.now() - user.lastDigestAt.getTime() >= (INTERVAL[user.digestFrequency] ?? INTERVAL.DAILY);
    if (!due) {
      results.push({ userId: user.id, email: user.email, sent: 0, skipped: "not due" });
      continue;
    }
    const offers = await pendingOffersFor(user);
    if (!offers.length) {
      results.push({ userId: user.id, email: user.email, sent: 0, skipped: "nothing new" });
      continue;
    }
    const mail = renderDigest(user, offers, appUrl);
    try {
      await sendMail(user.email, mail.subject, mail.html, mail.text);
    } catch (e) {
      results.push({ userId: user.id, email: user.email, sent: 0, skipped: `send failed: ${(e as Error).message}` });
      continue;
    }
    // Everything pending is logged, including offers beyond the email cap; they remain visible in the app.
    await db.$transaction([
      db.notificationLog.createMany({ data: offers.map((o) => ({ userId: user.id, offerId: o.id })) }),
      db.user.update({ where: { id: user.id }, data: { lastDigestAt: new Date() } }),
    ]);
    results.push({ userId: user.id, email: user.email, sent: offers.length });
  }
  return results;
}

/** Preview email with the user's current matches; nothing is marked as sent. */
export async function sendTestEmail(userId: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { cards: true, categories: true } });
  const offers = await pendingOffersFor(user);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const mail = offers.length
    ? renderDigest(user, offers, appUrl)
    : { subject: "Card Offers Tracker test email", html: "<p>Email delivery works. No new offers match your cards right now.</p>", text: "Email delivery works. No new offers match your cards right now." };
  await sendMail(user.email, `[Test] ${mail.subject}`, mail.html, mail.text);
  return offers.length;
}
