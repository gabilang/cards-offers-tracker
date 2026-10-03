import { db } from "@/lib/db";
import { ensureBanks } from "@/lib/banks";
import { closeBrowser } from "./browser";
import { createHttpContext } from "./http";
import { normalizeOffer } from "./normalize";
import { SCRAPERS } from "./registry";

export interface BankRunResult {
  bankId: string;
  status: "SUCCESS" | "FAILED" | "SKIPPED";
  offersFound: number;
  newOffers: number;
  error?: string;
}

export async function scrapeBank(bankId: string): Promise<BankRunResult> {
  const scraper = SCRAPERS[bankId];
  if (!scraper) return { bankId, status: "SKIPPED", offersFound: 0, newOffers: 0, error: "No scraper for this bank" };

  const run = await db.scrapeRun.create({ data: { bankId } });
  const log = (m: string) => console.log(`[${bankId}] ${m}`);
  try {
    const raws = await scraper.scrape(createHttpContext(log));
    if (raws.length === 0) throw new Error("Scraper returned 0 offers; the page layout may have changed");

    const now = new Date();
    const offers = raws.map((r) => normalizeOffer(bankId, r, now));
    const unique = [...new Map(offers.map((o) => [o.contentHash, o])).values()];

    const existing = new Set(
      (await db.offer.findMany({ where: { contentHash: { in: unique.map((o) => o.contentHash) } }, select: { contentHash: true } }))
        .map((o) => o.contentHash),
    );

    let newOffers = 0;
    for (const o of unique) {
      const data = {
        ...o,
        cardTypes: JSON.stringify(o.cardTypes),
        networks: JSON.stringify(o.networks),
        tiers: JSON.stringify(o.tiers),
      };
      if (existing.has(o.contentHash)) {
        await db.offer.update({ where: { contentHash: o.contentHash }, data: { ...data, lastSeenAt: now, isActive: true } });
      } else {
        await db.offer.create({ data: { ...data, firstSeenAt: now, lastSeenAt: now } });
        newOffers++;
      }
    }

    // Offers no longer listed by the bank are retired.
    await db.offer.updateMany({
      where: { bankId, isActive: true, contentHash: { notIn: unique.map((o) => o.contentHash) } },
      data: { isActive: false },
    });

    await db.scrapeRun.update({
      where: { id: run.id },
      data: { status: "SUCCESS", finishedAt: new Date(), offersFound: unique.length, newOffers },
    });
    await db.bank.update({ where: { id: bankId }, data: { lastScrapedAt: new Date() } });
    log(`${unique.length} offers (${newOffers} new)`);
    return { bankId, status: "SUCCESS", offersFound: unique.length, newOffers };
  } catch (e) {
    const error = (e as Error).stack ?? String(e);
    await db.scrapeRun.update({ where: { id: run.id }, data: { status: "FAILED", finishedAt: new Date(), error } });
    log(`FAILED: ${(e as Error).message}`);
    return { bankId, status: "FAILED", offersFound: 0, newOffers: 0, error: (e as Error).message };
  }
}

/** Scrape the given banks (default: all enabled, available banks). One failure never stops the others. */
export async function runScrape(bankIds?: string[]): Promise<BankRunResult[]> {
  await ensureBanks();
  const banks = await db.bank.findMany({
    where: { enabled: true, available: true, ...(bankIds?.length ? { id: { in: bankIds } } : {}) },
  });
  const results: BankRunResult[] = [];
  // Different banks are different hosts, so they could run in parallel; sequential keeps load and logs simple.
  try {
    for (const b of banks) results.push(await scrapeBank(b.id));
  } finally {
    await closeBrowser();
  }
  return results;
}
