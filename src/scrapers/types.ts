export type CardType = "CREDIT" | "DEBIT";
export type Network = "VISA" | "MASTERCARD" | "AMEX";

/** What a bank scraper returns; loosely structured, cleaned up by normalizeOffer(). */
export interface RawOffer {
  externalId?: string;
  title: string;
  merchant?: string;
  description?: string;
  category?: string;
  discountText?: string;
  url?: string;
  imageUrl?: string;
  terms?: string;
  /** Free text describing validity, e.g. "Valid till 31st October 2026". */
  validityText?: string;
  /** Set when the source gives structured dates. */
  validFrom?: Date | null;
  validTo?: Date | null;
  /** Extra text to search for card types / networks (defaults to title + description). */
  cardText?: string;
}

export interface NormalizedOffer {
  bankId: string;
  externalId: string | null;
  title: string;
  merchant: string | null;
  description: string | null;
  category: string;
  bankCategory: string | null;
  discountText: string | null;
  discountPct: number | null;
  url: string | null;
  imageUrl: string | null;
  terms: string | null;
  cardTypes: CardType[];
  networks: Network[];
  tiers: string[];
  validFrom: Date | null;
  validTo: Date | null;
  recurrence: string | null;
  rawValidity: string | null;
  contentHash: string;
}

export interface RenderResult {
  html: string;
  /** Bodies of JSON responses whose URL matched `captureJson`. */
  json: { url: string; body: unknown }[];
}

export interface ScrapeContext {
  fetchText(url: string, init?: RequestInit): Promise<string>;
  fetchJson<T = unknown>(url: string, init?: RequestInit): Promise<T>;
  /** Load a page in headless Chromium (browser scrapers only) and return the rendered HTML. */
  render(url: string, opts?: { captureJson?: RegExp; waitForSelector?: string }): Promise<RenderResult>;
  log(msg: string): void;
}

export interface BankScraper {
  bankId: string;
  /** "http" scrapers use fetch; "browser" scrapers need Playwright. */
  kind: "http" | "browser";
  scrape(ctx: ScrapeContext): Promise<RawOffer[]>;
}
