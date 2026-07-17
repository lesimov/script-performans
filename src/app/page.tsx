"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import AIChatBubble from "@/components/AIChatBubble";
import PerformanceChart from "@/components/PerformanceChart";
import ScriptList, { ScriptInput } from "@/components/ScriptList";
import { Script, Snapshot } from "@/lib/types";

type TrendDirection = "up" | "down" | "flat" | "unknown";

type Trend = {
  current: number | null;
  previous: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
  direction: TrendDirection;
};

type OwnedScriptOverview = {
  script: Script;
  latest?: Snapshot;
  history: Snapshot[];
  trends: {
    players: { daily: Trend; sevenDay: Trend };
    servers: { daily: Trend; sevenDay: Trend };
  };
};

type OverviewResponse = {
  ownedScripts: OwnedScriptOverview[];
  summary: {
    ownedScriptCount: number;
    risingCount: number;
    fallingCount: number;
    lastCrawlAt: string | null;
  };
};

type CrawlResponse = {
  success: number;
  failed: number;
  errors: string[];
};

const numberFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function TrendBadge({ trend, label }: { trend: Trend; label: string }) {
  const styles: Record<TrendDirection, string> = {
    up: "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    down: "border-rose-400/20 bg-rose-400/10 text-rose-300",
    flat: "border-amber-400/20 bg-amber-400/10 text-amber-300",
    unknown: "border-slate-700 bg-slate-800/70 text-slate-400",
  };
  const symbol: Record<TrendDirection, string> = {
    up: "↗",
    down: "↘",
    flat: "→",
    unknown: "—",
  };
  const value =
    trend.percentageChange === null
      ? "No baseline"
      : `${Math.abs(trend.percentageChange).toFixed(1)}%`;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${styles[trend.direction]}`}>
      <span aria-hidden="true">{symbol[trend.direction]}</span>
      <span>{label}</span>
      <span>{value}</span>
      <span className="sr-only">{trend.direction} trend</span>
    </span>
  );
}

function MetricPanel({
  label,
  value,
  daily,
  sevenDay,
  accent,
}: {
  label: string;
  value: number | null;
  daily: Trend;
  sevenDay: Trend;
  accent: "cyan" | "emerald";
}) {
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className={`mt-1 text-3xl font-black tracking-tight ${accent === "cyan" ? "text-cyan-300" : "text-emerald-300"}`}>
            {value === null ? "—" : numberFormatter.format(value)}
          </p>
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${accent === "cyan" ? "bg-cyan-400 shadow-[0_0_16px_#22d3ee]" : "bg-emerald-400 shadow-[0_0_16px_#34d399]"}`} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <TrendBadge trend={daily} label="24h" />
        <TrendBadge trend={sevenDay} label="7d" />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-32 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/60" />
        ))}
      </div>
      <div className="h-96 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" />
    </div>
  );
}

