"use client";

import {
  STATUS_STYLES,
  TRACKING_LABELS,
  UNITS,
  formatDate,
  formatNumber,
  lifeUsed,
  partStatus,
  type Part,
  type PartStatus,
  type Session,
} from "@/lib/parts";

function valueText(p: Part): string {
  const unit = UNITS[p.tracking];
  if (p.tracking === "hours" || p.tracking === "weekends") {
    return p.limit != null ? `${formatNumber(p.used)} / ${formatNumber(p.limit)} ${unit}` : `${formatNumber(p.used)} ${unit}`;
  }
  if (p.tracking === "measured") return p.current != null ? `${formatNumber(p.current)} ${unit}` : "No measurement";
  return p.lastEntry ? `Checked ${formatDate(p.lastEntry)}` : "Not checked";
}

export function Overview({
  parts,
  sessions,
  onSelect,
}: {
  parts: Part[];
  sessions: Session[];
  onSelect: (id: string) => void;
}) {
  const counts: Record<PartStatus, number> = { due: 0, soon: 0, ok: 0, unset: 0 };
  parts.forEach((p) => counts[partStatus(p)]++);
  const flagged = parts
    .filter((p) => ["due", "soon"].includes(partStatus(p)))
    .sort((a, b) => (partStatus(a) === "due" ? -1 : 0) - (partStatus(b) === "due" ? -1 : 0));

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
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{STATUS_STYLES[status].label}</span>
            </div>
            <p className={`mt-2 text-3xl font-black ${tone}`}>{counts[status]}</p>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Needs attention</h2>
        {flagged.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/10 px-5 py-6 text-sm text-zinc-500">
            Nothing flagged. Parts show up here when they&apos;re close to or past their limit.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {flagged.map((p) => {
              const s = partStatus(p);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(p.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition hover:bg-white/[0.04] ${s === "due" ? "border-red-500/40 bg-red-500/[0.06]" : "border-amber-400/30 bg-amber-400/[0.04]"}`}
                  >
                    <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[s].dot}`} />
                    <span className="font-semibold text-zinc-100">{p.name}</span>
                    <span className="ml-auto font-mono text-xs text-zinc-400">{valueText(p)}</span>
                    <span className={`font-mono text-[10px] uppercase tracking-[0.2em] ${s === "due" ? "text-red-300" : "text-amber-300"}`}>
                      {STATUS_STYLES[s].label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">All parts</h2>
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
          {parts.map((p) => {
            const s = partStatus(p);
            const used = lifeUsed(p);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-orange/50 hover:bg-white/[0.05]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-zinc-100">{p.name}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_STYLES[s].dot}`} />
                </div>
                <p className="mt-1 text-xs text-zinc-500">{TRACKING_LABELS[p.tracking]}</p>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(Math.max(used ?? 0, 0), 1) * 100}%`,
                      background: s === "due" ? "#ef4444" : s === "soon" ? "#fbbf24" : p.color,
                    }}
                  />
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">{valueText(p)}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Recent sessions</h2>
        {sessions.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/10 px-5 py-6 text-sm text-zinc-500">
            No sessions logged yet. Use Log session at the top after running the car.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
            {sessions.slice(0, 8).map((s) => (
              <li key={s.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <span className="w-28 shrink-0 text-zinc-400">{formatDate(s.date)}</span>
                <span className="font-semibold text-zinc-100">{s.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  {s.type === "race_weekend" ? "Race weekend" : "Test day"}
                </span>
                <span className="ml-auto font-mono text-zinc-300">{formatNumber(s.hours)} hrs</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
