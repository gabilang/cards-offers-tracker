import type { BankScraper, RawOffer } from "../types";
import { load, text } from "../util";

const PAGE = "https://www.sampath.lk/sampath-cards/credit-card-offer";
const NETWORK_CATEGORIES: Record<string, string> = { VISA_Offers: "Visa", Mastercard_Offers: "Mastercard" };

interface SampathPromo {
  id: number;
  company_name?: string;
  short_discount?: string;
  discounts?: string;
  short_description?: string;
  promotion_details?: string;
  terms_and_conditions?: string;
  category?: string;
  image_url?: string;
  expire_on?: number;
  enable?: boolean;
  delete_status?: boolean;
  cards_new?: { title: string; description: string }[];
}

const strip = (html: string | undefined) => (html ? text(load(`<div>${html}</div>`)("div").text()) : "");

/** Epoch ms -> the calendar day in Sri Lanka, stored as UTC midnight. */
function colomboDay(ms: number | undefined): Date | undefined {
  if (!ms) return undefined;
  const d = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date(ms));
  return new Date(`${d}T00:00:00Z`);
}

export function mapSampath(p: SampathPromo): RawOffer | null {
  if (p.delete_status || p.enable === false) return null;
  const period = p.cards_new?.find((c) => /period|valid/i.test(c.title))?.description;
  const discount = strip(p.short_discount || p.discounts);
  const merchant = text(p.company_name);
  const who = strip(p.short_description);
  const network = NETWORK_CATEGORIES[p.category ?? ""] ?? "";
  return {
    externalId: String(p.id),
    title: discount ? `${discount} at ${merchant}` : merchant,
    merchant,
    description: who,
    discountText: discount,
    category: network ? undefined : p.category?.replace(/_/g, " ").toLowerCase(),
    validityText: text(period),
    // Only fall back to expire_on when the period text is missing.
    ...(period ? {} : { validTo: colomboDay(p.expire_on) ?? null }),
    url: `${PAGE}?id=${p.id}`,
    imageUrl: p.image_url,
    terms: strip(p.terms_and_conditions).slice(0, 2000),
    cardText: `${who} ${strip(p.promotion_details)} ${network}`,
  };
}

export const sampath: BankScraper = {
  bankId: "sampath",
  kind: "browser",
  async scrape(ctx) {
    // Sampath's API only answers the site's own page, so the page is loaded and its API response captured.
    const { json } = await ctx.render(PAGE, { captureJson: /\/api\/card-promotions$/ });
    const body = json.find((j) => Array.isArray((j.body as { data?: unknown[] })?.data))?.body as
      | { data: SampathPromo[] }
      | undefined;
    if (!body?.data.length) throw new Error("Sampath promotions API returned no data (the site may be rejecting automated requests)");
    return body.data.map(mapSampath).filter((o): o is RawOffer => o !== null);
  },
};
