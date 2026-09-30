"use client";

import {
  ACTION_LABELS,
  GROUP_LABELS,
  RESULT_LABELS,
  RESULT_TEXT,
  STATUS_STYLES,
  TRACKING_LABELS,
  UNITS,
  formatDate,
  formatNumber,
  inspectionDue,
  withUnit,
  lifeUsed,
  partStatus,
  statusLabel,
  type EntryAction,
  type HistoryEntry,
  type Part,
} from "@/lib/parts";
import { ConfirmButton } from "./confirm-button";

export type PartAction = EntryAction | "limit";

const ACTION_TONES: Record<HistoryEntry["action"], string> = {
  checked: "border-sky-400/40 text-sky-300",
  changed: "border-emerald-400/40 text-emerald-300",
  issue: "border-red-400/40 text-red-300",
  topped_off: "border-orange-400/40 text-orange-300",
};

export function PartDetail({
  part,
  history,
  onBack,
  onAction,
  onRemove,
  removing,
  onDeleteEntry,
  deletingId,
}: {
  part: Part;
  history: HistoryEntry[] | "loading" | { error: string };
  onBack: () => void;
  onAction: (a: PartAction) => void;
  onRemove: (id: string) => void;
  removing: boolean;
  onDeleteEntry: (id: string) => void;
  deletingId: string | null;
}) {
  const status = STATUS_STYLES[partStatus(part)];
  const unit = UNITS[part.tracking];
  const used = lifeUsed(part);
  const measured = part.tracking === "measured";
  const counted = part.tracking === "hours" || part.tracking === "weekends";

  const stat = (label: string, value: string) => (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="mt-1.5 text-xl font-bold text-zinc-200">{value}</p>
    </div>
  );

  let lifeText: string;
  let lifeHint: string;
  if (counted) {
    lifeText = `${formatNumber(part.used)} / ${formatNumber(part.limit)} ${unit}`;
    lifeHint = part.limit == null
      ? "No change interval set yet. Use Set limit once the team gives you one."
      : `${withUnit(Math.max(part.limit - (part.used ?? 0), 0), unit)} left before a change is due.`;
  } else if (measured) {
    lifeText = `${formatNumber(part.current)} ${unit} now`;
    lifeHint = part.limit == null
      ? "No minimum set yet. Use Set limit to enter the new and minimum thickness."
      : part.current == null
        ? "No measurement logged yet. Use Log check after measuring."
        : `Minimum ${formatNumber(part.limit)} ${unit}${part.newValue != null ? `, ${formatNumber(part.newValue)} ${unit} when new` : ""}.`;
  } else {
    lifeText = part.lastEntry ? `Last looked at ${formatDate(part.lastEntry)}` : "Not checked yet";
    lifeHint = "Tracked by inspections. Log a check each time it's looked at, or report an issue.";
  }

  const inspectText = part.inspectEvery == null ? null
    : inspectionDue(part) ? "Inspection due now."
    : `Inspect every ${part.inspectEvery === 1 ? "race weekend" : `${part.inspectEvery} weekends`}. Next due in ${withUnit(part.inspectEvery - (part.sinceCheck ?? 0), "weekends")}.`;

  const barColor = partStatus(part) === "due" ? "#ef4444" : partStatus(part) === "soon" ? "#fbbf24" : part.color;

  return (
    <div className="p-4 sm:p-8">
      <button type="button" onClick={onBack} className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 transition hover:text-orange">
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
        <span className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-300">
          <span className={`h-2 w-2 rounded-full ${status.dot}`} />
          {statusLabel(part)}
        </span>
      </div>

      {/* Life */}
      <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Life</h2>
          <span className="font-mono text-sm text-zinc-300">{lifeText}</span>
        </div>
        {part.tracking !== "condition" && (
          <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(Math.max(used ?? 0, 0), 1) * 100}%`, background: barColor }}
            />
          </div>
        )}
        <p className="mt-3 text-sm text-zinc-500">{lifeHint}</p>
        {inspectText && <p className={`mt-1 text-sm ${inspectionDue(part) ? "text-orange-300" : "text-zinc-500"}`}>{inspectText}</p>}
        {part.checkResult && part.checkResult !== "good" && (
          <p className={`mt-1 text-sm ${RESULT_TEXT[part.checkResult]}`}>
            Last check: {RESULT_LABELS[part.checkResult]}. Stays flagged until the part is changed or a later check says Good.
          </p>
        )}
        {part.dueAfterRace && <p className="mt-1 text-sm text-zinc-500">Replaced every race weekend: turns red once one is logged.</p>}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stat(
          measured ? "Minimum" : counted ? "Change every" : "Entries",
          measured || counted
            ? part.limit != null ? withUnit(part.limit, unit) : "—"
            : Array.isArray(history) ? String(history.length) : "—",
        )}
        {stat(
          measured ? "Last measured" : counted ? "Since last change" : "Last entry",
          measured ? `${formatNumber(part.current)} ${part.current != null ? unit : ""}` : counted ? withUnit(part.used, unit) : formatDate(part.lastEntry),
        )}
        {stat("Last changed", formatDate(part.lastChanged))}
      </div>

      {/* Actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {([
          ["checked", "Log check"],
          ["changed", "Log change"],
          ["issue", "Report issue"],
          ["limit", part.tracking === "condition" ? "Inspection schedule" : part.limit != null ? "Edit limit" : "Set limit"],
        ] as [PartAction, string][]).map(([action, label]) => (
          <button
            key={action}
            type="button"
            onClick={() => onAction(action)}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 transition hover:border-orange/60 hover:text-orange"
          >
            {label}
          </button>
        ))}
      </div>

      {/* History */}
      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">History</h2>
        {history === "loading" ? (
          <p className="mt-3 text-sm text-zinc-500">Loading…</p>
        ) : !Array.isArray(history) ? (
          <p className="mt-3 text-sm text-red-300">{history.error}</p>
        ) : history.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-white/10 px-5 py-6 text-sm text-zinc-500">
            No history yet. Checks, changes and issues for this part will list here.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-white/5 rounded-xl border border-white/10 bg-white/[0.02]">
            {history.map((h) => (
              <li key={h.id} className="flex gap-4 px-5 py-4">
                <span className={`h-fit shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.15em] ${ACTION_TONES[h.action]}`}>
                  {ACTION_LABELS[h.action]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                    <span className="text-zinc-200">{formatDate(h.at)}</span>
                    {h.measurement != null && <span className="font-mono text-zinc-300">{formatNumber(h.measurement)} {unit}</span>}
                    {h.cost != null && <span className="font-mono text-zinc-400">${h.cost.toFixed(2)}</span>}
                    {h.result && <span className={RESULT_TEXT[h.result]}>{RESULT_LABELS[h.result]}</span>}
                    {h.loggedBy && <span className="text-zinc-500">by {h.loggedBy}</span>}
                  </div>
                  {h.notes && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-400">{h.notes}</p>}
                </div>
                <ConfirmButton
                  className="h-fit"
                  steps={["Delete", "Confirm delete"]}
                  busy={deletingId === h.id}
                  onConfirm={() => onDeleteEntry(h.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {part.group === "custom" && (
        <section className="mt-8 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-zinc-400">
            {part.marker ? "Location marked on the car." : "No location marked on the car."} Removing hides it; its history is kept.
          </p>
          <button
            type="button"
            disabled={removing}
            onClick={() => onRemove(part.id)}
            className="shrink-0 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            {removing ? "Removing…" : "Remove part"}
          </button>
        </section>
      )}
    </div>
  );
}
