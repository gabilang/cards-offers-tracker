import "dotenv/config";
import { runScrape } from "@/scrapers/run";
import { db } from "@/lib/db";

const banks = process.argv.slice(2);
runScrape(banks.length ? banks : undefined)
  .then((results) => {
    console.table(results.map(({ error, ...r }) => ({ ...r, error: error?.slice(0, 80) })));
    process.exitCode = results.some((r) => r.status === "FAILED") ? 1 : 0;
  })
  .finally(() => db.$disconnect());
