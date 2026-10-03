import type { BankScraper, RawOffer } from "../types";
import { parseCompact } from "../normalize/dates";
import { load, slugToCategory, text } from "../util";

const BASE = "https://www.peoplesbank.lk/promotion-category";
const NETWORK_SLUGS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard" };
type CardKind = "credit" | "debit";

export function parsePeoplesCategoryLinks(html: string, kind: CardKind): string[] {
  const $ = load(html);
  const slugs = new Set<string>();
  $(`a[href*="/promotion-category/"]`).each((_, a) => {
    const href = $(a).attr("href")!;
    const m = /\/promotion-category\/([a-z0-9-]+)\/\?cardType=(credit|debit)_card/.exec(href);
    if (m && m[2] === kind) slugs.add(m[1]);
  });
  // Network pages repeat merchant offers, so they go last and only add what is missing.
  return [...slugs].sort((a, b) => Number(a in NETWORK_SLUGS) - Number(b in NETWORK_SLUGS));
}

export function parsePeoples(html: string, slug: string, kind: CardKind): RawOffer[] {
  const $ = load(html);
  const out: RawOffer[] = [];
  $("article.offer-card").each((_, el) => {
    const card = $(el);
    const cal = card.find(".calendar-btn");
    const merchant = text(card.find(".promo-short").text());
    const details = text(card.find(".merchant-name").text()).replace(/\s*\.\.\.See more$/, "");
    const discount = text(card.find(".discount-badge").text());
    const url = card.find("a[href*='/promotion/']").first().attr("href");
    const start = cal.attr("data-start");
    const end = cal.attr("data-end");
    const validity = text(card.find(".valid-date").text());
    out.push({
      externalId: url?.replace(/\/$/, "").split("/").pop(),
      title: text(cal.attr("data-title")) || `${discount} at ${merchant}`,
      merchant,
      description: details,
      discountText: discount,
      category: slug in NETWORK_SLUGS ? undefined : slugToCategory(slug),
      validityText: validity,
      // The calendar attributes are structured; fall back to the text when they are empty.
      ...(end ? { validTo: parseCompact(end), validFrom: start ? parseCompact(start) : undefined } : {}),
      url,
      imageUrl: card.find(".offer-image img").attr("src"),
      cardText: `${kind} ${NETWORK_SLUGS[slug] ?? ""} ${details}`,
    });
  });
  return out;
}

export const peoples: BankScraper = {
  bankId: "peoples",
  kind: "http",
  async scrape(ctx) {
    const byUrl = new Map<string, RawOffer>();
    for (const kind of ["credit", "debit"] as const) {
      const first = await ctx.fetchText(`${BASE}/restaurants/?cardType=${kind}_card`);
      for (const slug of parsePeoplesCategoryLinks(first, kind)) {
        const html = slug === "restaurants" ? first : await ctx.fetchText(`${BASE}/${slug}/?cardType=${kind}_card`);
        for (const o of parsePeoples(html, slug, kind)) {
          const key = o.url ?? o.title;
          const prev = byUrl.get(key);
          if (prev) {
            // Seen under a network page: record the network on the existing offer.
            if (slug in NETWORK_SLUGS) prev.cardText += ` ${NETWORK_SLUGS[slug]}`;
            if (!prev.cardText!.includes(kind)) prev.cardText += ` ${kind}`;
          } else byUrl.set(key, o);
        }
      }
    }
    return [...byUrl.values()];
  },
};
