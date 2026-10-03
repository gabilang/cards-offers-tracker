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

## Local setup

```bash
npm install                      # also runs prisma generate
npx playwright install chromium  # for DFCC and Sampath
cp .env.example .env             # set AUTH_SECRET: openssl rand -base64 32
npm run db                       # embedded Postgres (PGlite) on :5433, data in .pglite/ (keep it running)
npx prisma migrate deploy        # in another terminal: create the tables
npm run seed                     # banks + two demo users (see prisma/seed.ts; local only)
```

## Running locally

```bash
npm run db       # Postgres (if not already running)
npm run mail     # local SMTP catcher on :1025; emails are saved to .mail/
npm run dev      # web app
npm run scrape   # scrape every bank now (or: npm run scrape -- hnb ntb)
npm run worker   # scheduler: scrape daily at 06:00 Asia/Colombo, then send digests
```

- **Worker options:**
  - `npm run worker -- --once` runs one scrape-and-notify cycle and exits; it exits with code 1 if any bank failed. `SCRAPE_BANKS=hnb,ntb` limits it to some banks.
  - `npm run worker -- --notify-only` only sends due emails.
  - `SCRAPE_CRON` changes the schedule.
- **Admins:** addresses in `ADMIN_EMAILS` become admins when they register. If `ADMIN_EMAILS` is empty (local dev), the first account on a fresh database becomes admin. Admins can start scrapes from `/admin/scrapes`.
- **Invite code:** when `INVITE_CODE` is set, registration requires it.

## Deploy for free (Vercel + Neon + GitHub Actions + Brevo)

The website runs on Vercel and the data lives in Neon Postgres. The daily scrape and the emails run on GitHub Actions ([`.github/workflows/scrape.yml`](.github/workflows/scrape.yml)), because a full scrape takes about 15 minutes and needs Chromium, which Vercel functions can't run. The admin "Scrape now" button starts that same workflow through the GitHub API.

1. **GitHub:** create a public repository and push `main` to it.
2. **Neon** ([neon.tech](https://neon.tech)): create a project in the Singapore region (closest to Sri Lanka). From *Connect*, copy two connection strings: the **pooled** one (its host contains `-pooler`) and the **direct** one.
3. **Brevo** ([brevo.com](https://www.brevo.com)):
   - Under *Senders*, add and verify the email address the app will send from.
   - Under *SMTP & API*, create an SMTP key.
   - Note your SMTP login, which is shown on the same page.
4. **GitHub token:** under *Settings → Developer settings → Fine-grained tokens*, create a token limited to this repository with **Actions: Read and write**.
5. **GitHub secrets:** in the repo's *Settings → Secrets and variables → Actions*, add:

   | Secret | Value |
   |---|---|
   | `DATABASE_URL` | Neon **direct** connection string |
   | `SMTP_HOST` | `smtp-relay.brevo.com` |
   | `SMTP_PORT` | `587` |
   | `SMTP_USER` | Brevo SMTP login |
   | `SMTP_PASS` | Brevo SMTP key |
   | `MAIL_FROM` | e.g. `Card Offers <you@example.com>` (the verified sender) |
   | `APP_URL` | your Vercel URL, e.g. `https://cards-offers.vercel.app` |

6. **Vercel** ([vercel.com](https://vercel.com)): import the repository and add these environment variables, then deploy. The build runs `vercel-build`, which applies the database migrations first.

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Neon **pooled** connection string |
   | `DIRECT_URL` | Neon **direct** connection string |
   | `AUTH_SECRET` | output of `openssl rand -base64 32` |
   | `APP_URL` | your Vercel URL |
   | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | same as the GitHub secrets |
   | `ADMIN_EMAILS` | your email address |
   | `INVITE_CODE` | a code you share with the people you invite |
   | `GITHUB_REPO` | `your-name/your-repo` |
   | `GITHUB_DISPATCH_TOKEN` | the fine-grained token from step 4 |

   If you rename the Vercel project or add a domain, update `APP_URL` in both places.
7. **First scrape:** in GitHub, go to *Actions → scrape → Run workflow*. When it finishes (about 15 minutes), the offers appear on the site. After that it runs every day at 06:00 Sri Lanka time.
8. **Sign up:** open the Vercel URL and register with your `ADMIN_EMAILS` address and the invite code. Share the URL and the invite code with others.

**Notes:**
- A run with a failing bank is marked failed, and GitHub emails you. The other banks' offers and the user emails still go out.
- GitHub pauses scheduled workflows in public repos after 60 days without commits. If that happens, re-enable it from the Actions tab.
- To change the invite code, update `INVITE_CODE` in Vercel and redeploy.
- Free-tier limits change from time to time: Brevo sends about 300 emails a day, and Neon's free storage is far more than this app needs.

## How it works

- **Scraping:** each bank has a scraper in `src/scrapers/banks/` that returns loosely structured offers. `src/scrapers/normalize/` then works out:
  - validity dates from free text, e.g. "Valid every Sat from 1st October to 31st October 2026" becomes 1–31 Oct, Saturdays only;
  - card types, networks and tiers;
  - the discount percentage.
- **Storing:** `src/scrapers/run.ts` upserts offers using a stable hash built from the bank, the bank's offer ID and the end date. Offers that disappear from a bank's site are marked inactive.
- **Date filter:** an offer shows if its validity overlaps the chosen range. Recurring offers ("Wednesdays only") show only when the range includes one of their days.
- **Card matching:** an offer matches one of your cards when it comes from the same bank and none of the restrictions it states (credit or debit, network, tier) rule the card out. Restrictions the offer doesn't mention don't exclude anything.
- **Notifications:** `src/notifications/digest.ts` emails each user their matching offers that haven't been sent yet. It follows each user's frequency (after every scrape, daily or weekly) and writes a `NotificationLog`, so no offer is emailed twice.

## Tests

```bash
npm test
```

Parser tests run against saved bank pages in `src/scrapers/__fixtures__/`. When a bank redesigns its site, save a fresh copy of the page there and fix the parser until the tests pass again.
