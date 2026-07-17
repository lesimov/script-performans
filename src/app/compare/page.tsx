"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { Script, Snapshot } from "@/lib/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

type Metric = "players" | "servers";
type Period = 7 | 30 | 90;

const COLORS = ["#22d3ee", "#a78bfa", "#fb7185", "#fbbf24", "#34d399"];
const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const data = (await response.json()) as T | { error?: string };
  if (!response.ok) {
    throw new Error(
      typeof data === "object" && data && "error" in data
        ? data.error || "Request failed"
        : "Request failed"
    );
  }
  return data as T;
}

export default function ComparePage() {
  const [owned, setOwned] = useState<Script[]>([]);
  const [competitors, setCompetitors] = useState<Script[]>([]);
  const [snapshots, setSnapshots] = useState<Record<number, Snapshot[]>>({});
  const [ownedId, setOwnedId] = useState<number | null>(null);
  const [competitorIds, setCompetitorIds] = useState<number[]>([]);
  const [metric, setMetric] = useState<Metric>("players");
  const [period, setPeriod] = useState<Period>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getJson<Script[]>("/api/scripts?type=owned&active=true"),
      getJson<Script[]>("/api/scripts?type=competitor&active=true"),
    ])
      .then(([ownedScripts, competitorScripts]) => {
        if (cancelled) return;
        setOwned(ownedScripts);
        setCompetitors(competitorScripts);
        setOwnedId((current) => current ?? ownedScripts[0]?.id ?? null);
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Scripts could not be loaded");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const selectedIds = [ownedId, ...competitorIds].filter(
      (id): id is number => id !== null
    );
    if (selectedIds.length === 0) return;
    let cancelled = false;
    Promise.all(
      selectedIds.map(async (id) => [
        id,
        await getJson<Snapshot[]>(`/api/snapshots?script_id=${id}&limit=${period}`),
      ] as const)
    )
      .then((entries) => {
        if (!cancelled) {
          setSnapshots((current) => ({
            ...current,
            ...Object.fromEntries(entries),
          }));
        }
      })
      .catch((requestError) => {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Snapshots could not be loaded");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [ownedId, competitorIds, period]);

  const selectedScripts = useMemo(() => {
    const all = [...owned, ...competitors];
    return all.filter((script) => script.id === ownedId || competitorIds.includes(script.id));
  }, [owned, competitors, ownedId, competitorIds]);

  const series = useMemo(() => {
    const relevant = selectedScripts.flatMap((script) => {
      const points = [...(snapshots[script.id] ?? [])]
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-period);
      return points.map((snapshot) => snapshot.date).map((date) => ({ script, date }));
    });
    const labels = Array.from(new Set(relevant.map((point) => point.date))).sort();
    return {
      labels,
      datasets: selectedScripts.map((script, index) => {
        const byDate = new Map(
          (snapshots[script.id] ?? []).map((snapshot) => [snapshot.date.slice(0, 10), snapshot.raw_data[metric]])
        );
        return {
          label: `${script.name}${script.script_type === "owned" ? " · owned" : " · competitor"}`,
          data: labels.map((date) => byDate.get(date) ?? null),
          borderColor: COLORS[index % COLORS.length],
          backgroundColor: `${COLORS[index % COLORS.length]}22`,
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          spanGaps: true,
        };
      }),
    };
  }, [selectedScripts, snapshots, metric, period]);

  const toggleCompetitor = (id: number) => {
    setCompetitorIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );
  };

  return (
    <main className="min-h-screen overflow-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_12%_8%,rgba(167,139,250,0.12),transparent_32%),radial-gradient(circle_at_88%_18%,rgba(34,211,238,0.08),transparent_28%),linear-gradient(180deg,#07111f_0%,#081321_45%,#050b14_100%)]" />
      <header className="border-b border-slate-800/80 bg-slate-950/55 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3 text-white">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-400 to-cyan-400 font-black text-slate-950">5M</span>
            <span className="text-sm font-black tracking-wide">Script Pulse</span>
          </Link>
          <nav aria-label="Primary navigation" className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            <Link href="/" className="rounded-lg px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-slate-800 hover:text-white">Overview</Link>
            <Link href="/compare" className="rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white">Compare</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mb-8 max-w-3xl">
          <p className="mb-3 inline-flex rounded-full border border-violet-400/20 bg-violet-400/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Competitive intelligence</p>
          <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Compare momentum, not just size.</h1>
          <p className="mt-4 text-base leading-7 text-slate-400 sm:text-lg">Put an owned script beside the external scripts you are watching and see where the trend is moving.</p>
        </div>

        <section className="mb-6 rounded-3xl border border-slate-800/90 bg-slate-900/65 p-5 shadow-2xl shadow-slate-950/30 lg:p-6" aria-label="Comparison controls">
          <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr_auto_auto] lg:items-end">
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Our script
              <select value={ownedId ?? ""} onChange={(event) => setOwnedId(Number(event.target.value) || null)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-semibold normal-case tracking-normal text-white">
                <option value="">Select owned script</option>
                {owned.map((script) => <option key={script.id} value={script.id}>{script.name}</option>)}
              </select>
            </label>
            <fieldset>
              <legend className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Competitors</legend>
              <div className="mt-2 flex min-h-11 flex-wrap gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2">
                {competitors.length === 0 ? <span className="px-2 py-1 text-sm text-slate-600">Add competitor scripts from Overview</span> : competitors.map((script) => (
                  <label key={script.id} className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-semibold transition ${competitorIds.includes(script.id) ? "bg-violet-400/20 text-violet-200" : "text-slate-400 hover:bg-slate-800"}`}>
                    <input type="checkbox" className="sr-only" checked={competitorIds.includes(script.id)} onChange={() => toggleCompetitor(script.id)} />
                    {script.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Metric
              <select value={metric} onChange={(event) => setMetric(event.target.value as Metric)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-semibold normal-case tracking-normal text-white">
                <option value="players">Players</option><option value="servers">Servers</option>
              </select>
            </label>
            <label className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Period
              <select value={period} onChange={(event) => setPeriod(Number(event.target.value) as Period)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm font-semibold normal-case tracking-normal text-white">
                <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
              </select>
            </label>
          </div>
        </section>

        {loading ? <div className="h-96 animate-pulse rounded-3xl border border-slate-800 bg-slate-900/60" aria-label="Loading comparison" /> : error ? <section className="rounded-3xl border border-rose-400/25 bg-rose-400/10 p-8 text-center text-rose-200"><h2 className="font-bold">Comparison unavailable</h2><p className="mt-2 text-sm">{error}</p></section> : selectedScripts.length < 2 ? <section className="rounded-3xl border border-dashed border-slate-700 bg-slate-900/35 p-12 text-center"><h2 className="text-xl font-bold text-white">Choose an owned script and a competitor</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-400">Comparison needs at least two active scripts. Add competitor scripts on the Overview screen, then return here.</p></section> : <>
          <section aria-label={`${metric} comparison chart`} role="img" className="rounded-3xl border border-slate-800/90 bg-slate-900/65 p-5 shadow-2xl shadow-slate-950/30 lg:p-6">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-400">Trend overlay</p><h2 className="mt-1 text-2xl font-black text-white">{metric === "players" ? "Players" : "Servers"} over the last {period} days</h2></div><p className="text-sm text-slate-500">Daily snapshots · missing days remain gaps</p></div>
            <div className="h-[24rem]"><Line data={series} options={{ responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, plugins: { legend: { labels: { color: "#cbd5e1", usePointStyle: true, padding: 18 } }, tooltip: { callbacks: { label: (context) => ` ${context.dataset.label}: ${context.parsed.y === null ? "—" : formatter.format(context.parsed.y)}` } } }, scales: { x: { ticks: { color: "#64748b" }, grid: { color: "#1e293b" } }, y: { beginAtZero: true, ticks: { color: "#64748b" }, grid: { color: "#1e293b" } } } }} /></div>
            <p className="sr-only">
              Comparison chart for {selectedScripts.map((script) => script.name).join(", ")}.
            </p>
          </section>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{selectedScripts.map((script) => { const points = snapshots[script.id] ?? []; const values = points.map((point) => point.raw_data[metric]).filter((value): value is number => value !== null); const current = values.at(0) ?? null; const first = values.at(-1) ?? null; const change = current !== null && first !== null && first !== 0 ? ((current - first) / first) * 100 : null; return <article key={script.id} className="rounded-2xl border border-slate-800 bg-slate-900/65 p-5"><div className="flex items-center justify-between gap-3"><h3 className="font-bold text-white">{script.name}</h3><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${script.script_type === "owned" ? "bg-cyan-400/10 text-cyan-300" : "bg-violet-400/10 text-violet-300"}`}>{script.script_type}</span></div><p className="mt-5 text-3xl font-black text-white">{current === null ? "—" : formatter.format(current)}</p><p className="mt-1 text-xs uppercase tracking-[0.15em] text-slate-500">{metric}</p><p className={`mt-4 text-sm font-semibold ${change === null ? "text-slate-500" : change >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{change === null ? "Not enough history" : `${change >= 0 ? "↗" : "↘"} ${Math.abs(change).toFixed(1)}% over selected period`}</p></article>; })}</section>
        </>}
      </div>
    </main>
  );
}
