import { describe, expect, it } from "vitest";
import { day, parseCompact, parseValidity } from "./dates";
import { extractCardInfo } from "./cards";
import { parseDiscountPct } from "./discount";

const ref = new Date("2026-09-28T10:00:00+05:30");
const iso = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

describe("parseValidity", () => {
  const cases: [string, string | null, string | null, string | null][] = [
    ["Offer valid till 31st October 2026", null, "2026-10-31", null],
    ["Offer valid on every Wednesday till 30th September 2026", null, "2026-09-30", "WED"],
    ["Valid till 31 October 2026", null, "2026-10-31", null],
    ["Valid on 30 September 2026", "2026-09-30", "2026-09-30", null],
    ["Valid every Sat from 1st October to 31st October 2026", "2026-10-01", "2026-10-31", "SAT"],
    ["Expiration date : 30 Sep 2026", null, "2026-09-30", null],
    ["Until 31st December 2026", null, "2026-12-31", null],
    ["1st September - 31st October 2026", "2026-09-01", "2026-10-31", null],
    ["15th December 2026 - 15th January 2027", "2026-12-15", "2027-01-15", null],
    ["1st Dec - 31st Jan 2027", "2026-12-01", "2027-01-31", null],
    ["Valid on 26th & 27th April 2026", "2026-04-26", "2026-04-27", null],
    ["valid until 31st Deecember 2026", null, "2026-12-31", null],
    ["Valid until 31st Dcember 2026", null, "2026-12-31", null],
    ["Valid till 30th Septmber 2026", null, "2026-09-30", null],
    ["Valid on weekends till 30th Nov 2026", null, "2026-11-30", "SAT,SUN"],
  ];
  for (const [text, from, to, rec] of cases) {
    it(text, () => {
      const v = parseValidity(text, ref);
      expect(iso(v.from)).toBe(from);
      expect(iso(v.to)).toBe(to);
      expect(v.recurrence).toBe(rec);
    });
  }

  it("returns nulls for empty text", () => {
    expect(parseValidity("", ref)).toEqual({ from: null, to: null, recurrence: null });
  });

  it("parses compact YYYYMMDD", () => {
    expect(parseCompact("20260930")).toEqual(day(2026, 8, 30));
  });
});

describe("extractCardInfo", () => {
  it("finds credit + debit + mastercard", () => {
    const c = extractCardInfo("15% off with Mastercard Credit Cards and 10% with Debit Cards");
    expect(c.cardTypes).toEqual(["CREDIT", "DEBIT"]);
    expect(c.networks).toEqual(["MASTERCARD"]);
  });
  it("finds visa infinite tier", () => {
    const c = extractCardInfo("Keells - Visa Infinite Offer");
    expect(c.networks).toEqual(["VISA"]);
    expect(c.tiers).toEqual(["INFINITE"]);
    expect(c.cardTypes).toEqual([]);
  });
  it("prefers the most specific tier", () => {
    expect(extractCardInfo("Mastercard World Elite credit").tiers).toEqual(["WORLD ELITE"]);
  });
  it("detects amex", () => {
    expect(extractCardInfo("20% Savings with American Express Cards").networks).toEqual(["AMEX"]);
  });
});

describe("parseDiscountPct", () => {
  it.each([
    ["Up to 35% off", 35],
    ["15% off with Credit and 10% with Debit", 15],
    ["Rs. 1,000 off", null],
    ["12.5% savings", 12.5],
  ])("%s", (text, pct) => expect(parseDiscountPct(text)).toBe(pct));
});
