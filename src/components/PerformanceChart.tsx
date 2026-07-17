"use client";

import { CRAWL_METRICS, CrawlMetric, Snapshot } from "@/lib/types";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

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


const COLORS = ["#22d3ee", "#34d399"];

export default function PerformanceChart({
  snapshots,
  scriptName,
  compact = false,
}: {
  snapshots: Snapshot[];
  scriptName: string;
  compact?: boolean;
}) {
  if (snapshots.length === 0) {
    return (
      <div className={`grid place-items-center rounded-2xl border border-dashed border-slate-700 bg-slate-950/35 text-center ${compact ? "min-h-56" : "min-h-72"}`}>
        <div>
          <div className="mx-auto mb-3 h-9 w-16 rounded-full border-b-2 border-l-2 border-cyan-400/50" />
          <p className="text-sm font-semibold text-slate-300">No trend data yet</p>
          <p className="mt-1 text-xs text-slate-500">Run a crawl to start the timeline.</p>
        </div>
      </div>
    );
  }

  const sorted = [...snapshots].sort(
    (a, b) => a.date.localeCompare(b.date)
  );
  const labels = sorted.map((snapshot) =>
    new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
      new Date(`${snapshot.date.slice(0, 10)}T00:00:00`)
    )
  );
  const datasets = CRAWL_METRICS.map((metric: CrawlMetric, index) => ({
    label: metric === "players" ? "Players" : "Servers",
    data: sorted.map((snapshot) => snapshot.raw_data[metric] ?? null),
    borderColor: COLORS[index],
    backgroundColor: `${COLORS[index]}18`,
    fill: true,
    tension: 0.38,
    pointRadius: sorted.length > 30 ? 0 : 2,
    pointHoverRadius: 5,
    pointBackgroundColor: COLORS[index],
    borderWidth: 2,
    spanGaps: true,
  }));

  return (
    <div
      className={`relative rounded-2xl border border-slate-800/80 bg-slate-950/45 p-4 ${compact ? "min-h-56" : "min-h-72"}`}
      role="img"
      aria-label={`${scriptName} player and server history chart`}
    >
      {!compact && (
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Performance history</p>
          <h3 className="mt-1 font-semibold text-white">{scriptName}</h3>
        </div>
      )}
      <div className={compact ? "h-56" : "h-72"}>
        <Line
          data={{ labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: "index" },
            plugins: {
              legend: {
                align: "start",
                labels: {
                  color: "#cbd5e1",
                  boxWidth: 9,
                  boxHeight: 9,
                  usePointStyle: true,
                  pointStyle: "circle",
                  padding: 18,
                  font: { size: 11, weight: 600 },
                },
              },
              tooltip: {
                backgroundColor: "#0f172a",
                borderColor: "#334155",
                borderWidth: 1,
                titleColor: "#f8fafc",
                bodyColor: "#cbd5e1",
                padding: 12,
                displayColors: true,
              },
            },
            scales: {
              x: {
                ticks: { color: "#64748b", font: { size: 10 }, maxTicksLimit: 7 },
                grid: { display: false },
                border: { display: false },
              },
              y: {
                beginAtZero: true,
                ticks: { color: "#64748b", font: { size: 10 }, precision: 0 },
                grid: { color: "rgba(51,65,85,0.35)" },
                border: { display: false },
              },
            },
          }}
        />
      </div>
      <p className="sr-only">
        Latest {scriptName} values: players{" "}
        {sorted.at(-1)?.raw_data.players ?? "unavailable"}, servers{" "}
        {sorted.at(-1)?.raw_data.servers ?? "unavailable"}.
      </p>
    </div>
  );
}