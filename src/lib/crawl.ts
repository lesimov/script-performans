import { chromium, Browser } from "playwright";
import { isAllowedScriptUrl, Script, CrawlData, CrawlResult } from "./types";
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


export function parseMetricsFromHtml(
  html: string
): CrawlData {
  const serverMatch = html.match(
    /\\?"servers\\?"\s*:\s*(\d+)/
  );
  const playerMatch = html.match(
    /\\?"players\\?"\s*:\s*(\d+)/
  );
  const result: CrawlData = {
    players: playerMatch ? Number(playerMatch[1]) : null,
    servers: serverMatch ? Number(serverMatch[1]) : null,
  };

  return result;
}



export async function crawlScript(script: Script): Promise<CrawlResult> {
  if (!isAllowedScriptUrl(script.url)) {
    throw new Error("Script URL is not an allowed 5metrics.dev page");
  }
  const b = await getBrowser();
  const page = await b.newPage();
  const raw_data: CrawlData = {
    players: null,
    servers: null,
  };

  let crawlError: unknown;

  try {
    await page.goto(script.url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    const html = await page.content();
    Object.assign(raw_data, parseMetricsFromHtml(html));

    if (raw_data.players === null || raw_data.servers === null) {
      throw new Error("Required players or servers metric not found");
    }
  } catch (err) {
    crawlError = err;
    console.error(`Crawl failed for "${script.name}":`, err);
  } finally {
    await page.close();
  }

  if (crawlError) {
    throw crawlError;
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

export async function crawlAll(scriptIds?: number[]): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const params = scriptIds ? [scriptIds] : [];
  const filter = scriptIds ? " AND id = ANY($1::int[])" : "";
  const scripts = await query<Script>(
    `SELECT * FROM scripts
     WHERE is_active = TRUE${filter}
     ORDER BY id`,
    params
  );

  if (scriptIds && scripts.length !== new Set(scriptIds).size) {
    throw new Error("One or more selected scripts are missing or inactive");
  }
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