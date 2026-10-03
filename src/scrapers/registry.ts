import type { BankScraper } from "./types";
import { amex } from "./banks/amex";
import { boc } from "./banks/boc";
import { combank } from "./banks/combank";
import { hnb } from "./banks/hnb";
import { ndb } from "./banks/ndb";
import { ntb } from "./banks/ntb";
import { peoples } from "./banks/peoples";
import { sampath } from "./banks/sampath";
import { seylan } from "./banks/seylan";
import { dfcc } from "./banks/dfcc";

export const SCRAPERS: Record<string, BankScraper> = Object.fromEntries(
  [hnb, combank, sampath, ntb, amex, boc, peoples, seylan, dfcc, ndb].map((s) => [s.bankId, s]),
);
