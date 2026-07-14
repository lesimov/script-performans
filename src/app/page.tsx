"use client";

import { useState, useEffect, useCallback } from "react";
import { Script, Snapshot } from "@/lib/types";
import ScriptList from "@/components/ScriptList";
import PerformanceChart from "@/components/PerformanceChart";
import SnapshotTable from "@/components/SnapshotTable";

export default function Home() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [snapshots, setSnapshots] = useState<Record<number, Snapshot[]>>({});
  const [loading, setLoading] = useState(false);

  const fetchScripts = useCallback(async () => {
    const res = await fetch("/api/scripts");
    const data = await res.json();
    setScripts(data);
  }, []);

  const fetchSnapshots = useCallback(async () => {
    const res = await fetch("/api/snapshots?limit=60");
    const data: Snapshot[] = await res.json();
    const byScript: Record<number, Snapshot[]> = {};
    for (const s of data) {
      if (!byScript[s.script_id]) byScript[s.script_id] = [];
      byScript[s.script_id].push(s);
    }
    setSnapshots(byScript);
  }, []);

  useEffect(() => {
    fetchScripts();
    fetchSnapshots();
  }, [fetchScripts, fetchSnapshots]);

  const addScript = async (name: string, slug: string, url: string) => {
    const res = await fetch("/api/scripts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, url }),
    });
    if (res.ok) {
      fetchScripts();
    } else {
      const err = await res.json();
      alert(err.error || "Failed to add script");
    }
  };

  const deleteScript = async (id: number) => {
    if (!confirm("Delete this script?")) return;
    const res = await fetch(`/api/scripts/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchScripts();
      fetchSnapshots();
    }
  };

  const crawlAll = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/crawl", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Done: ${data.success} OK, ${data.failed} failed`);
        fetchSnapshots();
      } else {
        alert(data.error || "Crawl failed");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-8 text-2xl font-bold tracking-tight text-gray-100">
        5Metrics Script Performans
      </h1>

      <div className="space-y-6">
        <ScriptList
          scripts={scripts}
          snapshots={snapshots}
          onAdd={addScript}
          onDelete={deleteScript}
          onCrawl={crawlAll}
          loading={loading}
        />

        {scripts.map((s) => (
          <PerformanceChart
            key={s.id}
            scriptName={s.name}
            snapshots={snapshots[s.id] || []}
          />
        ))}

        <SnapshotTable snapshots={snapshots} />
      </div>
    </main>
  );
}