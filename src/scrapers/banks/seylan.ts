import type { BankScraper, RawOffer } from "../types";
import { parseCompact } from "../normalize/dates";
import { load, slugToCategory, text } from "../util";

const BASE = "https://www.seylan.lk/promotions/cards";

export function parseSeylan(html: string, cardType: "credit" | "debit"): { offers: RawOffer[]; maxPage: number } {
  const $ = load(html);
  const offers: RawOffer[] = [];
  $(".new-card").each((_, el) => {
    const card = $(el);
    const title = text(card.find(".new-promotion-title").text());
    const desc = text(card.find(".new-promotion-dis").text()).replace(/\.\.\.$/, "");
    const cal = card.find("a[href*='calendar.google.com']").attr("href") ?? "";
    const dates = /dates=(\d{8})\/(\d{8})/.exec(cal);
    const url = card.find("a[href]").filter((_, a) => !$(a).attr("href")!.includes("calendar.google")).first().attr("href");
    const cat = url?.match(/\/promotions\/cards\/([a-z0-9-]+)\//)?.[1];
    offers.push({
      externalId: url?.split("seylan.lk/").pop(),
      title: desc ? `${title} – ${desc}` : title,
      merchant: title,
      description: desc,
      discountText: desc,
      category: cat ? slugToCategory(cat) : undefined,
      validityText: dates ? `${dates[1]} - ${dates[2]}` : undefined,
      validFrom: dates ? parseCompact(dates[1]) : null,
      validTo: dates ? parseCompact(dates[2]) : null,
      url,
      imageUrl: card.find("img.new-promotion-img").attr("src"),
      // Listing comes from the credit_card / debit_card filter, so that is always a valid card type.
      cardText: `${cardType} ${title} ${desc}`,
    });
  });
  const pages = $("a[href*='page=']")
    .map((_, a) => Number(/[?&]page=(\d+)/.exec($(a).attr("href")!)?.[1] ?? 0))
    .get();
  return { offers, maxPage: Math.max(1, ...pages) };
}

/** The listing's calendar dates are unreliable, so validity and terms come from the detail page. */
export function parseSeylanDetail(html: string): { validityText?: string; terms?: string } {
  const $ = load(html);
  $("style,script,nav,header,footer").remove();
  const body = text($("body").text());
  const start = body.indexOf("Details / Promotions");
  const end = body.indexOf("Related Promotions");
  const section = body.slice(start >= 0 ? start + 20 : 0, end > start ? end : undefined);
  const validity = /\b(valid\b[^.]*?\d{4})/i.exec(section)?.[1];
  const tc = section.split("Terms and Conditions")[1];
  return { validityText: validity, terms: tc?.trim().slice(0, 2000) };
}

export const seylan: BankScraper = {
  bankId: "seylan",
  kind: "http",
  async scrape(ctx) {
    const byUrl = new Map<string, RawOffer>();
    for (const type of ["credit", "debit"] as const) {
      let maxPage = 1;
      for (let page = 1; page <= maxPage && page <= 80; page++) {
        const html = await ctx.fetchText(`${BASE}?type%5B%5D=${type}_card&page=${page}`);
        const res = parseSeylan(html, type);
        maxPage = res.maxPage;
        for (const o of res.offers) {
          const key = o.url ?? o.title;
          const prev = byUrl.get(key);
          // Same offer listed under both filters -> it applies to credit and debit cards.
          if (prev) prev.cardText = `${prev.cardText} ${type}`;
          else byUrl.set(key, o);
        }
        if (res.offers.length === 0) break;
      }
    }
    const offers = [...byUrl.values()];
    for (const o of offers) {
      if (!o.url) continue;
      try {
        const d = parseSeylanDetail(await ctx.fetchText(o.url));
        if (d.validityText) {
          o.validityText = d.validityText;
          // Let the normalizer parse the detail text instead of the calendar dates.
          delete o.validFrom;
          delete o.validTo;
        }
        o.terms = d.terms;
      } catch (e) {
        ctx.log(`seylan detail failed for ${o.url}: ${(e as Error).message}`);
      }
    }
    return offers;
  },
};
