/** Shared categories, so one filter works across banks that each name categories differently. */
export const CATEGORIES = [
  "dining",
  "hotels",
  "travel",
  "supermarkets",
  "online",
  "fashion",
  "jewellery",
  "electronics & home",
  "health & wellness",
  "automobile",
  "education",
  "installments",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

// Checked in order; the first category with a matching keyword wins.
const RULES: [Category, RegExp][] = [
  ["supermarkets", /super\s?markets?|grocer|keells|cargills|food ?city|arpico super|glomark|spar\b|laugfs super/],
  ["jewellery", /jewel|gems?\b|diamond|gold smith|watches?\b/],
  ["hotels", /hotels?\b|resorts?\b|villas?\b|lodging|bungalow|cabana|lodge\b|\binn\b|boutique stay|glamping|camping|safari|stay\b|room rates|rack rates|resi?dences?\b|re?s[e]?rvations?\b|\b(fb|hb|bb)\b.{0,12}basis/],
  ["travel", /travel|airline|air ?tickets?|flights?\b|airport|fast track|tours?\b|transport|dragonpass|lounge/],
  ["health & wellness", /health|hospital|medical|clinic|wellness|beauty|salon|spa\b|eye ?care|optical|optician|hearing|vision|pharmac|insurance|gym|fitness|dental|laboratory|lab\b/],
  ["dining", /dining|restaurants?|food|cafe|café|coffee|pub\b|bar\b|bakery|bakes|pizza|burger|kfc|mcdonald|buffet|high tea|\btea\b|take-?away|lunch|dinner|dine|kitchen|grill|bistro|\beats?\b|steak|curry|sushi|chinese|thai|indian cuisine|baskin|subway|popeyes|delifrance/],
  // Hotel brand names only count when no dining words matched ("Dinner buffet at Shangri-La" is dining).
  ["hotels", /heritance|cinnamon (lodge|wild|bey|citadel)|jetwing|amaya|araliya|hilton|shangri-?la|marriott|taj\b|itc ratnadipa|kingsbury|rest ?house/],
  ["automobile", /auto|tyres?|vehicle|car ?care|car wash|fuel|engine oil|mobil\b|motor|garage|battery|servicing|wheels?\b/],
  ["electronics & home", /electronic|appliance|furniture|home ?care|homecare|gadget|mobile phones?|smartphone|laptop|singer|abans|softlogic|damro|solar|housing|construction|hardware|tiles|bathware|mattress|kitchenware/],
  ["online", /online|e-?commerce|daraz|kapruka|website|www\.|\.lk\b|pickme|uber|google pay|in-app|app store/],
  ["fashion", /clothing|fashion|apparel|footwear|foot ?wear|shoes?\b|style|lingerie|textile|saree|boutique|dsi\b|odel|nolimit|cool planet|kids? wear|kiddies|toys?\b/],
  ["education", /education|school|book|university|campus|tuition|course/],
  ["installments", /instal+ments?|easy payment|\bipp\b|0% (interest|plans?)/],
];

// Bank labels that say nothing specific; the offer text decides instead.
const VAGUE = /^(other|others|other offers|special|special offers|premium|premium offers|premium card offers|global|regional|lifestyle|private banking|general t&cs offers|q\+ payment app offers|garusaru|comfort)$/;

function match(text: string): Category | null {
  for (const [cat, re] of RULES) if (re.test(text)) return cat;
  return null;
}

/** Pick a shared category from the bank's label, falling back to keywords in the offer text. */
export function canonicalCategory(bankCategory: string | null | undefined, offerText: string): Category {
  const label = (bankCategory ?? "").toLowerCase().trim();
  if (label && !VAGUE.test(label)) {
    // "leisure" on these sites is mostly hotel stays; let the text override when it is clearly something else.
    if (/^(leisure|travel and leisure|travel & leisure)$/.test(label)) return match(offerText.toLowerCase()) ?? "hotels";
    const fromLabel = match(label);
    if (fromLabel) return fromLabel;
  }
  return match(offerText.toLowerCase()) ?? "other";
}
