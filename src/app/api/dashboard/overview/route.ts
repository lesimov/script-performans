import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { normalizeCrawlData, Script, Snapshot } from "@/lib/types";

export const dynamic = "force-dynamic";
type SnapshotRow = Snapshot & { script_id: number };

type Trend = {
  current: number | null;
  previous: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  direction: "up" | "down" | "flat" | "unknown";
};

function dateValue(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function buildTrend(current: number | null, previous: number | null): Trend {
  if (current === null || previous === null) {
    return {
      current,
      previous,
      absoluteChange: null,
      percentageChange: null,
      direction: "unknown",
    };
  }

  const absoluteChange = current - previous;
  const percentageChange =
    previous === 0 ? null : (absoluteChange / previous) * 100;

  return {
    current,
    previous,
    absoluteChange,
    percentageChange,
    direction:
      absoluteChange > 0 ? "up" : absoluteChange < 0 ? "down" : "flat",
  };
}

function metricTrend(
  current: Snapshot | undefined,
  previous: Snapshot | undefined,
  metric: "players" | "servers"
): Trend {
  return buildTrend(
    current ? normalizeCrawlData(current.raw_data)[metric] : null,
    previous ? normalizeCrawlData(previous.raw_data)[metric] : null
  );
}

export async function GET() {
  const scripts = await query<Script>(
    `SELECT id, name, slug, url, script_type, is_active, created_at, updated_at
     FROM scripts
     WHERE script_type = 'owned' AND is_active = TRUE
     ORDER BY created_at DESC`
  );

  const snapshots = await query<SnapshotRow>(
    `SELECT s.id, s.script_id, s.date, s.raw_data, s.created_at
     FROM snapshots s
     JOIN scripts sc ON sc.id = s.script_id
     WHERE sc.script_type = 'owned'
       AND sc.is_active = TRUE
       AND s.date >= CURRENT_DATE - INTERVAL '90 days'
     ORDER BY s.script_id, s.date DESC`
  );

  const snapshotsByScript = new Map<number, Snapshot[]>();
  for (const snapshot of snapshots) {
    const list = snapshotsByScript.get(snapshot.script_id) ?? [];
    list.push({
      ...snapshot,
      date: dateValue(snapshot.date),
      raw_data: normalizeCrawlData(snapshot.raw_data),
    });
    snapshotsByScript.set(snapshot.script_id, list);
  }

  const ownedScripts = scripts.map((script) => {
    const history = snapshotsByScript.get(script.id) ?? [];
    const latest = history[0];
    const previous = latest
      ? history.find(
          (snapshot) =>
            (new Date(latest.date).getTime() - new Date(snapshot.date).getTime()) /
              86_400_000 ===
            1
        )
      : undefined;
    const sevenDayReference = latest
      ? history
          .filter((snapshot) => {
            const days =
              (new Date(latest.date).getTime() - new Date(snapshot.date).getTime()) /
              86_400_000;
            return days >= 7;
          })
          .sort(
            (a, b) =>
              Math.abs(
                new Date(a.date).getTime() - new Date(latest.date).getTime()
              ) -
              Math.abs(
                new Date(b.date).getTime() - new Date(latest.date).getTime()
              )
          )[0]
      : undefined;

    return {
      script,
      latest,
      history,
      trends: {
        players: {
          daily: metricTrend(latest, previous, "players"),
          sevenDay: metricTrend(latest, sevenDayReference, "players"),
        },
        servers: {
          daily: metricTrend(latest, previous, "servers"),
          sevenDay: metricTrend(latest, sevenDayReference, "servers"),
        },
      },
    };
  });

  const dailyTrends = ownedScripts.map((item) => item.trends.players.daily.direction);
  const crawlTimestamps = ownedScripts
    .flatMap((item) => item.history.map((snapshot) => new Date(snapshot.created_at).getTime()))
    .filter((timestamp) => Number.isFinite(timestamp));
  const lastCrawlAt =
    crawlTimestamps.length > 0
      ? new Date(Math.max(...crawlTimestamps)).toISOString()
      : null;
  return NextResponse.json({
    ownedScripts,
    summary: {
      ownedScriptCount: ownedScripts.length,
      risingCount: dailyTrends.filter((direction) => direction === "up").length,
      fallingCount: dailyTrends.filter((direction) => direction === "down").length,
      lastCrawlAt,
    },
  });
}
