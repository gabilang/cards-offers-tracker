import type { CardType, Network } from "../types";

const TIERS = [
  "INFINITE", "SIGNATURE", "PLATINUM", "WORLD", "TITANIUM", "GOLD", "CLASSIC",
  "PLATINUM REWARDS", "ELITE", "BLACK", "WORLD ELITE",
];

export interface CardInfo {
  cardTypes: CardType[];
  networks: Network[];
  tiers: string[];
}

/** Pull card type, network and tier hints out of offer text. Empty arrays mean "not specified". */
export function extractCardInfo(text: string | null | undefined): CardInfo {
  const t = (text ?? "").toLowerCase();
  const cardTypes: CardType[] = [];
  if (/\bcredit\b/.test(t)) cardTypes.push("CREDIT");
  if (/\bdebit\b/.test(t)) cardTypes.push("DEBIT");

  const networks: Network[] = [];
  if (/\bvisa\b/.test(t)) networks.push("VISA");
  if (/\bmaster\s?card\b|\bmaster\b/.test(t)) networks.push("MASTERCARD");
  if (/\bamex\b|american express/.test(t)) networks.push("AMEX");

  const tiers = TIERS.filter((tier) => new RegExp(`\\b${tier.toLowerCase()}\\b`).test(t))
    // "world elite" also matches "world"/"elite"; keep only the most specific
    .filter((tier, _, all) => !all.some((o) => o !== tier && o.includes(tier)));

  return { cardTypes, networks, tiers };
}
