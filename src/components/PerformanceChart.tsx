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

function extractMetrics(): CrawlMetric[] {
  return [...CRAWL_METRICS];
}

const COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6"];

export default function PerformanceChart({
  snapshots,
  scriptName,
}: {
  snapshots: Snapshot[];
  scriptName: string;
}) {
  if (snapshots.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-gray-800 bg-gray-900/50 text-sm text-gray-500">
        No data yet
      </div>
    );
  }

  const sorted = [...snapshots].sort(
    (a, b) => a.date.localeCompare(b.date)
  );
  const labels = sorted.map((s) => s.date.slice(5));
  const metrics = extractMetrics();

  const datasets = metrics.map((metric, i) => ({
    label: metric,
    data: sorted.map((s) => s.raw_data[metric] ?? null),
    borderColor: COLORS[i % COLORS.length],
    backgroundColor: COLORS[i % COLORS.length] + "22",
    fill: true,
    tension: 0.3,
    pointRadius: 2,
  }));

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
      <h3 className="mb-4 text-sm font-semibold text-gray-300">{scriptName}</h3>
      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true,
          plugins: {
            legend: {
              position: "top" as const,
              labels: { color: "#9ca3af", boxWidth: 12, font: { size: 11 } },
            },
          },
          scales: {
            x: {
              ticks: { color: "#6b7280", font: { size: 10 } },
              grid: { color: "#1f2937" },
            },
            y: {
              beginAtZero: true,
              ticks: { color: "#6b7280", font: { size: 10 } },
              grid: { color: "#1f2937" },
            },
          },
        }}
      />
    </div>
  );
}