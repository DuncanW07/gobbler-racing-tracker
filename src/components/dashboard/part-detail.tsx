"use client";

import { GROUP_LABELS, STATUS_STYLES, TRACKING_LABELS, partStatus, type Part } from "@/lib/parts";

const UNITS: Record<Part["tracking"], string> = {
  hours: "hrs",
  weekends: "weekends",
  measured: "mm",
  condition: "",
};

export function PartDetail({
  part,
  onBack,
  onRemove,
}: {
  part: Part;
  onBack: () => void;
  onRemove: (id: string) => void;
}) {
  const status = STATUS_STYLES[partStatus(part)];
  const unit = UNITS[part.tracking];
  const soon = "Coming when the database is connected";

  const stat = (label: string, value: string) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-1.5 text-xl font-bold text-zinc-300">{value}</p>
    </div>
  );

  return (
    <div className="p-8">
      <button
        type="button"
        onClick={onBack}
        className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 transition hover:text-orange"
      >
        ← Overview
      </button>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.25em]" style={{ color: part.color }}>
            {GROUP_LABELS[part.group]}
            {part.corner ? ` · ${part.corner}` : ""}
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">{part.name}</h1>
          <p className="mt-1 text-sm text-zinc-500">Tracked by {TRACKING_LABELS[part.tracking].toLowerCase()}</p>
        </div>
        <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          {status.label}
        </span>
      </div>

      {/* Life */}
      <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Life</h2>
          <span className="font-mono text-xs text-zinc-500">
            — / — {unit}
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full w-0 rounded-full" style={{ background: part.color }} />
        </div>
        <p className="mt-3 text-sm text-zinc-500">
          No limit set yet. Once the team gives you a change interval, it goes here and the
          bar fills as {part.tracking === "measured" ? "measurements are logged" : "sessions are logged"}.
        </p>
      </section>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {stat("Limit", "—")}
        {stat("Since last change", "—")}
        {stat("Last changed", "—")}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {["Log check", "Log change", "Report issue", "Set limit"].map((label) => (
          <button
            key={label}
            type="button"
            disabled
            title={soon}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 opacity-60"
          >
            {label}
          </button>
        ))}
      </div>

      {/* History */}
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">History</h2>
        <p className="mt-3 rounded-xl border border-dashed border-white/10 px-5 py-6 text-sm text-zinc-500">
          No history yet. Checks, changes and issues for this part will list here with date,
          event, who logged it and cost.
        </p>
      </section>

      {part.group === "custom" && (
        <section className="mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-zinc-400">
            {part.marker ? "Location marked on the car." : "No location marked on the car."}
          </p>
          <button
            type="button"
            onClick={() => onRemove(part.id)}
            className="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-500/10"
          >
            Remove part
          </button>
        </section>
      )}
    </div>
  );
}
