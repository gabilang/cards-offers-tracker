import "dotenv/config";
import cron from "node-cron";
import { db } from "@/lib/db";
import { runNotifications } from "@/notifications/digest";
import { runScrape } from "@/scrapers/run";

const SCHEDULE = process.env.SCRAPE_CRON ?? "0 6 * * *"; // 06:00 Sri Lanka time
let running = false;

/** Scrape then notify. Returns false when a bank failed or the cycle crashed. */
async function cycle(): Promise<boolean> {
  if (running) {
    console.log("previous cycle still running; skipping");
    return true;
  }
  running = true;
  const started = Date.now();
  try {
    // Optional comma-separated bank ids, e.g. SCRAPE_BANKS="hnb,ntb" (set by the GitHub workflow input).
    const banks = (process.env.SCRAPE_BANKS ?? "").split(",").map((b) => b.trim()).filter(Boolean);
    const scrape = await runScrape(banks.length ? banks : undefined);
    console.table(scrape.map(({ error, ...r }) => ({ ...r, error: error?.slice(0, 60) })));
    // Users are emailed even if some banks failed; the failure is reported afterwards.
    const notify = await runNotifications();
    console.table(notify);
    return scrape.every((r) => r.status !== "FAILED");
  } catch (e) {
    console.error("cycle failed", e);
    return false;
  } finally {
    running = false;
    console.log(`cycle finished in ${Math.round((Date.now() - started) / 1000)}s`);
  }
}

if (process.argv.includes("--once")) {
  // A non-zero exit marks the GitHub Actions run as failed, which emails the repo owner.
  cycle()
    .then((ok) => {
      process.exitCode = ok ? 0 : 1;
    })
    .finally(() => db.$disconnect());
} else if (process.argv.includes("--notify-only")) {
  runNotifications().then(console.table).finally(() => db.$disconnect());
} else {
  console.log(`worker started; schedule "${SCHEDULE}" (Asia/Colombo)`);
  cron.schedule(SCHEDULE, () => void cycle(), { timezone: "Asia/Colombo" });
  // INSTANT users are also checked hourly, so offers found by manual scrapes go out promptly.
  cron.schedule("15 * * * *", () => void runNotifications({ frequencies: ["INSTANT"] }).catch(console.error), {
    timezone: "Asia/Colombo",
  });
}