export default function Home() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [nextOverview, nextScripts] = await Promise.all([
        requestJson<OverviewResponse>("/api/dashboard/overview"),
        requestJson<Script[]>("/api/scripts"),
      ]);
      setOverview(nextOverview);
      setScripts(nextScripts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Dashboard could not be loaded");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activeScriptCount = useMemo(
    () => scripts.filter((script) => script.is_active).length,
    [scripts]
  );

  const crawl = async (scriptIds?: number[]) => {
    setBusyAction("crawl");
    setNotice(null);
    try {
      const result = await requestJson<CrawlResponse>("/api/crawl", {
        method: "POST",
        headers: scriptIds ? { "Content-Type": "application/json" } : undefined,
        body: scriptIds ? JSON.stringify({ script_ids: scriptIds }) : undefined,
      });
      const details = result.errors.length > 0 ? ` ${result.errors.join(" · ")}` : "";
      setNotice({
        tone: result.failed === 0 ? "success" : "error",
        text: `Crawl complete: ${result.success} succeeded, ${result.failed} failed.${details}`,
      });
      await refresh();
    } catch (requestError) {
      setNotice({
        tone: "error",
        text: requestError instanceof Error ? requestError.message : "Crawl failed",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const saveScript = async (input: ScriptInput, id?: number) => {
    setBusyAction("save");
    setNotice(null);
    try {
      await requestJson<Script>(id ? `/api/scripts/${id}` : "/api/scripts", {
        method: id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      setNotice({
        tone: "success",
        text: id ? "Script updated successfully." : "Script added successfully.",
      });
      await refresh();
      return true;
    } catch (requestError) {
      setNotice({
        tone: "error",
        text: requestError instanceof Error ? requestError.message : "Script could not be saved",
      });
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const deleteScript = async (script: Script) => {
    if (!window.confirm(`Delete “${script.name}” and its snapshot history?`)) return;
    setBusyAction(`delete-${script.id}`);
    setNotice(null);
    try {
      await requestJson<{ deleted: Script }>(`/api/scripts/${script.id}`, {
        method: "DELETE",
      });
      setNotice({ tone: "success", text: `${script.name} was deleted.` });
      await refresh();
    } catch (requestError) {
      setNotice({
        tone: "error",
        text: requestError instanceof Error ? requestError.message : "Script could not be deleted",
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,rgba(34,211,238,0.10),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(52,211,153,0.08),transparent_28%),linear-gradient(180deg,#07111f_0%,#081321_45%,#050b14_100%)]" />

      <header className="border-b border-slate-800/80 bg-slate-950/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-300">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 font-black text-slate-950 shadow-lg shadow-cyan-950/60">
              5M
            </span>
            <span>
              <span className="block text-sm font-black tracking-wide text-white">Script Pulse</span>
              <span className="hidden text-xs text-slate-500 sm:block">5Metrics performance intelligence</span>
            </span>
          </Link>
          <nav aria-label="Primary navigation" className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            <Link href="/" aria-current="page" className="min-h-10 rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white">
              Overview
            </Link>
            <Link href="/compare" className="min-h-10 rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-400 transition hover:bg-slate-800 hover:text-white">
              Compare
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <section className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 inline-flex rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
              Owned script command center
            </p>
            <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">
              Know what is{" "}
              <span className="bg-gradient-to-r from-cyan-300 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                gaining ground.
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400 sm:text-lg">
              Monitor current reach, spot momentum shifts, and keep every owned script moving in the right direction.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void crawl()}
            disabled={busyAction !== null || activeScriptCount === 0}
            className="min-h-12 shrink-0 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 px-5 text-sm font-black text-slate-950 shadow-xl shadow-emerald-950/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busyAction === "crawl" ? "Crawling active scripts…" : `Crawl all active · ${activeScriptCount}`}
          </button>
        </section>

        {notice && (
          <div
            role="status"
            className={`mb-6 flex items-start justify-between gap-4 rounded-2xl border p-4 text-sm ${
              notice.tone === "success"
                ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200"
                : "border-rose-400/25 bg-rose-400/10 text-rose-200"
            }`}
          >
            <p>{notice.text}</p>
            <button type="button" onClick={() => setNotice(null)} className="font-semibold opacity-70 hover:opacity-100" aria-label="Dismiss message">
              ×
            </button>
          </div>
        )}

        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <section className="rounded-3xl border border-rose-400/25 bg-rose-400/10 p-8 text-center">
            <p className="text-lg font-bold text-rose-200">Dashboard unavailable</p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-rose-200/70">{error}</p>
            <button type="button" onClick={() => { setLoading(true); void refresh(); }} className="mt-5 min-h-11 rounded-xl bg-rose-300 px-5 text-sm font-bold text-slate-950 hover:bg-rose-200">
              Try again
            </button>
          </section>
        ) : overview ? (
          <>
            <section aria-label="Dashboard summary" className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  label: "Active owned",
                  value: String(overview.summary.ownedScriptCount),
                  detail: "scripts monitored",
                  tone: "text-cyan-300",
                  glow: "from-cyan-400/15",
                },
                {
                  label: "Rising today",
                  value: String(overview.summary.risingCount),
                  detail: "positive movers",
                  tone: "text-emerald-300",
                  glow: "from-emerald-400/15",
                },
                {
                  label: "Falling today",
                  value: String(overview.summary.fallingCount),
                  detail: "need attention",
                  tone: "text-rose-300",
                  glow: "from-rose-400/15",
                },
                {
                  label: "Last crawl",
                  value: overview.summary.lastCrawlAt
                    ? dateTimeFormatter.format(new Date(overview.summary.lastCrawlAt))
                    : "Not yet",
                  detail: overview.summary.lastCrawlAt ? "latest portfolio sync" : "run your first crawl",
                  tone: "text-amber-300",
                  glow: "from-amber-400/15",
                },
              ].map((card) => (
                <article key={card.label} className={`relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-br ${card.glow} to-slate-900/65 p-5 shadow-xl shadow-slate-950/20`}>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{card.label}</p>
                  <p className={`mt-3 text-2xl font-black tracking-tight ${card.tone}`}>{card.value}</p>
                  <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
                </article>
              ))}
            </section>

            <section aria-labelledby="portfolio-heading" className="mb-8">
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Live portfolio</p>
                  <h2 id="portfolio-heading" className="mt-1 text-2xl font-black text-white">Owned script performance</h2>
                </div>
                <Link href="/compare" className="hidden min-h-10 items-center rounded-xl border border-cyan-400/20 px-4 py-2.5 text-sm font-semibold text-cyan-300 hover:bg-cyan-400/10 sm:inline-flex">
                  Open comparison →
                </Link>
              </div>

              {overview.ownedScripts.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/35 p-10 text-center">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-2xl text-cyan-300">＋</div>
                  <h3 className="mt-5 text-xl font-bold text-white">Your portfolio is ready for its first script</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
                    Add an active owned script below. Its latest metrics and momentum will appear here after a crawl.
                  </p>
                  <a href="#scripts" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-cyan-400 px-5 text-sm font-bold text-slate-950 hover:bg-cyan-300">
                    Manage scripts
                  </a>
                </div>
              ) : (
                <div className="space-y-5">
                  {overview.ownedScripts.map((item) => (
                    <article key={item.script.id} className="overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/65 shadow-2xl shadow-slate-950/30">
                      <div className="flex flex-col gap-3 border-b border-slate-800/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
                            <h3 className="truncate text-lg font-bold text-white">{item.script.name}</h3>
                          </div>
                          <p className="mt-1 truncate pl-4 text-sm text-slate-500">/{item.script.slug}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300">Owned</span>
                          <button type="button" onClick={() => void crawl([item.script.id])} disabled={busyAction !== null} className="min-h-10 rounded-xl border border-slate-700 px-3 text-xs font-bold text-slate-300 hover:border-cyan-400/40 hover:text-cyan-300 disabled:opacity-40">
                            Crawl now
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)] lg:p-6">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                          <MetricPanel
                            label="Players"
                            value={item.latest?.raw_data.players ?? null}
                            daily={item.trends.players.daily}
                            sevenDay={item.trends.players.sevenDay}
                            accent="cyan"
                          />
                          <MetricPanel
                            label="Servers"
                            value={item.latest?.raw_data.servers ?? null}
                            daily={item.trends.servers.daily}
                            sevenDay={item.trends.servers.sevenDay}
                            accent="emerald"
                          />
                          <p className="self-end text-xs text-slate-500 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                            Last crawl: {item.latest ? dateTimeFormatter.format(new Date(item.latest.created_at)) : "No crawl data yet"}
                          </p>
                        </div>
                        <PerformanceChart snapshots={item.history} scriptName={item.script.name} compact />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <ScriptList
              scripts={scripts}
              busyAction={busyAction}
              onSave={saveScript}
              onDelete={deleteScript}
              onCrawl={async (scriptIds) => crawl(scriptIds)}
            />
          </>
        ) : null}
      </div>
      <AIChatBubble />
    </main>
  );
}