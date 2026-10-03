import "dotenv/config";
import cron from "node-cron";
import { db } from "@/lib/db";
import { runNotifications } from "@/notifications/digest";
import { runScrape } from "@/scrapers/run";

const SCHEDULE = process.env.SCRAPE_CRON ?? "0 6 * * *"; // 06:00 Sri Lanka time
let running = false;

async function cycle() {
  if (running) return console.log("previous cycle still running; skipping");
  running = true;
  const started = Date.now();
  try {
    const scrape = await runScrape();
    console.table(scrape.map(({ error, ...r }) => ({ ...r, error: error?.slice(0, 60) })));
    const notify = await runNotifications();
    console.table(notify);
  } catch (e) {
    console.error("cycle failed", e);
  } finally {
    running = false;
    console.log(`cycle finished in ${Math.round((Date.now() - started) / 1000)}s`);
  }
}

if (process.argv.includes("--once")) {
  cycle().finally(() => db.$disconnect());
} else if (process.argv.includes("--notify-only")) {
  runNotifications().then(console.table).finally(() => db.$disconnect());
} else {
  console.log(`worker started; schedule "${SCHEDULE}" (Asia/Colombo)`);
  cron.schedule(SCHEDULE, cycle, { timezone: "Asia/Colombo" });
  // INSTANT users are also checked hourly, so offers found by manual scrapes go out promptly.
  cron.schedule("15 * * * *", () => void runNotifications({ frequencies: ["INSTANT"] }).catch(console.error), {
    timezone: "Asia/Colombo",
  });
}
