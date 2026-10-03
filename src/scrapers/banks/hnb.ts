import type { BankScraper, RawOffer } from "../types";
import { parseIso } from "../normalize/dates";

const API = "https://venus.hnb.lk/api";
const PAGE_SIZE = 100;

interface HnbPromo {
  id: number;
  title: string;
  thumb?: string;
  merchant?: string;
  cardType?: string;
  from?: string;
  to?: string;
  valid?: string;
}
interface HnbPage {
  page: number;
  totalPages: number;
  data: HnbPromo[];
}

export function mapHnb(p: HnbPromo): RawOffer {
  const fromMatch = /(\d{4}-\d{2}-\d{2})/.exec(p.valid ?? "");
  return {
    externalId: String(p.id),
    title: p.title,
    merchant: p.merchant,
    url: `https://www.hnb.lk/personal/promotions/card-promotions/${p.id}`,
    imageUrl: p.thumb ? `https://venus.hnb.lk/${p.thumb}` : undefined,
    validityText: p.valid,
    validFrom: parseIso(p.from ?? fromMatch?.[1]),
    validTo: parseIso(p.to),
    cardText: `${p.cardType ?? ""} ${p.title}`,
  };
}

export const hnb: BankScraper = {
  bankId: "hnb",
  kind: "http",
  async scrape(ctx) {
    const out: RawOffer[] = [];
    for (let page = 1; ; page++) {
      const res = await ctx.fetchJson<HnbPage>(`${API}/get_all_web_card_promos?page=${page}&limit=${PAGE_SIZE}`);
      out.push(...res.data.map(mapHnb));
      if (page >= res.totalPages || res.data.length === 0) break;
    }
    return out;
  },
};
