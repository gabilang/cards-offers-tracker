/**
 * LOCAL DEVELOPMENT ONLY: never run this against the production database.
 *
 * Development seed: bank rows plus two demo users with cards.
 * Run with `npm run seed`. Demo logins (local development only):
 *   demo-admin@example.test / demo-pass-2026  (admin; NTB Mastercard credit, HNB credit)
 *   demo-user@example.test  / demo-pass-2026  (Sampath Visa debit, ComBank credit, weekly digest)
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { ensureBanks } from "@/lib/banks";

const PASSWORD = "demo-pass-2026";

const USERS = [
  {
    email: "demo-admin@example.test",
    name: "Demo Admin",
    isAdmin: true,
    digestFrequency: "DAILY",
    cards: [
      { bankId: "ntb", cardType: "CREDIT", network: "MASTERCARD", nickname: "NTB Mastercard" },
      { bankId: "hnb", cardType: "CREDIT", network: "ANY" },
    ],
  },
  {
    email: "demo-user@example.test",
    name: "Demo User",
    isAdmin: false,
    digestFrequency: "WEEKLY",
    cards: [
      { bankId: "sampath", cardType: "DEBIT", network: "VISA" },
      { bankId: "combank", cardType: "CREDIT", network: "ANY", nickname: "ComBank credit" },
    ],
  },
];

async function main() {
  await ensureBanks();
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  for (const { cards, ...u } of USERS) {
    const user = await db.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash },
      update: { ...u, passwordHash },
    });
    await db.userCard.deleteMany({ where: { userId: user.id } });
    await db.userCard.createMany({ data: cards.map((c) => ({ ...c, userId: user.id })) });
    await db.userBank.deleteMany({ where: { userId: user.id } });
    await db.userBank.createMany({ data: [...new Set(cards.map((c) => c.bankId))].map((bankId) => ({ userId: user.id, bankId })) });
    console.log(`seeded ${u.email} with ${cards.length} cards`);
  }
}

main().finally(() => db.$disconnect());
