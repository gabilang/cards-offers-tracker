import type { BankScraper, RawOffer } from "../types";
import { absolute, load, text } from "../util";

const URL = "https://www.ndbbank.com/cards/card-offers";

export function parseNdb(html: string): RawOffer[] {
  const $ = load(html);
  const out: RawOffer[] = [];
  $("a[href*='/cards/card-offers/offer-details/']").each((_, el) => {
    const a = $(el);
    const body = a.find(".card-body");
    if (!body.length) return;
    const headline = text(body.find("h5.card-title").text());
    const merchant = text(body.find("p.card-title").text());
    const cards = text(body.find("p.text-muted").first().text());
    const url = absolute(a.attr("href"), URL);
    out.push({
      externalId: url?.split("/").pop(),
      title: merchant ? `${headline} at ${merchant}` : headline,
      merchant: merchant || undefined,
      description: cards,
      discountText: headline,
      validityText: text(body.find(".offer-date").text()),
      url,
      imageUrl: a.find("img.card-img-top").first().attr("src"),
      cardText: `${cards} ${headline}`,
    });
  });
  return out;
}

export const ndb: BankScraper = {
  bankId: "ndb",
  kind: "http",
  async scrape(ctx) {
    return parseNdb(await ctx.fetchText(URL));
  },
};
