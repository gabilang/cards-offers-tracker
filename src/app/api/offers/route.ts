import { NextResponse, type NextRequest } from "next/server";
import { currentUser } from "@/auth";
import { db } from "@/lib/db";
import { findOffers } from "@/lib/offers";

/** GET /api/offers?from=YYYY-MM-DD&to=YYYY-MM-DD&banks=hnb&banks=ntb&cardType=CREDIT&network=VISA&category=dining&q=&mine=1 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  let cards;
  if (p.get("mine") === "1") {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in to filter by your cards" }, { status: 401 });
    cards = await db.userCard.findMany({ where: { userId: user.id } });
  }
  const { offers, from, to } = await findOffers({
    from: p.get("from") ?? undefined,
    to: p.get("to") ?? undefined,
    banks: p.getAll("banks").filter(Boolean),
    cardType: p.get("cardType") ?? undefined,
    network: p.get("network") ?? undefined,
    category: p.get("category") ?? undefined,
    q: p.get("q") ?? undefined,
    cards,
  });
  return NextResponse.json({
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    count: offers.length,
    offers: offers.map(({ bank, ...o }) => ({ ...o, bankName: bank.name })),
  });
}
