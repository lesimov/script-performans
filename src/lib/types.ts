export const CRAWL_METRICS = ["players", "servers"] as const;
export type CrawlMetric = (typeof CRAWL_METRICS)[number];
export const SCRIPT_TYPES = ["owned", "competitor"] as const;
export type ScriptType = (typeof SCRIPT_TYPES)[number];

export function isScriptType(value: unknown): value is ScriptType {
  return (
    typeof value === "string" &&
    (SCRIPT_TYPES as readonly string[]).includes(value)
  );
}

export function isAllowedScriptUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "5metrics.dev" ||
        url.hostname.endsWith(".5metrics.dev"))
    );
  } catch {
    return false;
  }
}

export function normalizeCrawlData(value: unknown): CrawlData {
  const data =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return {
    players:
      typeof data.players === "number" && Number.isFinite(data.players)
        ? data.players
        : null,
    servers:
      typeof data.servers === "number" && Number.isFinite(data.servers)
        ? data.servers
        : null,
  };
}

export type CrawlData = Record<CrawlMetric, number | null>;
export interface Script {
  id: number;
  name: string;
  slug: string;
  url: string;
  script_type: ScriptType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Snapshot {
  id: number;
  script_id: number;
  date: string;
  raw_data: CrawlData;
  created_at: string;
}

export interface ScriptWithSnapshots extends Script {
  snapshots: Snapshot[];
}

export interface CrawlResult {
  script_id: number;
  date: string;
  raw_data: CrawlData;
}