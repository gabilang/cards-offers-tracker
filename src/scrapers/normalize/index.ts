import { createHash } from "node:crypto";
import type { NormalizedOffer, RawOffer } from "../types";
import { extractCardInfo } from "./cards";
import { canonicalCategory } from "./category";
import { parseValidity } from "./dates";
import { parseDiscountPct } from "./discount";

const squash = (s: string | null | undefined) => {
  const v = s?.replace(/\s+/g, " ").trim();
  return v ? v : null;
};

/**
 * Identity of an offer across scrapes. The bank's own id is preferred so that parser
 * improvements (e.g. better merchant extraction) never make an old offer look new.
 * The end date is included so an extended or renewed offer is announced again.
 */
export function offerHash(bankId: string, externalId: string | undefined | null, merchant: string | null, title: string, validTo: Date | null) {
  const identity = externalId ? [externalId] : [merchant ?? "", title];
  return createHash("sha1")
    .update([bankId, ...identity, validTo?.toISOString() ?? ""].join("|"))
    .digest("hex");
}

export function normalizeOffer(bankId: string, raw: RawOffer, ref: Date = new Date()): NormalizedOffer {
  const title = squash(raw.title) ?? "Untitled offer";
  const description = squash(raw.description);
  const parsed = parseValidity(raw.validityText, ref);
  const validFrom = raw.validFrom !== undefined ? raw.validFrom : parsed.from;
  const validTo = raw.validTo !== undefined ? raw.validTo : parsed.to;
  const cards = extractCardInfo(raw.cardText ?? [title, description, raw.discountText].filter(Boolean).join(" "));
  const discountText = squash(raw.discountText);

  const merchant = squash(raw.merchant);
  const contentHash = offerHash(bankId, raw.externalId, merchant, title, validTo ?? null);

  return {
    bankId,
    externalId: raw.externalId ?? null,
    title,
    merchant,
    description,
    category: canonicalCategory(squash(raw.category), [merchant, title, description].filter(Boolean).join(" ")),
    bankCategory: squash(raw.category)?.toLowerCase() ?? null,
    discountText,
    discountPct: parseDiscountPct(discountText ?? title),
    url: raw.url ?? null,
    imageUrl: raw.imageUrl ?? null,
    terms: squash(raw.terms),
    ...cards,
    validFrom: validFrom ?? null,
    validTo: validTo ?? null,
    recurrence: parsed.recurrence,
    rawValidity: squash(raw.validityText),
    contentHash,
  };
}
