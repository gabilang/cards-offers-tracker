/** Banks the app knows about. `available: false` banks are shown but never scraped. */
export const BANKS = [
  { id: "hnb", name: "HNB", website: "https://www.hnb.lk/personal/promotions/card-promotions" },
  { id: "combank", name: "Commercial Bank", website: "https://www.combank.lk/rewards-promotions" },
  { id: "sampath", name: "Sampath Bank", website: "https://www.sampath.lk/sampath-cards/credit-card-offer" },
  { id: "ntb", name: "Nations Trust Bank", website: "https://www.nationstrust.com/promotions" },
  { id: "amex", name: "American Express (NTB)", website: "https://www.americanexpress.lk/en/offers" },
  { id: "boc", name: "Bank of Ceylon", website: "https://www.boc.lk/personal-banking/card-offers" },
  { id: "peoples", name: "People's Bank", website: "https://www.peoplesbank.lk/special-offers/" },
  { id: "seylan", name: "Seylan Bank", website: "https://www.seylan.lk/promotions/cards" },
  { id: "dfcc", name: "DFCC Bank", website: "https://www.dfcc.lk/cards/card-offers/credit-card-offers" },
  { id: "ndb", name: "NDB Bank", website: "https://www.ndbbank.com/cards/card-offers" },
  { id: "pabc", name: "Pan Asia Bank", website: "https://www.pabcbank.com/card-offers/", available: false },
] as const;

export const CARD_TYPES = ["CREDIT", "DEBIT"] as const;
export const NETWORKS = ["ANY", "VISA", "MASTERCARD", "AMEX"] as const;
export const TIERS = ["CLASSIC", "GOLD", "PLATINUM", "TITANIUM", "SIGNATURE", "INFINITE", "WORLD", "WORLD ELITE", "BLACK", "ELITE"] as const;
export const FREQUENCIES = ["INSTANT", "DAILY", "WEEKLY"] as const;
