"use client";

import { Snapshot } from "@/lib/types";

export default function SnapshotTable({
  snapshots,
}: {
  snapshots: Record<number, Snapshot[]>;
}) {
  const allIds = Object.keys(snapshots).map(Number);
  if (allIds.length === 0) return null;

  const allSnapshots = Object.values(snapshots).flat();
  if (allSnapshots.length === 0) return null;

  const sorted = [...allSnapshots].sort(
    (a, b) => b.date.localeCompare(a.date)
  );

  const metricKeys = new Set<string>();
  sorted.forEach((s) => Object.keys(s.raw_data).forEach((k) => metricKeys.add(k)));
  const columns = Array.from(metricKeys);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900/50">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-xs text-gray-500">
            <th className="px-4 py-3 font-medium">Date</th>
            {columns.map((col) => (
              <th key={col} className="px-4 py-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.slice(0, 30).map((s) => (
            <tr
              key={s.id}
              className="border-b border-gray-800/50 hover:bg-gray-800/30"
            >
              <td className="px-4 py-2 font-mono text-gray-300">{s.date}</td>
              {columns.map((col) => (
                <td key={col} className="px-4 py-2 font-mono text-gray-400">
                  {s.raw_data[col] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}