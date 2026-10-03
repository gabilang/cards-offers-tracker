"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/auth";
import { db } from "@/lib/db";
import { runNotifications } from "@/notifications/digest";
import { runScrape } from "@/scrapers/run";

export async function triggerScrape(form: FormData) {
  await requireAdmin();
  const bankId = String(form.get("bankId") ?? "");
  const running = await db.scrapeRun.count({
    where: { status: "RUNNING", startedAt: { gte: new Date(Date.now() - 30 * 60_000) }, ...(bankId ? { bankId } : {}) },
  });
  if (running) return;
  // Scrapes can take minutes (Seylan reads a page per offer), so they run in the background.
  void runScrape(bankId ? [bankId] : undefined)
    .then(() => runNotifications({ frequencies: ["INSTANT"] }))
    .catch((e) => console.error("background scrape failed", e));
  await new Promise((r) => setTimeout(r, 300)); // let the RUNNING rows appear before re-rendering
  revalidatePath("/admin/scrapes");
}
