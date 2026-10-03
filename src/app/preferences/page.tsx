import { requireUser } from "@/auth";
import { CARD_TYPES, NETWORKS, TIERS } from "@/lib/banks";
import { db } from "@/lib/db";
import { cardLabel } from "@/lib/matching";
import { listCategories } from "@/lib/offers";
import { addCard, deleteCard, savePreferences, sendNow, testEmail } from "./actions";

const nice = (s: string) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; welcome?: string; notice?: string }>;
}) {
  const sp = await searchParams;
  const me = await requireUser();
  const [user, banks, categories] = await Promise.all([
    db.user.findUniqueOrThrow({
      where: { id: me.id },
      include: { cards: { include: { bank: true } }, banks: true, categories: true },
    }),
    db.bank.findMany({ orderBy: { name: "asc" } }),
    listCategories(),
  ]);
  const followed = new Set(user.banks.map((b) => b.bankId));
  const chosenCats = new Set(user.categories.map((c) => c.category));
  const available = banks.filter((b) => b.available);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My cards &amp; notifications</h1>
        <p className="text-sm text-muted">
          Add the cards you hold. When a scrape finds a new offer for one of them, you get an email.
        </p>
      </div>

      {sp.welcome && (
        <p className="card border-accent bg-accent-soft p-3 text-sm">
          Welcome! Start by adding your first card below.
        </p>
      )}
      {sp.saved && <p className="card bg-accent-soft p-3 text-sm">Preferences saved.</p>}
      {sp.notice && <p className="card bg-accent-soft p-3 text-sm">{sp.notice}</p>}

      <section className="card p-5">
        <h2 className="font-semibold">Your cards</h2>
        {user.cards.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No cards yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {user.cards.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{c.bank.name}</span> · {cardLabel(c)}
                  {c.nickname && <span className="text-muted"> ({[c.network, c.tier, c.cardType].filter((x) => x && x !== "ANY").map((x) => nice(x!)).join(" ")})</span>}
                </span>
                <form action={deleteCard}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs text-danger hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={addCard} className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="bankId">Bank</label>
            <select className="input" id="bankId" name="bankId" required>
              {available.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="cardType">Type</label>
            <select className="input" id="cardType" name="cardType">
              {CARD_TYPES.map((t) => <option key={t} value={t}>{nice(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="network">Network</label>
            <select className="input" id="network" name="network">
              {NETWORKS.map((n) => <option key={n} value={n}>{n === "ANY" ? "Not sure" : nice(n)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tier">Tier</label>
            <select className="input" id="tier" name="tier" defaultValue="">
              <option value="">Any</option>
              {TIERS.map((t) => <option key={t} value={t}>{nice(t)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="nickname">Nickname</label>
            <input className="input" id="nickname" name="nickname" placeholder="Optional" maxLength={40} />
          </div>
          <div className="sm:col-span-6">
            <button className="btn-primary">Add card</button>
          </div>
        </form>
      </section>

      <form action={savePreferences} className="card space-y-5 p-5">
        <div>
          <h2 className="font-semibold">Banks to follow</h2>
          <p className="text-xs text-muted">These banks are selected by default on the offers page.</p>
          <div className="mt-2 grid gap-1 sm:grid-cols-2">
            {banks.map((b) => (
              <label key={b.id} className={`flex items-center gap-2 text-sm ${b.available ? "" : "text-muted"}`}>
                <input type="checkbox" name="banks" value={b.id} defaultChecked={followed.has(b.id)}
                  disabled={!b.available} className="accent-[var(--accent)]" />
                {b.name} {!b.available && <span className="text-xs">(cannot be scraped)</span>}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold">Categories in emails</h2>
          <p className="text-xs text-muted">Leave all unticked to get every category.</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {categories.map((c) => (
              <label key={c.category} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="categories" value={c.category} defaultChecked={chosenCats.has(c.category)}
                  className="accent-[var(--accent)]" />
                {c.category}
              </label>
            ))}
            {categories.length === 0 && <p className="text-sm text-muted">Categories appear after the first scrape.</p>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="digestFrequency">Email frequency</label>
            <select className="input" id="digestFrequency" name="digestFrequency" defaultValue={user.digestFrequency}>
              <option value="INSTANT">After every scrape</option>
              <option value="DAILY">Daily digest</option>
              <option value="WEEKLY">Weekly digest</option>
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" name="emailEnabled" defaultChecked={user.emailEnabled} className="accent-[var(--accent)]" />
            Send me emails at {user.email}
          </label>
        </div>
        <button className="btn-primary">Save preferences</button>
      </form>

      <section className="card flex flex-wrap items-center gap-3 p-5">
        <div className="mr-auto">
          <h2 className="font-semibold">Email</h2>
          <p className="text-xs text-muted">
            A test email previews your matches without marking them as sent. &ldquo;Send now&rdquo; sends the digest immediately.
          </p>
        </div>
        <form action={testEmail}><button className="btn">Send test email</button></form>
        <form action={sendNow}><button className="btn">Send digest now</button></form>
      </section>
    </div>
  );
}
