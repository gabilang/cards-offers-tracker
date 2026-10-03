/** Pure matching helpers shared by the offers page and the notifier. */

export interface OfferCardFields {
  bankId: string;
  cardTypes: string[];
  networks: string[];
  tiers: string[];
}

export interface CardLike {
  bankId: string;
  cardType: string; // CREDIT | DEBIT
  network: string; // VISA | MASTERCARD | AMEX | ANY
  tier?: string | null;
  nickname?: string | null;
}

/** "Visa Platinum Credit", or the user's nickname for the card. */
export const cardLabel = (c: Pick<CardLike, "nickname" | "cardType" | "network" | "tier">) =>
  c.nickname ||
  [c.network !== "ANY" ? c.network : null, c.tier, c.cardType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

/**
 * An offer matches a card when it is from the same bank and none of the card
 * restrictions the offer states exclude the card. Unstated restrictions match everything.
 */
export function offerMatchesCard(offer: OfferCardFields, card: CardLike): boolean {
  if (offer.bankId !== card.bankId) return false;
  if (offer.cardTypes.length && !offer.cardTypes.includes(card.cardType)) return false;
  if (offer.networks.length && card.network !== "ANY" && !offer.networks.includes(card.network)) return false;
  if (offer.tiers.length && card.tier && !offer.tiers.includes(card.tier)) return false;
  return true;
}

export const matchingCards = <C extends CardLike>(offer: OfferCardFields, cards: C[]) =>
  cards.filter((c) => offerMatchesCard(offer, c));

const DAY_CODES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/** True when a recurring offer (e.g. "WED" or "SAT,SUN") falls on at least one day in [from, to]. */
export function recurrenceHits(recurrence: string | null | undefined, from: Date, to: Date): boolean {
  if (!recurrence) return true;
  if (to < from) return false;
  const days = new Set(recurrence.split(","));
  const spanDays = Math.floor((to.getTime() - from.getTime()) / 86_400_000);
  if (spanDays >= 6) return true;
  for (let i = 0; i <= spanDays; i++) {
    const d = new Date(from.getTime() + i * 86_400_000);
    if (days.has(DAY_CODES[d.getUTCDay()])) return true;
  }
  return false;
}

/** Today's date in Sri Lanka as YYYY-MM-DD. */
export function todayInColombo(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(now);
}

export function parseDateParam(s: string | undefined | null): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
