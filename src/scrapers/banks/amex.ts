import type { BankScraper, RawOffer } from "../types";
import { load, slugToCategory, text } from "../util";

const BASE = "https://www.americanexpress.lk/en/offers";
const SKIP = new Set(["corporate-card-offers"]);

export function parseAmexCategoryLinks(html: string): string[] {
  const $ = load(html);
  const slugs = new Set<string>();
  $(`a[href^="${BASE}/"]`).each((_, el) => {
    const slug = $(el).attr("href")!.slice(BASE.length + 1).split(/[/?#]/)[0];
    if (slug && !SKIP.has(slug)) slugs.add(slug);
  });
  return [...slugs];
}

export function parseAmex(html: string, categorySlug: string): RawOffer[] {
  const $ = load(html);
  const out: RawOffer[] = [];
  $("a.alloffer-box-inner").each((_, el) => {
    const a = $(el);
    const merchant = text(a.find(".alloffer-heading").text());
    const savings = text(a.find(".value-limit").text());
    const location = text(a.find(".offer-location").text());
    const validity = text(a.find(".alloffer-text > div").last().text());
    const url = a.attr("href");
    out.push({
      externalId: url?.split("/offers/").pop(),
      title: savings ? `${savings} at ${merchant}` : merchant,
      merchant,
      description: location || undefined,
      discountText: savings,
      category: slugToCategory(categorySlug),
      validityText: validity,
      url,
      imageUrl: a.find(".alloffer-image img").attr("src"),
      // Every offer on this site is for NTB American Express cards (all are credit cards).
      cardText: "American Express credit",
    });
  });
  return out;
}

export const amex: BankScraper = {
  bankId: "amex",
  kind: "http",
  async scrape(ctx) {
    const index = await ctx.fetchText(`${BASE}/dining-offers`);
    const slugs = parseAmexCategoryLinks(index);
    const seen = new Set<string>();
    const out: RawOffer[] = [];
    for (const slug of slugs) {
      const html = slug === "dining-offers" ? index : await ctx.fetchText(`${BASE}/${slug}`);
      for (const o of parseAmex(html, slug)) {
        if (o.url && seen.has(o.url)) continue;
        if (o.url) seen.add(o.url);
        out.push(o);
      }
    }
    return out;
  },
};
