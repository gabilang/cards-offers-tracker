import * as cheerio from "cheerio";

export const load = (html: string) => cheerio.load(html);
export const text = (s: string | undefined | null) => (s ?? "").replace(/\s+/g, " ").trim();

/** "… at Hilton Colombo with ComBank Credit Cards" -> "Hilton Colombo" */
export function guessMerchant(title: string): string | undefined {
  const m = /\b(?:at|from|@)\s+([A-Z0-9].+?)(?=\.\s|\.$|,|\s+(?:with|using|for|on|when)\b)/.exec(title);
  return m?.[1]?.trim();
}

export function absolute(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch {
    return undefined;
  }
}

export function slugToCategory(slug: string): string {
  return slug.replace(/-offers?$/, "").replace(/-/g, " ").trim();
}
