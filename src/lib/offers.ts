import type { Prisma } from "@prisma/client";
import { db, parseJsonArray } from "./db";
import { matchingCards, parseDateParam, recurrenceHits, todayInColombo, type CardLike } from "./matching";

export interface OfferFilters {
  from?: string;
  to?: string;
  banks?: string[];
  cardType?: string;
  network?: string;
  category?: string;
  q?: string;
  /** Only offers usable with these cards. */
  cards?: CardLike[];
}

export type OfferView = Awaited<ReturnType<typeof findOffers>>["offers"][number];

export async function findOffers(f: OfferFilters) {
  const today = todayInColombo();
  let from = parseDateParam(f.from) ?? parseDateParam(today)!;
  let to = parseDateParam(f.to) ?? from;
  if (to < from) [from, to] = [to, from];
  const toEnd = new Date(to.getTime() + 86_400_000 - 1);

  const where: Prisma.OfferWhereInput = {
    AND: [
      { OR: [{ validFrom: null }, { validFrom: { lte: toEnd } }] },
      { OR: [{ validTo: null }, { validTo: { gte: from } }] },
    ],
    // Past ranges may include offers the bank has since removed; current ranges show live offers only.
    ...(to.toISOString().slice(0, 10) < today ? {} : { isActive: true }),
    ...(f.banks?.length ? { bankId: { in: f.banks } } : {}),
    ...(f.category ? { category: f.category } : {}),
    ...(f.q
      ? {
          // Postgres `contains` is case-sensitive unless told otherwise.
          OR: (["title", "merchant", "description"] as const).map((field) => ({
            [field]: { contains: f.q, mode: "insensitive" as const },
          })),
        }
      : {}),
  };

  const rows = await db.offer.findMany({
    where,
    include: { bank: { select: { name: true } } },
    orderBy: [{ discountPct: { sort: "desc", nulls: "last" } }, { validTo: "asc" }],
    take: 3000,
  });

  const offers = rows
    .map((o) => ({
      ...o,
      cardTypes: parseJsonArray(o.cardTypes),
      networks: parseJsonArray(o.networks),
      tiers: parseJsonArray(o.tiers),
    }))
    // Only the days where the chosen range and the offer's validity overlap can hit a recurring day.
    .filter((o) =>
      recurrenceHits(
        o.recurrence,
        o.validFrom && o.validFrom > from ? o.validFrom : from,
        o.validTo && o.validTo < to ? o.validTo : to,
      ),
    )
    .filter((o) => !f.cardType || !o.cardTypes.length || o.cardTypes.includes(f.cardType))
    .filter((o) => !f.network || !o.networks.length || o.networks.includes(f.network))
    .map((o) => ({ ...o, matchedCards: f.cards ? matchingCards(o, f.cards) : [] }))
    .filter((o) => !f.cards || o.matchedCards.length > 0);

  return { offers, from, to };
}

export async function listCategories() {
  const rows = await db.offer.groupBy({
    by: ["category"],
    where: { isActive: true, category: { not: null } },
    _count: true,
    orderBy: { _count: { category: "desc" } },
  });
  return rows.map((r) => ({ category: r.category!, count: r._count }));
}
