# Card Offers Tracker (Sri Lanka)

Collects credit and debit card offers from Sri Lankan banks and lets you browse the offers valid on a date or across a date range. Each user saves the cards they hold and gets an email when new offers match those cards.

## Banks

| Bank | Source | Method |
|---|---|---|
| HNB | `venus.hnb.lk` JSON API | HTTP |
| Commercial Bank, Nations Trust, NTB Amex, BOC, NDB, People's Bank | Offer listing pages | HTTP + cheerio |
| Seylan | Listing pages, plus one detail page per offer for validity and terms | HTTP + cheerio |
| DFCC | Pages built in the browser | Playwright |
| Sampath | The site's own API, captured during a normal page load | Playwright |
| Pan Asia Bank | Behind a bot-check page | **Not scraped.** It is shown as unavailable. |

Scrapers identify themselves with their own User-Agent and send at most one request per host every 1.2 s. They don't try to get past bot protection. If a site blocks them, the run is marked failed and shown on the admin page.

## Setup

```bash
npm install                      # also runs prisma generate
npx playwright install chromium  # for DFCC and Sampath
cp .env.example .env             # set AUTH_SECRET: openssl rand -base64 32
npx prisma migrate dev           # creates prisma/dev.db
npm run seed                     # banks + two demo users (see prisma/seed.ts)
```

## Running

```bash
npm run mail     # local SMTP catcher on :1025; emails are saved to .mail/
npm run dev      # web app
npm run scrape   # scrape every bank now (or: npm run scrape -- hnb ntb)
npm run worker   # scheduler: scrape daily at 06:00 Asia/Colombo, then send digests
```

- **Worker options:**
  - `npm run worker -- --once` runs one scrape-and-notify cycle and exits. It suits an external cron.
  - `npm run worker -- --notify-only` only sends due emails.
  - `SCRAPE_CRON` changes the schedule.
- **Admins:** the first account registered on a fresh database becomes admin, as do addresses listed in `ADMIN_EMAILS`. Admins can start scrapes from `/admin/scrapes`.
- **Real email:** set the `SMTP_*` and `MAIL_FROM` variables in `.env`.

## How it works

- **Scraping:** each bank has a scraper in `src/scrapers/banks/` that returns loosely structured offers. `src/scrapers/normalize/` then works out:
  - validity dates from free text, e.g. "Valid every Sat from 1st October to 31st October 2026" becomes 1–31 Oct, Saturdays only;
  - card types, networks and tiers;
  - the discount percentage.
- **Storing:** `src/scrapers/run.ts` upserts offers using a stable hash built from the bank, the bank's offer ID and the end date. Offers that disappear from a bank's site are marked inactive.
- **Date filter:** an offer shows if its validity overlaps the chosen range. Recurring offers ("Wednesdays only") show only when the range includes one of their days.
- **Card matching:** an offer matches one of your cards when it comes from the same bank and none of the restrictions it states (credit or debit, network, tier) rule the card out. Restrictions the offer doesn't mention don't exclude anything.
- **Notifications:** `src/notifications/digest.ts` emails each user their matching offers that haven't been sent yet. It follows each user's frequency (instant, daily or weekly) and writes a `NotificationLog`, so no offer is emailed twice.

## Tests

```bash
npm test
```

Parser tests run against saved bank pages in `src/scrapers/__fixtures__/`. When a bank redesigns its site, save a fresh copy of the page there and fix the parser until the tests pass again.
