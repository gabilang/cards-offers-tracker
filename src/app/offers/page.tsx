import Link from "next/link";
import { currentUser } from "@/auth";
import { OfferCard } from "@/components/OfferCard";
import { db } from "@/lib/db";
import { todayInColombo } from "@/lib/matching";
import { findOffers, listCategories } from "@/lib/offers";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const many = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

function shift(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function OffersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const user = await currentUser();
  const [banks, categories, prefs] = await Promise.all([
    db.bank.findMany({ orderBy: { name: "asc" } }),
    listCategories(),
    user
      ? db.user.findUnique({ where: { id: user.id }, include: { cards: true, banks: true } })
      : Promise.resolve(null),
  ]);

  const today = todayInColombo();
  const fromParam = one(sp.from) ?? today;
  const toParam = one(sp.to) ?? fromParam;
  const mine = one(sp.mine) === "1" && !!prefs;
  // With no bank filter in the URL, logged-in users see the banks they follow.
  const selectedBanks = sp.banks !== undefined ? many(sp.banks).filter(Boolean) : (prefs?.banks.map((b) => b.bankId) ?? []);
  const cardType = one(sp.cardType);
  const network = one(sp.network);
  const category = one(sp.category);
  const q = one(sp.q);

  const result = await findOffers({
    from: fromParam, to: toParam, banks: selectedBanks, cardType, network, category, q,
    cards: mine ? prefs!.cards : undefined,
  });
  const { offers } = result;
  // Show the range actually used (e.g. after swapping a reversed From/To).
  const from = result.from.toISOString().slice(0, 10);
  const to = result.to.toISOString().slice(0, 10);

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const base = { from, to, mine: mine ? "1" : "", cardType: cardType ?? "", network: network ?? "", category: category ?? "", q: q ?? "", ...over };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    for (const b of selectedBanks) p.append("banks", b);
    if (!selectedBanks.length) p.set("banks", "");
    return `/offers?${p}`;
  };
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Tomorrow", from: shift(today, 1), to: shift(today, 1) },
    { label: "Next 7 days", from: today, to: shift(today, 6) },
    { label: "Next 30 days", from: today, to: shift(today, 29) },
  ];
  const lastScraped = banks.map((b) => b.lastScrapedAt).filter(Boolean).sort((a, b) => b!.getTime() - a!.getTime())[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <aside>
        {/* Keyed on the query so in-app navigation (presets, Reset) re-renders the uncontrolled inputs. */}
        <form key={JSON.stringify(sp)} className="card space-y-4 p-4 lg:sticky lg:top-4" method="get">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            <div>
              <label className="label" htmlFor="from">From</label>
              <input className="input" type="date" id="from" name="from" defaultValue={from} />
            </div>
            <div>
              <label className="label" htmlFor="to">To</label>
              <input className="input" type="date" id="to" name="to" defaultValue={to} />
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {presets.map((p) => (
              <Link key={p.label} href={qs({ from: p.from, to: p.to })}
                className={`chip hover:text-fg ${p.from === from && p.to === to ? "border-accent text-accent" : ""}`}>
                {p.label}
              </Link>
            ))}
          </div>

          {prefs && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="mine" value="1" defaultChecked={mine} className="accent-[var(--accent)]" />
              Only offers for my cards
              {prefs.cards.length === 0 && <Link href="/preferences" className="text-xs text-accent">(add cards)</Link>}
            </label>
          )}

          <fieldset>
            <legend className="label">Banks {selectedBanks.length === 0 && "(all)"}</legend>
            <input type="hidden" name="banks" value="" />
            <div className="space-y-1">
              {banks.map((b) => (
                <label key={b.id} className={`flex items-center gap-2 text-sm ${b.available ? "" : "text-muted"}`}>
                  <input type="checkbox" name="banks" value={b.id} defaultChecked={selectedBanks.includes(b.id)}
                    disabled={!b.available} className="accent-[var(--accent)]" />
                  {b.name}
                  {!b.available && <span className="text-xs">(unavailable)</span>}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="cardType">Card type</label>
              <select className="input" id="cardType" name="cardType" defaultValue={cardType ?? ""}>
                <option value="">Any</option>
                <option value="CREDIT">Credit</option>
                <option value="DEBIT">Debit</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="network">Network</label>
              <select className="input" id="network" name="network" defaultValue={network ?? ""}>
                <option value="">Any</option>
                <option value="VISA">Visa</option>
                <option value="MASTERCARD">Mastercard</option>
                <option value="AMEX">Amex</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select className="input" id="category" name="category" defaultValue={category ?? ""}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q">Search</label>
            <input className="input" id="q" name="q" placeholder="Merchant or keyword" defaultValue={q ?? ""} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary flex-1">Apply</button>
            <Link href="/offers?banks=" className="btn">Reset</Link>
          </div>
        </form>
      </aside>

      <section>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-semibold">
            {offers.length} offer{offers.length === 1 ? "" : "s"}{" "}
            <span className="font-normal text-muted">
              {from === to ? `valid on ${from}` : `valid between ${from} and ${to}`}
            </span>
          </h1>
          {lastScraped && (
            <p className="text-xs text-muted">Updated {lastScraped.toLocaleString("en-GB", { timeZone: "Asia/Colombo" })}</p>
          )}
        </div>
        {offers.length === 0 ? (
          <div className="card p-8 text-center text-sm text-muted">
            {lastScraped ? "No offers match these filters." : "No offers yet. An admin needs to run the first scrape."}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {offers.slice(0, 300).map((o) => <OfferCard key={o.id} offer={o} />)}
          </div>
        )}
        {offers.length > 300 && (
          <p className="mt-4 text-center text-sm text-muted">Showing the first 300. Narrow the filters to see more.</p>
        )}
      </section>
    </div>
  );
}
