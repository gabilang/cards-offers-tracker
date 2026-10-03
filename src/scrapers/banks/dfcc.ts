import type { BankScraper, RawOffer } from "../types";
import { absolute, guessMerchant, load, text } from "../util";

const ORIGIN = "https://www.dfcc.lk";
const INDEXES = [`${ORIGIN}/cards/card-offers/credit-card-offers`, `${ORIGIN}/cards/card-offers/debit-card-offers`];
// Index/landing pages, not offer lists.
const NOT_CATEGORIES = new Set(["dfcc-cards", "dfcc-card-offers", "credit-card-offers", "debit-card-offers", "debit-card-promotions"]);

export interface DfccCategory {
  slug: string;
  name: string;
}

export function parseDfccCategories(html: string): DfccCategory[] {
  const $ = load(html);
  const out = new Map<string, DfccCategory>();
  $("a[href]").each((_, a) => {
    const href = absolute($(a).attr("href"), `${ORIGIN}/cards/card-offers/`) ?? "";
    const m = /\/cards\/card-offers\/([a-z0-9-]+)$/.exec(href);
    if (!m || NOT_CATEGORIES.has(m[1])) return;
    const name = text($(a).text()) || text($(a).find("img").attr("alt"));
    if (!out.has(m[1])) out.set(m[1], { slug: m[1], name });
  });
  return [...out.values()];
}

const categoryName = (c: DfccCategory) =>
  /visa|master/i.test(c.slug) ? undefined : (c.name || c.slug).toLowerCase().replace(/-(credit|debit|promotion(-\d+)?)$/g, "");

export function parseDfcc(html: string, category?: DfccCategory): RawOffer[] {
  const $ = load(html);
  const out: RawOffer[] = [];
  $("a.cardd").each((_, el) => {
    const a = $(el);
    const offerText = text(a.find(".cardOfferText").text());
    const tags = a.find(".card-tags .tag").map((_, t) => text($(t).text())).get().join(" ");
    const url = absolute(a.attr("href"), ORIGIN);
    const firstSentence = offerText.split(/(?<=\.)\s/)[0];
    out.push({
      externalId: url?.split("/").pop(),
      title: firstSentence,
      merchant: guessMerchant(firstSentence),
      description: offerText,
      discountText: text(a.find(".discount-badgee").text()) || undefined,
      category: category ? categoryName(category) : undefined,
      validityText: text(a.find(".cardOfferValid").text()),
      url,
      imageUrl: a.find("img.offerMainImage").attr("src"),
      cardText: `${tags} ${offerText} ${/visa/i.test(category?.slug ?? "") ? "visa" : ""} ${/master/i.test(category?.slug ?? "") ? "mastercard" : ""}`,
    });
  });
  return out;
}

export const dfcc: BankScraper = {
  bankId: "dfcc",
  kind: "browser",
  async scrape(ctx) {
    const byUrl = new Map<string, RawOffer>();
    for (const index of INDEXES) {
      const categories = parseDfccCategories((await ctx.render(index)).html);
      // Network pages repeat offers, so they are read last.
      categories.sort((a, b) => Number(/visa|master/.test(a.slug)) - Number(/visa|master/.test(b.slug)));
      for (const cat of categories) {
        const { html } = await ctx.render(`${ORIGIN}/cards/card-offers/${cat.slug}`, { waitForSelector: "a.cardd" });
        for (const o of parseDfcc(html, cat)) {
          const key = o.url ?? o.title;
          const prev = byUrl.get(key);
          if (prev) prev.cardText += ` ${o.cardText}`;
          else byUrl.set(key, o);
        }
      }
    }
    return [...byUrl.values()];
  },
};
