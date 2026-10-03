/** "Up to 35% off" -> 35, "35% / Off" -> 35, "Rs. 1,000 off" -> null */
export function parseDiscountPct(text: string | null | undefined): number | null {
  if (!text) return null;
  const pcts = [...text.matchAll(/(\d{1,2}(?:\.\d+)?)\s*%/g)].map((m) => parseFloat(m[1]));
  return pcts.length ? Math.max(...pcts) : null;
}
