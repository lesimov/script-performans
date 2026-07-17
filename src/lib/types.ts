export const CRAWL_METRICS = ["players", "servers"] as const;
export type CrawlMetric = (typeof CRAWL_METRICS)[number];
export type CrawlData = Record<CrawlMetric, number | null>;
export interface Script {
  id: number;
  name: string;
  slug: string;
  url: string;
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