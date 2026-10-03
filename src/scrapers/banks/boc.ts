import type { BankScraper, RawOffer } from "../types";
import { load, slugToCategory, text } from "../util";

const BASE = "https://www.boc.lk/personal-banking/card-offers";
// Network-themed pages repeat offers from the merchant categories, so they go last.
const LAST = ["visa-offers", "mastercard-offers"];

export function parseBocCategoryLinks(html: string): string[] {
  const $ = load(html);
  const slugs = new Set<string>();
  $(`a[href^="${BASE}/"]`).each((_, el) => {
    const rest = $(el).attr("href")!.slice(BASE.length + 1);
    if (/^[a-z0-9-]+$/.test(rest)) slugs.add(rest);
  });
  return [...slugs].sort((a, b) => Number(LAST.includes(a)) - Number(LAST.includes(b)));
}

export function parseBocItems(html: string, categorySlug: string): RawOffer[] {
  const $ = load(html);
  const out: RawOffer[] = [];
  $("a.product").each((_, el) => {
    const a = $(el);
    const url = a.attr("href");
    const merchant = text(a.find(".product-detail h4").text());
    const discount = text(a.find(".offers-panel").text());
    const description = text(a.find(".description").text());
    const expiry = text(a.find(".highligh-box").text());
    const network = categorySlug === "visa-offers" ? " Visa" : categorySlug === "mastercard-offers" ? " Mastercard" : "";
    out.push({
      externalId: url?.replace(`${BASE}/`, "").replace(/\/product$/, ""),
      title: discount ? `${discount} at ${merchant}` : merchant,
      merchant,
      description: [text(a.find(".location-name").text()), description].filter(Boolean).join(" · "),
      discountText: discount,
      category: LAST.includes(categorySlug) ? undefined : slugToCategory(categorySlug),
      validityText: expiry,
      url,
      imageUrl: a.find("img.offer-logo").attr("src"),
      cardText: description + network,
    });
  });
  return out;
}

export const boc: BankScraper = {
  bankId: "boc",
  kind: "http",
  async scrape(ctx) {
    const slugs = parseBocCategoryLinks(await ctx.fetchText(BASE));
    const seen = new Set<string>();
    const out: RawOffer[] = [];
    for (const slug of slugs) {
      let html = await ctx.fetchText(`${BASE}/${slug}`);
      for (let page = 2; page < 50; page++) {
        const more = await ctx.fetchJson<{ html: string; finish: boolean }>(`${BASE}/${slug}?page=${page}`, {
          headers: { "X-Requested-With": "XMLHttpRequest", Accept: "application/json" },
        });
        html += more.html ?? "";
        if (more.finish || !more.html?.trim()) break;
      }
      for (const o of parseBocItems(html, slug)) {
        const key = o.merchant + "|" + o.validityText;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(o);
      }
    }
    return out;
  },
};
