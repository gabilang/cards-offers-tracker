import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeOffer } from "../normalize";
import type { RawOffer } from "../types";
import { parseAmex, parseAmexCategoryLinks } from "./amex";
import { parseBocCategoryLinks, parseBocItems } from "./boc";
import { parseCombank } from "./combank";
import { mapHnb } from "./hnb";
import { parseNdb } from "./ndb";
import { parseNtb } from "./ntb";
import { parseSeylan, parseSeylanDetail } from "./seylan";
import { parsePeoples, parsePeoplesCategoryLinks } from "./peoples";
import { parseDfcc } from "./dfcc";
import { mapSampath } from "./sampath";

const fx = (name: string) => readFileSync(path.join(__dirname, "../__fixtures__", name), "utf8");
const ref = new Date("2026-09-28T00:00:00Z");

function expectSane(bankId: string, offers: RawOffer[], min: number) {
  expect(offers.length).toBeGreaterThanOrEqual(min);
  const norm = offers.map((o) => normalizeOffer(bankId, o, ref));
  for (const n of norm) {
    expect(n.title.length).toBeGreaterThan(2);
    expect(n.url).toMatch(/^https?:\/\//);
  }
  // Most offers should have a parsed end date.
  const withEnd = norm.filter((n) => n.validTo).length;
  expect(withEnd / norm.length).toBeGreaterThan(0.8);
  // Hashes are unique within one scrape.
  expect(new Set(norm.map((n) => n.contentHash)).size).toBe(norm.length);
  return norm;
}

describe("bank parsers (fixtures)", () => {
  it("hnb", () => {
    const data = JSON.parse(fx("hnb-list.json")).data;
    const norm = expectSane("hnb", data.map(mapHnb), 5);
    expect(norm[0].merchant).toBe("Ashadi Jewellers");
    expect(norm[0].cardTypes).toContain("CREDIT");
    expect(norm[0].validFrom?.toISOString().slice(0, 10)).toBe("2026-04-01");
  });

  it("combank", () => {
    const norm = expectSane("combank", parseCombank(fx("combank.html")), 50);
    const foody = norm.find((n) => n.title.includes("Foody.lk"))!;
    expect(foody.discountPct).toBe(35);
    expect(foody.recurrence).toBe("THU");
    expect(foody.category).toBe("dining");
    expect(foody.bankCategory).toBe("food & restaurants");
  });

  it("ntb", () => {
    const norm = expectSane("ntb", parseNtb(fx("ntb.html")), 100);
    const cargills = norm.find((n) => n.merchant === "Cargills Food City")!;
    expect(cargills.networks).toEqual(["MASTERCARD"]);
    expect(cargills.cardTypes).toContain("CREDIT");
  });

  it("amex", () => {
    expect(parseAmexCategoryLinks(fx("amex-dining.html"))).toContain("supermarket-offers");
    const norm = expectSane("amex", parseAmex(fx("amex-dining.html"), "dining-offers"), 40);
    const kfc = norm.find((n) => n.merchant === "KFC")!;
    expect(kfc.recurrence).toBe("SAT");
    expect(kfc.validFrom?.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(kfc.networks).toEqual(["AMEX"]);
  });

  it("boc", () => {
    const slugs = parseBocCategoryLinks(fx("boc-index.html"));
    expect(slugs).toContain("dining");
    expect(slugs.at(-1)).toMatch(/visa|mastercard/);
    const norm = expectSane("boc", parseBocItems(fx("boc-dining.html"), "dining"), 5);
    expect(norm[0].discountPct).toBeGreaterThan(0);
  });

  it("ndb", () => {
    const norm = expectSane("ndb", parseNdb(fx("ndb-index.html")), 80);
    expect(norm.some((n) => n.cardTypes.includes("CREDIT"))).toBe(true);
  });

  it("seylan", () => {
    const { offers, maxPage } = parseSeylan(fx("seylan.html"), "credit");
    expect(maxPage).toBeGreaterThan(10);
    const norm = expectSane("seylan", offers, 5);
    expect(norm[0].cardTypes).toContain("CREDIT");
  });

  it("seylan detail", () => {
    const d = parseSeylanDetail(fx("seylan-detail.html"));
    expect(d.validityText).toBe("Valid on 26th & 27th April 2026");
    expect(d.terms).toContain("DSI Showrooms");
  });

  it("peoples", () => {
    const html = fx("peoples-restaurants.html");
    const slugs = parsePeoplesCategoryLinks(html, "credit");
    expect(slugs).toContain("restaurants");
    expect(slugs.at(-1)).toMatch(/visa|mastercard/);
    const norm = expectSane("peoples", parsePeoples(html, "restaurants", "credit"), 50);
    const plates = norm.find((n) => n.merchant === "Plates at Cinnamon Grand Colombo")!;
    expect(plates.discountPct).toBe(30);
    expect(plates.validTo?.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(plates.cardTypes).toEqual(["CREDIT"]);
  });

  it("dfcc", () => {
    const norm = expectSane("dfcc", parseDfcc(fx("dfcc-dining.html"), { slug: "dining-promotion-credit", name: "Dining" }), 10);
    const taj = norm.find((n) => n.merchant === "Taj Samudra - Colombo")!;
    expect(taj.validFrom?.toISOString().slice(0, 10)).toBe("2026-09-05");
    expect(taj.validTo?.toISOString().slice(0, 10)).toBe("2026-09-30");
    expect(taj.category).toBe("dining");
    const tue = norm.find((n) => n.merchant?.startsWith("Crystal Jade"))!;
    expect(tue.recurrence).toBe("TUE");
  });

  it("sampath", () => {
    const data = JSON.parse(fx("sampath.json")).data;
    const raws = data.map(mapSampath).filter(Boolean);
    const norm = expectSane("sampath", raws, 20);
    const pickme = norm.find((n) => n.merchant === "PickMe")!;
    expect(pickme.validFrom?.toISOString().slice(0, 10)).toBe("2026-09-26");
    expect(pickme.validTo?.toISOString().slice(0, 10)).toBe("2026-10-04");
    expect(pickme.cardTypes.sort()).toEqual(["CREDIT", "DEBIT"]);
    expect(pickme.networks.sort()).toEqual(["MASTERCARD", "VISA"]);
  });
});
