import Link from "next/link";
import { requireAdmin } from "@/auth";
import { db } from "@/lib/db";
import { SCRAPERS } from "@/scrapers/registry";
import { ensureBanks } from "@/lib/banks";
import { triggerScrape } from "./actions";

export const dynamic = "force-dynamic";

const time = (d: Date | null | undefined) => (d ? d.toLocaleString("en-GB", { timeZone: "Asia/Colombo" }) : "—");
const STATUS: Record<string, string> = {
  SUCCESS: "bg-accent-soft text-accent",
  FAILED: "bg-warn-soft text-danger",
  RUNNING: "bg-warn-soft text-warn-fg",
};

export default async function AdminScrapesPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const { notice, error } = await searchParams;
  await requireAdmin();
  const runsUrl = process.env.GITHUB_REPO
    ? `https://github.com/${process.env.GITHUB_REPO}/actions/workflows/scrape.yml`
    : null;
  await ensureBanks();
  const [banks, counts, runs, users] = await Promise.all([
    db.bank.findMany({ orderBy: { name: "asc" }, include: { scrapeRuns: { orderBy: { startedAt: "desc" }, take: 1 } } }),
    db.offer.groupBy({ by: ["bankId"], where: { isActive: true }, _count: true }),
    db.scrapeRun.findMany({ orderBy: { startedAt: "desc" }, take: 25, include: { bank: true } }),
    db.user.count(),
  ]);
  const active = new Map(counts.map((c) => [c.bankId, c._count]));
  const anyRunning = runs.some((r) => r.status === "RUNNING");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Scrapes</h1>
          <p className="text-sm text-muted">
            {users} users · every bank is scraped daily at 06:00 Sri Lanka time
            {runsUrl && (
              <>
                {" "}· <a href={runsUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">workflow runs ↗</a>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/scrapes" className="btn">Refresh</Link>
          <form action={triggerScrape}>
            <button className="btn-primary" disabled={anyRunning}>{anyRunning ? "Scrape running…" : "Scrape all banks"}</button>
          </form>
        </div>
      </div>

      {notice && (
        <p className={`card p-3 text-sm ${error ? "bg-warn-soft text-warn-fg" : "bg-accent-soft"}`}>{notice}</p>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr className="border-b border-border">
              <th className="p-3">Bank</th><th className="p-3">Active offers</th><th className="p-3">Last run</th>
              <th className="p-3">Status</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {banks.map((b) => {
              const last = b.scrapeRuns[0];
              const supported = b.available && !!SCRAPERS[b.id];
              return (
                <tr key={b.id} className="border-b border-border last:border-0">
                  <td className="p-3"><a href={b.website} target="_blank" rel="noopener noreferrer" className="hover:underline">{b.name}</a></td>
                  <td className="p-3 tabular-nums">{active.get(b.id) ?? 0}</td>
                  <td className="p-3 text-muted">{time(last?.startedAt)}</td>
                  <td className="p-3">
                    {!supported ? (
                      <span className="text-xs text-muted">{b.available ? "Scraper not built yet" : "Blocked by bot protection"}</span>
                    ) : last ? (
                      <span className={`rounded px-2 py-0.5 text-xs ${STATUS[last.status] ?? ""}`}>{last.status}</span>
                    ) : (
                      <span className="text-xs text-muted">Never run</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {supported && (
                      <form action={triggerScrape}>
                        <input type="hidden" name="bankId" value={b.id} />
                        <button className="text-xs text-accent hover:underline disabled:opacity-40" disabled={last?.status === "RUNNING"}>
                          Scrape now
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">Recent runs</h2>
        <div className="card divide-y divide-border">
          {runs.length === 0 && <p className="p-4 text-sm text-muted">No runs yet.</p>}
          {runs.map((r) => (
            <details key={r.id} className="p-3 text-sm">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`rounded px-2 py-0.5 text-xs ${STATUS[r.status] ?? ""}`}>{r.status}</span>
                <span className="font-medium">{r.bank.name}</span>
                <span className="text-muted">{time(r.startedAt)}</span>
                <span className="text-muted">{r.offersFound} offers, {r.newOffers} new</span>
                {r.finishedAt && <span className="text-muted">{Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000)}s</span>}
              </summary>
              {r.error && <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs text-danger">{r.error}</pre>}
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
