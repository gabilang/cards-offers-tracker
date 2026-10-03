import * as chrono from "chrono-node";

export interface Validity {
  from: Date | null;
  to: Date | null;
  recurrence: string | null;
}

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
};
const DAYS: Record<string, string> = {
  mon: "MON", tue: "TUE", wed: "WED", thu: "THU", fri: "FRI", sat: "SAT", sun: "SUN",
};

/** Dates are stored as UTC midnight of the calendar day in Sri Lanka. */
export function day(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

export function endOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

/** "20260930" -> Date */
export function parseCompact(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(s);
  return m ? day(+m[1], +m[2] - 1, +m[3]) : null;
}

/** "2026-09-30" or "2026-09-30T00:00:00Z" -> Date */
export function parseIso(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s.trim());
  return m ? day(+m[1], +m[2] - 1, +m[3]) : null;
}

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Fix misspelled month names next to a number, e.g. "31st Deecember 2026" -> "31st December 2026". */
export function fixMonthTypos(text: string): string {
  return text.replace(/(\d\s*)([a-z]{5,11})\b/gi, (whole, pre: string, word: string) => {
    const w = word.toLowerCase();
    if (MONTH_NAMES.includes(w)) return whole;
    const best = MONTH_NAMES.map((m) => [m, editDistance(w, m)] as const).sort((a, b) => a[1] - b[1])[0];
    return best[1] <= 2 && best[1] < w.length / 3 ? pre + best[0] : whole;
  });
}

function toDay(d: Date): Date {
  return day(d.getFullYear(), d.getMonth(), d.getDate());
}

function extractRecurrence(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bweekends?\b/.test(lower)) return "SAT,SUN";
  if (/\bweekdays?\b/.test(lower)) return "MON,TUE,WED,THU,FRI";
  const m = lower.match(/every\s+([a-z,&\s]+?)(?:\s+(?:from|till|until|to|up to|valid|during|in|of)\b|$)/);
  if (!m) return null;
  const days = [...m[1].matchAll(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*/g)].map((x) => DAYS[x[1]]);
  return days.length ? [...new Set(days)].join(",") : null;
}

/**
 * Parse the free-text validity lines banks publish, e.g.
 *  "Offer valid till 31st October 2026"
 *  "Valid every Sat from 1st October to 31st October 2026"
 *  "1st September - 31st October 2026"
 *  "Expiration date : 30 Sep 2026"
 */
export function parseValidity(text: string | null | undefined, ref: Date = new Date()): Validity {
  if (!text) return { from: null, to: null, recurrence: null };
  const clean = fixMonthTypos(text.replace(/\s+/g, " ").replace(/(\d)(st|nd|rd|th)\b/gi, "$1").trim());
  const recurrence = extractRecurrence(clean);

  // "1 September - 31 October 2026" / "1 Sep to 31 Oct 2026" / "01.09.2026 - 31.10.2026"
  const range = clean.match(
    /(\d{1,2})\s*([a-z]{3,9})?\.?\s*(\d{4})?\s*(?:-|–|&|and|to|until|till)\s*(\d{1,2})\s*([a-z]{3,9})\.?,?\s*(\d{4})/i,
  );
  if (range) {
    const [, d1, m1, y1, d2, m2, y2] = range;
    const mo2 = MONTHS[m2.toLowerCase().slice(0, 4)] ?? MONTHS[m2.toLowerCase().slice(0, 3)];
    const mo1 = m1 ? (MONTHS[m1.toLowerCase().slice(0, 4)] ?? MONTHS[m1.toLowerCase().slice(0, 3)]) : mo2;
    if (mo1 !== undefined && mo2 !== undefined) {
      const yr2 = +y2;
      const yr1 = y1 ? +y1 : mo1 > mo2 ? yr2 - 1 : yr2;
      return { from: day(yr1, mo1, +d1), to: day(yr2, mo2, +d2), recurrence };
    }
  }

  // Weekday names describe recurrence, not dates; keep chrono from reading them as "next Wednesday".
  const noWeekdays = clean.replace(/\b(mon|tues?|wed(nes)?|thu(rs)?|fri|sat(ur)?|sun)(day)?s?\b/gi, " ");
  const results = chrono.en.GB.parse(noWeekdays, ref, { forwardDate: true });
  const dates = results.flatMap((r) => [r.start, r.end].filter(Boolean)).map((c) => toDay(c!.date()));
  if (dates.length === 0) return { from: null, to: null, recurrence };

  const lower = clean.toLowerCase();
  if (dates.length === 1) {
    const only = dates[0];
    // "valid till X" / "expiration date X" -> end date; "valid on X" -> single day; "from X" -> start
    if (/\b(on)\b/.test(lower) && !/\b(till|until|expir|up to|ends?|before)\b/.test(lower)) {
      return { from: only, to: only, recurrence };
    }
    if (/\bfrom\b/.test(lower) && !/\b(till|until|to|expir)\b/.test(lower)) {
      return { from: only, to: null, recurrence };
    }
    return { from: null, to: only, recurrence };
  }
  const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
  return { from: sorted[0], to: sorted[sorted.length - 1], recurrence };
}
