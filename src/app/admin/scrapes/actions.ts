"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/auth";
import { db } from "@/lib/db";

const WORKFLOW = "scrape.yml";

/** Start the scrape workflow on GitHub Actions (used in production, where the web server can't run Chromium). */
async function dispatchWorkflow(repo: string, token: string, bankId: string) {
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: JSON.stringify({ ref: process.env.GITHUB_BRANCH || "main", inputs: { banks: bankId } }),
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body.slice(0, 200);
    try {
      message = JSON.parse(body).message ?? message;
    } catch {}
    throw new Error(`GitHub returned ${res.status} (${message}). Check GITHUB_REPO and GITHUB_DISPATCH_TOKEN.`);
  }
}

export async function triggerScrape(form: FormData) {
  await requireAdmin();
  const bankId = String(form.get("bankId") ?? "");
  const { GITHUB_REPO: repo, GITHUB_DISPATCH_TOKEN: token } = process.env;

  if (repo && token) {
    let notice: string;
    try {
      await dispatchWorkflow(repo, token, bankId);
      notice = "Scrape started on GitHub Actions. Results appear here in a few minutes.";
    } catch (e) {
      notice = `Could not start the scrape: ${(e as Error).message}`;
    }
    redirect(`/admin/scrapes?${new URLSearchParams({ notice, ...(notice.startsWith("Could not") ? { error: "1" } : {}) })}`);
  }

  // Local development: scrape inside this server process.
  const running = await db.scrapeRun.count({
    where: { status: "RUNNING", startedAt: { gte: new Date(Date.now() - 30 * 60_000) }, ...(bankId ? { bankId } : {}) },
  });
  if (running) return;
  const [{ runScrape }, { runNotifications }] = await Promise.all([
    import("@/scrapers/run"),
    import("@/notifications/digest"),
  ]);
  // Scrapes can take minutes (Seylan reads a page per offer), so they run in the background.
  void runScrape(bankId ? [bankId] : undefined)
    .then(() => runNotifications({ frequencies: ["INSTANT"] }))
    .catch((e) => console.error("background scrape failed", e));
  await new Promise((r) => setTimeout(r, 300)); // let the RUNNING rows appear before re-rendering
  revalidatePath("/admin/scrapes");
}
