import type { Browser } from "playwright";
import type { RenderResult } from "./types";
import { USER_AGENT } from "./http";

let browser: Promise<Browser> | null = null;

async function getBrowser() {
  // Imported lazily so HTTP-only runs (and the Next.js server) never load Playwright.
  browser ??= import("playwright").then(({ chromium }) => chromium.launch());
  return browser;
}

export async function closeBrowser() {
  if (!browser) return;
  const b = await browser;
  browser = null;
  await b.close();
}

/** Load a page like a normal visitor would; no stealth tricks, so sites that block bots will fail visibly. */
export async function renderPage(
  url: string,
  { captureJson, waitForSelector }: { captureJson?: RegExp; waitForSelector?: string } = {},
): Promise<RenderResult> {
  const context = await (await getBrowser()).newContext({ userAgent: USER_AGENT, locale: "en-US" });
  const page = await context.newPage();
  const json: RenderResult["json"] = [];
  const pending: Promise<void>[] = [];
  if (captureJson) {
    page.on("response", (res) => {
      if (!captureJson.test(res.url()) || !res.ok()) return;
      pending.push(
        res.json().then(
          (body) => void json.push({ url: res.url(), body }),
          () => undefined,
        ),
      );
    });
  }
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    if (res && res.status() >= 400) throw new Error(`HTTP ${res.status()} for ${url}`);
    if (waitForSelector) await page.waitForSelector(waitForSelector, { timeout: 20_000 }).catch(() => undefined);
    await Promise.all(pending);
    return { html: await page.content(), json };
  } finally {
    await context.close();
  }
}
