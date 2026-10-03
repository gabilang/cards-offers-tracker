import type { OfferView } from "@/lib/offers";
import { cardLabel } from "@/lib/matching";

const fmt = (d: Date | null) =>
  d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : null;

const DAY_NAMES: Record<string, string> = { MON: "Mon", TUE: "Tue", WED: "Wed", THU: "Thu", FRI: "Fri", SAT: "Sat", SUN: "Sun" };
const title = (s: string) => s.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());

export function OfferCard({ offer }: { offer: OfferView }) {
  const from = fmt(offer.validFrom);
  const to = fmt(offer.validTo);
  const validity = to ? (from && from !== to ? `${from} – ${to}` : from === to ? `On ${to}` : `Until ${to}`) : null;
  const cards = [
    ...offer.networks.map(title),
    ...offer.tiers.map(title),
    ...(offer.cardTypes.length ? offer.cardTypes.map(title) : ["Credit & Debit"]),
  ];

  return (
    <article className="card flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">{offer.bank.name}</span>
        {offer.discountPct != null && (
          <span className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-sm font-semibold text-accent">
            {offer.discountPct}%
          </span>
        )}
      </div>
      <div>
        {offer.merchant && <p className="text-sm font-semibold">{offer.merchant}</p>}
        <h3 className={offer.merchant ? "text-sm text-muted" : "text-sm font-semibold"}>{offer.title}</h3>
      </div>
      <div className="mt-auto space-y-2 text-xs">
        <p className={validity ? "text-muted" : "text-warn-fg"}>
          {validity ?? (offer.rawValidity ? offer.rawValidity : "Validity not stated")}
          {offer.recurrence && (
            <span className="ml-1 rounded bg-warn-soft px-1.5 py-0.5 text-warn-fg">
              {offer.recurrence.split(",").map((d) => DAY_NAMES[d] ?? d).join(", ")} only
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          {offer.category && <span className="chip">{offer.category}</span>}
          {cards.map((c) => (
            <span key={c} className="chip">{c}</span>
          ))}
        </div>
        {offer.matchedCards.length > 0 && (
          <p className="text-accent">
            ✓ Works with your {offer.matchedCards.map((c) => (c.nickname ? c.nickname : `${cardLabel(c)} card`)).join(", ")}
          </p>
        )}
        {offer.url && (
          <a href={offer.url} target="_blank" rel="noopener noreferrer" className="inline-block text-accent hover:underline">
            View on bank site ↗
          </a>
        )}
      </div>
    </article>
  );
}
