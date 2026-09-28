"use client";

import { STATUS_STYLES, TRACKING_LABELS, partStatus, type Part, type PartStatus } from "@/lib/parts";

export function Overview({ parts, onSelect }: { parts: Part[]; onSelect: (id: string) => void }) {
  const counts: Record<PartStatus, number> = { due: 0, soon: 0, ok: 0, unset: 0 };
  parts.forEach((p) => counts[partStatus(p)]++);
  const flagged = parts.filter((p) => ["due", "soon"].includes(partStatus(p)));

  const tiles: { status: PartStatus; tone: string }[] = [
    { status: "due", tone: "text-red-400" },
    { status: "soon", tone: "text-amber-300" },
    { status: "ok", tone: "text-emerald-300" },
    { status: "unset", tone: "text-zinc-400" },
  ];

  return (
    <div className="p-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-orange">Overview</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Car status</h1>

      <div className="mt-6 grid grid-cols-4 gap-3">
        {tiles.map(({ status, tone }) => (
          <div key={status} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${STATUS_STYLES[status].dot}`} />
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                {STATUS_STYLES[status].label}
              </span>
            </div>
            <p className={`mt-2 text-3xl font-black ${tone}`}>{counts[status]}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Needs attention</h2>
        {flagged.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/10 px-5 py-6 text-sm text-zinc-500">
            Nothing flagged. Parts show up here once they have limits and logged hours.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {flagged.map((p) => (
              <li key={p.id}>{p.name}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">All parts</h2>
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {parts.map((p) => {
            const status = STATUS_STYLES[partStatus(p)];
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-orange/50 hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-zinc-100">{p.name}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">{TRACKING_LABELS[p.tracking]}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full w-0 bg-orange" />
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                  {status.label}
                </p>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
