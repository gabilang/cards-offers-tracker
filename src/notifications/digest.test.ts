import { describe, expect, it } from "vitest";
import { renderDigest } from "./digest";

const offer = (bank: string, i: number) =>
  ({
    id: `${bank}-${i}`,
    title: `<b>${bank} offer ${i}</b>`,
    url: `https://example.test/${bank}/${i}`,
    discountPct: 10,
    validTo: new Date("2026-10-31T00:00:00Z"),
    recurrence: i === 0 ? "SAT,SUN" : null,
    rawValidity: null,
    bank: { name: bank },
    matched: [{ bankId: bank, cardType: "CREDIT", network: "VISA", tier: null, nickname: null }],
  }) as unknown as Parameters<typeof renderDigest>[1][number];

describe("renderDigest", () => {
  it("caps each bank so every bank appears", () => {
    const offers = [...Array.from({ length: 100 }, (_, i) => offer("Big Bank", i)), offer("Small Bank", 0)];
    const { html, text, subject } = renderDigest({ name: "Ann" }, offers, "http://app.test");
    expect(subject).toBe("101 new card offers for your cards");
    expect(html).toContain("Small Bank");
    expect(html).toContain("more in the app");
    expect(text).toContain("SMALL BANK");
    expect(html).toContain("For your Visa Credit card");
    expect(html).toContain("SAT, SUN only");
  });

  it("escapes HTML in offer titles", () => {
    const { html } = renderDigest({ name: "<script>" }, [offer("Bank", 1)], "http://app.test");
    expect(html).not.toContain("<b>Bank offer");
    expect(html).toContain("&lt;b&gt;Bank offer 1&lt;/b&gt;");
    expect(html).not.toContain("<script>");
  });
});
