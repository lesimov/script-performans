import { CRAWL_METRICS, Script as ScriptType, Snapshot } from "@/lib/types";

export default function ScriptList({
  scripts,
  snapshots,
  onAdd,
  onDelete,
  onCrawl,
  loading,
}: {
  scripts: ScriptType[];
  snapshots: Record<number, Snapshot[]>;
  onAdd: (name: string, slug: string, url: string) => void;
  onDelete: (id: number) => void;
  onCrawl: () => void;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-200">Scripts</h2>
        <button
          onClick={onCrawl}
          disabled={loading || scripts.length === 0}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {loading ? "Crawling..." : "Crawl All"}
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.target as HTMLFormElement;
          const fd = new FormData(form);
          const name = fd.get("name") as string;
          const slug = fd.get("slug") as string;
          const url = fd.get("url") as string;
          if (name && slug && url) {
            onAdd(name, slug, url);
            form.reset();
          }
        }}
        className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-4"
      >
        <input
          name="name"
          placeholder="Script Name"
          required
          className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
        />
        <input
          name="slug"
          placeholder="slug"
          required
          pattern="[a-z0-9-]+"
          className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
        />
        <input
          name="url"
          placeholder="https://5metrics.dev/..."
          required
          type="url"
          className="rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-emerald-500 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Add Script
        </button>
      </form>

      {scripts.length === 0 ? (
        <p className="text-sm text-gray-500">No scripts yet.</p>
      ) : (
        <ul className="space-y-2">
          {scripts.map((s) => {
            const last = snapshots[s.id]?.[0];
            return (
              <li
                key={s.id}
                className="flex items-center justify-between rounded border border-gray-800 bg-gray-900 px-4 py-3"
              >
                <div>
                  <span className="text-sm font-medium text-gray-200">
                    {s.name}
                  </span>
                  <span className="ml-2 font-mono text-xs text-gray-500">
                    /{s.slug}
                  </span>
                  {last && (
                    <span className="ml-3 font-mono text-xs text-emerald-400">
                      Last:{" "}
                      {CRAWL_METRICS.map(
                        (metric) => `${metric}=${last.raw_data[metric] ?? "-"}`
                      ).join(", ")}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onDelete(s.id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}