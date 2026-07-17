"use client";

import { FormEvent, useMemo, useState } from "react";
import { Script, ScriptType } from "@/lib/types";

export type ScriptInput = {
  name: string;
  slug: string;
  url: string;
  script_type: ScriptType;
  is_active: boolean;
};

type ScriptListProps = {
  scripts: Script[];
  busyAction: string | null;
  onSave: (input: ScriptInput, id?: number) => Promise<boolean>;
  onDelete: (script: Script) => Promise<void>;
  onCrawl: (scriptIds: number[]) => Promise<void>;
};

const EMPTY_INPUT: ScriptInput = {
  name: "",
  slug: "",
  url: "",
  script_type: "owned",
  is_active: true,
};

function inputClassName() {
  return "min-h-11 w-full rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15";
}

export default function ScriptList({
  scripts,
  busyAction,
  onSave,
  onDelete,
  onCrawl,
}: ScriptListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [input, setInput] = useState<ScriptInput>(EMPTY_INPUT);
  const [filter, setFilter] = useState<"all" | ScriptType>("all");

  const visibleScripts = useMemo(
    () =>
      scripts.filter(
        (script) => filter === "all" || script.script_type === filter
      ),
    [filter, scripts]
  );

  const openCreate = () => {
    setEditingId(null);
    setInput(EMPTY_INPUT);
    setShowForm(true);
  };

  const openEdit = (script: Script) => {
    setEditingId(script.id);
    setInput({
      name: script.name,
      slug: script.slug,
      url: script.url,
      script_type: script.script_type,
      is_active: script.is_active,
    });
    setShowForm(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await onSave(input, editingId ?? undefined)) {
      setShowForm(false);
      setEditingId(null);
      setInput(EMPTY_INPUT);
    }
  };

  const activeIds = scripts.filter((script) => script.is_active).map((script) => script.id);

  return (
    <section
      id="scripts"
      aria-labelledby="scripts-heading"
      className="overflow-hidden rounded-3xl border border-slate-800/90 bg-slate-900/65 shadow-2xl shadow-slate-950/30 backdrop-blur"
    >
      <div className="flex flex-col gap-4 border-b border-slate-800/80 p-5 sm:flex-row sm:items-center sm:justify-between lg:p-6">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Portfolio control
          </p>
          <h2 id="scripts-heading" className="text-xl font-bold text-white">
            Script management
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Keep owned and competitor tracking clean and up to date.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onCrawl(activeIds)}
            disabled={activeIds.length === 0 || busyAction !== null}
            className="min-h-11 rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-4 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busyAction === "crawl" ? "Crawling…" : `Crawl active (${activeIds.length})`}
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="min-h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/40 transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            + Add script
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submit} className="border-b border-slate-800/80 bg-slate-950/35 p-5 lg:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-white">
              {editingId === null ? "Add a tracked script" : "Edit script"}
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
              aria-label="Close script form"
            >
              Close
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-semibold text-slate-300">
              Name
              <input
                required
                value={input.name}
                onChange={(event) => setInput({ ...input, name: event.target.value })}
                placeholder="My flagship script"
                className={`${inputClassName()} mt-1.5`}
              />
            </label>
            <label className="text-xs font-semibold text-slate-300">
              Slug
              <input
                required
                pattern="[a-z0-9-]+"
                value={input.slug}
                onChange={(event) => setInput({ ...input, slug: event.target.value })}
                placeholder="flagship-script"
                className={`${inputClassName()} mt-1.5`}
              />
            </label>
            <label className="text-xs font-semibold text-slate-300 md:col-span-2 xl:col-span-1">
              5Metrics URL
              <input
                required
                type="url"
                value={input.url}
                onChange={(event) => setInput({ ...input, url: event.target.value })}
                placeholder="https://5metrics.dev/..."
                className={`${inputClassName()} mt-1.5`}
              />
            </label>
            <label className="text-xs font-semibold text-slate-300">
              Tracking group
              <select
                value={input.script_type}
                onChange={(event) =>
                  setInput({ ...input, script_type: event.target.value as ScriptType })
                }
                className={`${inputClassName()} mt-1.5`}
              >
                <option value="owned">Owned script</option>
                <option value="competitor">Competitor</option>
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-700/80 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={input.is_active}
                onChange={(event) => setInput({ ...input, is_active: event.target.checked })}
                className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-400"
              />
              Active tracking
            </label>
            <div className="flex items-end gap-2">
              <button
                type="submit"
                disabled={busyAction !== null}
                className="min-h-11 flex-1 rounded-xl bg-cyan-500 px-4 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
              >
                {busyAction === "save"
                  ? "Saving…"
                  : editingId === null
                    ? "Add script"
                    : "Save changes"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="p-5 lg:p-6">
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter scripts">
          {(["all", "owned", "competitor"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`min-h-10 rounded-xl px-4 text-sm font-semibold capitalize transition ${
                filter === value
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
              }`}
            >
              {value === "all" ? `All (${scripts.length})` : `${value} (${scripts.filter((script) => script.script_type === value).length})`}
            </button>
          ))}
        </div>

        {visibleScripts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center">
            <p className="font-semibold text-slate-200">No scripts in this group</p>
            <p className="mt-1 text-sm text-slate-500">
              Add one to start tracking its daily performance.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {visibleScripts.map((script) => (
              <article
                key={script.id}
                className="grid gap-4 py-4 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold text-slate-100">{script.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        script.script_type === "owned"
                          ? "bg-cyan-400/10 text-cyan-300"
                          : "bg-violet-400/10 text-violet-300"
                      }`}
                    >
                      {script.script_type}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                        script.is_active
                          ? "bg-emerald-400/10 text-emerald-300"
                          : "bg-amber-400/10 text-amber-300"
                      }`}
                    >
                      {script.is_active ? "active" : "paused"}
                    </span>
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    /{script.slug} · {script.url}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onCrawl([script.id])}
                    disabled={!script.is_active || busyAction !== null}
                    className="min-h-10 rounded-xl border border-emerald-400/20 px-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-400/10 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    Crawl
                  </button>
                  <button
                    type="button"
                    onClick={() => openEdit(script)}
                    disabled={busyAction !== null}
                    className="min-h-10 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-300 hover:bg-slate-800 hover:text-white disabled:opacity-35"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(script)}
                    disabled={busyAction !== null}
                    className="min-h-10 rounded-xl px-3 text-sm font-semibold text-rose-300 hover:bg-rose-400/10 disabled:opacity-35"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}