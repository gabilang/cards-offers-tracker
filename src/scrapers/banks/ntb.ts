import type { BankScraper, RawOffer } from "../types";
import { absolute, load, text } from "../util";

const URL = "https://www.nationstrust.com/promotions";

export function parseNtb(html: string): RawOffer[] {
  const $ = load(html);
  const out: RawOffer[] = [];
  $(".promo-box").each((_, el) => {
    const box = $(el);
    const offerLine = text(box.find(".info h5").text());
    const merchant = text(box.find(".info h6").text());
    const url = absolute(box.find(".promo-footer a").attr("href"), URL);
    out.push({
      externalId: url?.split("/").pop(),
      title: merchant ? `${merchant} – ${offerLine}` : offerLine,
      merchant: merchant || undefined,
      description: offerLine,
      discountText: offerLine,
      category: text(box.find(".tag").text()),
      validityText: text(box.find(".promo-footer small").text()),
      url,
      imageUrl: box.find(".promo-image img").attr("src"),
    });
  });
  return out;
}

export const ntb: BankScraper = {
  bankId: "ntb",
  kind: "http",
  async scrape(ctx) {
    return parseNtb(await ctx.fetchText(URL));
  },
};
