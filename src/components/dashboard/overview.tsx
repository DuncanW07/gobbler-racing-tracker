"use client";

import {
  PART_IMAGES,
  WEAR_COLORS,
  formatDate,
  formatNumber,
  lifeUsed,
  partStatus,
  type CarNote,
  type Part,
  type PartStatus,
  type Session,
  type TrackerState,
} from "@/lib/parts";
import { CarNotes } from "./car-notes";
import { ConfirmButton } from "./confirm-button";

const ORDER: PartStatus[] = ["due", "soon", "ok", "unset"];

function valueText(p: Part): string {
  if (p.tracking === "hours" || p.tracking === "weekends") {
    const unit = p.tracking === "hours" ? "hrs" : "wknds";
    return p.limit != null ? `${formatNumber(p.used)} / ${formatNumber(p.limit)} ${unit}` : `${formatNumber(p.used)} ${unit}`;
  }
  if (p.tracking === "measured") return p.current != null ? `${formatNumber(p.current)} mm` : "—";
  return p.lastEntry ? `Checked ${formatDate(p.lastEntry)}` : "Not checked";
}

// One tile per part: its picture tinted by status (gray good, orange watch, red
// replace), its name, and its life bar. Flagged parts come first.
export function Overview({
  parts,
  sessions,
  onSelect,
  onDeleteSession,
  deletingId,
  onChecklist,
  notes,
  backupUrl,
  onSaved,
}: {
  parts: Part[];
  sessions: Session[];
  notes: CarNote[];
  backupUrl: string | null;
  onSaved: (s: TrackerState, msg: string) => void;
  onSelect: (id: string) => void;
  onDeleteSession: (id: string) => void;
  deletingId: string | null;
  onChecklist: () => void;
}) {
  const sorted = parts
    .map((p, i) => ({ p, s: partStatus(p), i }))
    .sort((a, b) => ORDER.indexOf(a.s) - ORDER.indexOf(b.s) || a.i - b.i);
  const last = sessions[0];

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black tracking-tight">Car status</h1>
        {backupUrl && (
          <span className="ml-auto text-xs text-zinc-500">
            <a href={backupUrl} className="underline-offset-4 hover:text-orange hover:underline" title="Updated after every change. Bookmark this link: it works even if the site is down.">
              Excel backup ↓
            </a>
            {" · "}
            <a href={`${backupUrl}&list=1`} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-orange hover:underline">
              by day
            </a>
          </span>
        )}
        <button
          type="button"
          onClick={onChecklist}
          className="rounded-lg border border-orange/50 px-4 py-2 text-sm font-semibold text-orange transition hover:bg-orange/10"
        >
          After race weekend checklist
        </button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
        {sorted.map(({ p, s }) => {
          const color = WEAR_COLORS[s];
          const pic = p.slug ? PART_IMAGES[p.slug] : undefined;
          const used = lifeUsed(p);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              title={p.name}
              className={`group relative rounded-xl border bg-white/[0.02] p-3 text-left transition hover:bg-white/[0.05] ${
                s === "due" ? "border-red-500/40" : s === "soon" ? "border-orange-400/30" : "border-white/10 hover:border-white/25"
              }`}
            >
              {pic ? (
                <div
                  aria-hidden
                  className="part-img aspect-square w-full transition group-hover:scale-[1.04]"
                  style={{ backgroundColor: color, maskImage: `url(/parts/${pic.img}.webp)`, WebkitMaskImage: `url(/parts/${pic.img}.webp)` }}
                />
              ) : (
                <div aria-hidden className="flex aspect-square w-full items-center justify-center">
                  <span className="h-1/3 w-1/3 rounded-full border-2" style={{ borderColor: color }} />
                </div>
              )}
              {pic?.fluid && (
                <svg aria-label="Fluid" viewBox="0 0 24 24" className="absolute right-3 top-3 h-5 w-5" style={{ color }}>
                  <path fill="currentColor" d="M12 2.5c-.3 0-.6.2-.8.5C9.4 5.8 6 10.6 6 14a6 6 0 0 0 12 0c0-3.4-3.4-8.2-5.2-11-.2-.3-.5-.5-.8-.5z" />
                </svg>
              )}
              <p className="mt-1 truncate text-sm font-semibold text-zinc-100">{p.name}</p>
              {used != null && (
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(Math.max(used, 0), 1) * 100}%`, background: color }} />
                </div>
              )}
              <p className="mt-1 font-mono text-[10px] text-zinc-500">{valueText(p)}</p>
            </button>
          );
        })}
      </div>

      <CarNotes notes={notes} onSaved={onSaved} />

      <details className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] text-sm">
        <summary className="cursor-pointer px-4 py-3 text-zinc-400">
          {last ? (
            <>Last session: <span className="text-zinc-200">{last.name}</span> · {formatNumber(last.hours)} hrs · {formatDate(last.date)}</>
          ) : (
            "No sessions logged yet"
          )}
        </summary>
        {sessions.length > 0 && (
          <ul className="divide-y divide-white/5 border-t border-white/5">
            {sessions.slice(0, 8).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
                <span className="w-24 shrink-0 text-zinc-400">{formatDate(s.date)}</span>
                <span className="font-semibold text-zinc-100">{s.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  {s.type === "race_weekend" ? "Race" : "Test"}
                </span>
                <span className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-3">
                  <span className="whitespace-nowrap font-mono text-zinc-300">{formatNumber(s.hours)} hrs</span>
                  <ConfirmButton
                    className="max-w-full text-left"
                    steps={["Delete", "Delete this session?", `Yes, delete: removes ${formatNumber(s.hours)} hrs from every part`]}
                    busy={deletingId === s.id}
                    onConfirm={() => onDeleteSession(s.id)}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  );
}
