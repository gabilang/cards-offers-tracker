import type { ScrapeContext } from "./types";
import { renderPage } from "./browser";

export const USER_AGENT =
  "Mozilla/5.0 (compatible; CardOffersTracker/0.1; personal offer aggregator; +https://github.com/)";
const MIN_GAP_MS = 1200;
// Some bank sites (e.g. People's Bank) can take 40+ seconds to respond.
const REQUEST_TIMEOUT_MS = 90_000;
const lastHit = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wait so that each host gets at most one request per MIN_GAP_MS. */
async function throttle(url: string) {
  const host = new URL(url).host;
  const wait = (lastHit.get(host) ?? 0) + MIN_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

/** Fetch with throttling; network errors and 5xx are retried, 4xx are not. */
async function request(url: string, init: RequestInit = {}, attempt = 1): Promise<Response> {
  await throttle(url);
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "en", ...init.headers },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "follow",
    });
  } catch (e) {
    if (attempt >= 3) throw e;
    await sleep(2000 * attempt);
    return request(url, init, attempt + 1);
  }
  if (res.status >= 500 && attempt < 3) {
    await sleep(2000 * attempt);
    return request(url, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res;
}

export function createHttpContext(log: (m: string) => void = console.log): ScrapeContext {
  return {
    log,
    async fetchText(url, init) {
      return (await request(url, init)).text();
    },
    async fetchJson(url, init) {
      const res = await request(url, { ...init, headers: { Accept: "application/json", ...init?.headers } });
      return res.json();
    },
    async render(url, opts) {
      await throttle(url);
      return renderPage(url, opts);
    },
  };
}
