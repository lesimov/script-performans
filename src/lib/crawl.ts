import { chromium, Browser } from "playwright";
import { Script, CrawlResult } from "./types";
import { query } from "./db";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
  }
  return browser;
}

export async function shutdownBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

const METRIC_PAIR_PATTERN =
  /\\?"servers\\?"\s*:\s*(\d+)\s*,\s*\\?"players\\?"\s*:\s*(\d+)/;

export function parseMetricsFromHtml(
  html: string
): Record<string, number | null> {
  const result: Record<string, number | null> = {
    players: null,
    servers: null,
  };
  const match = html.match(METRIC_PAIR_PATTERN);

  if (!match) return result;

  result.servers = Number(match[1]);
  result.players = Number(match[2]);
  return result;
}



export async function crawlScript(script: Script): Promise<CrawlResult> {
  const b = await getBrowser();
  const page = await b.newPage();
  const raw_data: Record<string, number | null> = {
    players: null,
    servers: null,
  };

  try {
    await page.goto(script.url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    const html = await page.content();
    Object.assign(raw_data, parseMetricsFromHtml(html));
  } catch (err) {
    console.error(`Crawl failed for "${script.name}":`, err);
  } finally {
    await page.close();
  }

  const today = new Date().toISOString().slice(0, 10);

  return {
    script_id: script.id,
    date: today,
    raw_data,
  };
}

export async function saveSnapshot(result: CrawlResult): Promise<void> {
  await query(
    `INSERT INTO snapshots (script_id, date, raw_data)
     VALUES ($1, $2, $3)
     ON CONFLICT (script_id, date)
     DO UPDATE SET raw_data = $3, created_at = NOW()`,
    [result.script_id, result.date, JSON.stringify(result.raw_data)]
  );
}

export async function crawlAll(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const scripts = await query<Script>("SELECT * FROM scripts ORDER BY id");
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const script of scripts) {
    try {
      const result = await crawlScript(script);
      await saveSnapshot(result);
      success++;
      console.log(`OK: ${script.name} ->`, result.raw_data);
    } catch (err: any) {
      failed++;
      const msg = `${script.name}: ${err.message}`;
      errors.push(msg);
      console.error("FAIL:", msg);
    }
  }

  await shutdownBrowser();
  return { success, failed, errors };
}