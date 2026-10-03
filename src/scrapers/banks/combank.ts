import type { BankScraper, RawOffer } from "../types";
import { absolute, guessMerchant, load, text } from "../util";

const URL = "https://www.combank.lk/rewards-promotions";

export function parseCombank(html: string): RawOffer[] {
  const $ = load(html);
  const seen = new Set<string>();
  const out: RawOffer[] = [];
  $("a.reward").each((_, el) => {
    const a = $(el);
    const url = absolute(a.attr("href"), URL);
    if (!url || seen.has(url)) return;
    seen.add(url);
    const title = text(a.find(".reward-content h3").text());
    const bg = a.find(".reward-image").attr("style") ?? "";
    out.push({
      externalId: url.split("/").pop(),
      title,
      merchant: guessMerchant(title),
      category: text(a.find("p.category").text()),
      discountText: text(a.find(".offer-tag").text()) || undefined,
      validityText: text(a.find(".valid-date").text()),
      url,
      imageUrl: /url\('([^']+)'\)/.exec(bg)?.[1],
    });
  });
  return out;
}

export const combank: BankScraper = {
  bankId: "combank",
  kind: "http",
  async scrape(ctx) {
    return parseCombank(await ctx.fetchText(URL));
  },
};
