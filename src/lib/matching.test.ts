import { describe, expect, it } from "vitest";
import { offerMatchesCard, recurrenceHits, todayInColombo } from "./matching";

const offer = (o: Partial<Parameters<typeof offerMatchesCard>[0]> = {}) => ({
  bankId: "ntb", cardTypes: [], networks: [], tiers: [], ...o,
});
const card = { bankId: "ntb", cardType: "CREDIT", network: "MASTERCARD", tier: null };

describe("offerMatchesCard", () => {
  it("matches an unrestricted offer from the same bank", () => expect(offerMatchesCard(offer(), card)).toBe(true));
  it("rejects other banks", () => expect(offerMatchesCard(offer({ bankId: "hnb" }), card)).toBe(false));
  it("rejects wrong card type", () => expect(offerMatchesCard(offer({ cardTypes: ["DEBIT"] }), card)).toBe(false));
  it("rejects wrong network", () => expect(offerMatchesCard(offer({ networks: ["VISA"] }), card)).toBe(false));
  it("ANY network matches a network-restricted offer", () =>
    expect(offerMatchesCard(offer({ networks: ["VISA"] }), { ...card, network: "ANY" })).toBe(true));
  it("tier restriction only applies if the card has a tier", () => {
    expect(offerMatchesCard(offer({ tiers: ["INFINITE"] }), card)).toBe(true);
    expect(offerMatchesCard(offer({ tiers: ["INFINITE"] }), { ...card, tier: "PLATINUM" })).toBe(false);
  });
});

describe("recurrenceHits", () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  it("Wednesday offer on a Tuesday misses", () => expect(recurrenceHits("WED", d("2026-09-29"), d("2026-09-29"))).toBe(false));
  it("Wednesday offer on a Wednesday hits", () => expect(recurrenceHits("WED", d("2026-09-30"), d("2026-09-30"))).toBe(true));
  it("range covering Wednesday hits", () => expect(recurrenceHits("WED", d("2026-09-28"), d("2026-10-01"))).toBe(true));
  it("empty window misses", () => expect(recurrenceHits("WED", d("2026-10-02"), d("2026-10-01"))).toBe(false));
  it("no recurrence always hits", () => expect(recurrenceHits(null, d("2026-09-29"), d("2026-09-29"))).toBe(true));
});

it("todayInColombo uses +05:30", () => {
  expect(todayInColombo(new Date("2026-09-28T19:00:00Z"))).toBe("2026-09-29");
});
