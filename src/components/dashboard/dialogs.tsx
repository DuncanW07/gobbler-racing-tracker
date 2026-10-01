"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { logEntry, logSession, setLimit, type TrackerResult } from "@/app/actions/tracker";
import { RESULT_LABELS, UNITS, formatNumber, type CheckResult, type EntryAction, type Part, type SessionType, type TrackerState } from "@/lib/parts";

export const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-orange/70 focus:ring-2 focus:ring-orange/25";
export const labelClass = "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400";

const NAME_KEY = "gr-logged-by";

// Who's logging: remembered per device since everyone shares one login. Every
// "Logged by" field on the page stays in sync.
const NAME_EVENT = "gr-logged-by";
export function useLoggedBy(): [string, (v: string) => void] {
  const [name, setName] = useState("");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value read once
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      // storage unavailable: just start blank
    }
    const sync = (e: Event) => setName((e as CustomEvent<string>).detail);
    window.addEventListener(NAME_EVENT, sync);
    return () => window.removeEventListener(NAME_EVENT, sync);
  }, []);
  const update = (v: string) => {
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      // ignore
    }
    window.dispatchEvent(new CustomEvent(NAME_EVENT, { detail: v }));
  };
  return [name, update];
}

export function Modal({
  eyebrow,
  title,
  subtitle,
  onClose,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-orange">{eyebrow}</p>
        <h2 id="modal-title" className="mt-1 text-xl font-black">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

// Good / Watch / Replace. Click the selected one again to clear it.
const RESULT_TONES: Record<CheckResult, string> = {
  good: "border-emerald-400/70 bg-emerald-400/15 text-emerald-200",
  watch: "border-orange-400/70 bg-orange-400/15 text-orange-200",
  replace: "border-red-500/70 bg-red-500/15 text-red-200",
};
export function ResultPicker({ value, onChange, label }: { value: CheckResult | null; onChange: (v: CheckResult | null) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1.5">
      {(Object.keys(RESULT_LABELS) as CheckResult[]).map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(value === r ? null : r)}
          className={`rounded-md border px-2.5 py-1 text-xs transition ${value === r ? RESULT_TONES[r] : "border-white/10 text-zinc-400 hover:text-zinc-200"}`}
        >
          {RESULT_LABELS[r]}
        </button>
      ))}
    </div>
  );
}

export function Footer({ pending, error, label, onCancel }: { pending: boolean; error: string | null; label: string; onCancel: () => void }) {
  return (
    <>
      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white">
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-linear-to-r from-orange to-maroon-bright px-5 py-2 text-sm font-bold uppercase tracking-[0.15em] text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : label}
        </button>
      </div>
    </>
  );
}

// Shared submit handling: run the action, close on success, show errors.
export function useSave(onSaved: (state: TrackerState) => void) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const save = (action: () => Promise<TrackerResult>) => {
    setError(null);
    start(async () => {
      const res = await action();
      if (res.ok) onSaved(res.state);
      else setError(res.error);
    });
  };
  return { pending, error, save };
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ---------------------------------------------------------------- log session

export function LogSessionDialog({ type, onClose, onSaved }: { type: SessionType; onClose: () => void; onSaved: (s: TrackerState) => void }) {
  const { pending, error, save } = useSave(onSaved);
  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const race = type === "race_weekend";
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <Modal
      eyebrow={race ? "Log race weekend" : "Log test day"}
      title="Time on track"
      subtitle={race ? "Adds the hours to every part, and flags the every-weekend parts for the checklist next." : "Adds the hours to every part."}
      onClose={onClose}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(() => logSession({ name, date, type, hours, notes })); }}>
        <div className="space-y-4">
          <div>
            <label htmlFor="s-name" className={labelClass}>Event / track</label>
            <input id="s-name" ref={first} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={race ? "e.g. Miami, CRS Round 3" : "e.g. VIR test day"} className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="s-date" className={labelClass}>Date</label>
              <input id="s-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="s-hours" className={labelClass}>Hours on track</label>
              <input id="s-hours" type="number" inputMode="decimal" step="0.1" min="0.1" max="100" required value={hours} onChange={(e) => setHours(e.target.value)} placeholder={race ? "e.g. 5" : "e.g. 2"} className={fieldClass} />
            </div>
          </div>
          <div>
            <label htmlFor="s-notes" className={labelClass}>Notes (optional)</label>
            <textarea id="s-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <Footer pending={pending} error={error} label={race ? "Log race weekend" : "Log test day"} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- check / change / issue

const ENTRY_COPY: Record<EntryAction, { eyebrow: string; button: string; subtitle: (p: Part) => string }> = {
  checked: {
    eyebrow: "Log check",
    button: "Save check",
    subtitle: (p) => (p.tracking === "measured" ? "Record what you measured." : "Record that it was inspected, and anything you noticed."),
  },
  changed: {
    eyebrow: "Log change",
    button: "Save change",
    subtitle: (p) =>
      p.tracking === "hours" || p.tracking === "weekends"
        ? "Resets the count for this part from now on."
        : "Record the replacement.",
  },
  issue: {
    eyebrow: "Report issue",
    button: "Save issue",
    subtitle: () => "Something broke or looks wrong. It goes into this part's history.",
  },
};

export function EntryDialog({
  part,
  action,
  onClose,
  onSaved,
}: {
  part: Part;
  action: EntryAction;
  onClose: () => void;
  onSaved: (s: TrackerState) => void;
}) {
  const { pending, error, save } = useSave(onSaved);
  const [loggedBy, setLoggedBy] = useLoggedBy();
  const [measurement, setMeasurement] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const copy = ENTRY_COPY[action];
  const measured = part.tracking === "measured" && action !== "issue";
  const unit = UNITS[part.tracking];

  return (
    <Modal eyebrow={copy.eyebrow} title={part.name} subtitle={copy.subtitle(part)} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(() => logEntry({ partId: part.id, action, measurement, cost, loggedBy, notes, result }));
        }}
      >
        <div className="space-y-4">
          {measured && (
            <div>
              <label htmlFor="e-measure" className={labelClass}>
                {action === "changed" ? `New measurement (${unit}, optional)` : `Measurement (${unit})`}
              </label>
              <input
                id="e-measure"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                required={action === "checked"}
                value={measurement}
                onChange={(e) => setMeasurement(e.target.value)}
                className={fieldClass}
                autoFocus
              />
            </div>
          )}
          {action === "checked" && (
            <div>
              <p className={labelClass}>Result (optional)</p>
              <ResultPicker value={result} onChange={setResult} label="Result" />
              <p className="mt-1.5 text-xs text-zinc-500">Watch turns the part orange, Replace turns it red, until it&apos;s changed.</p>
            </div>
          )}
          {action !== "checked" && (
            <div>
              <label htmlFor="e-cost" className={labelClass}>Cost in $ (optional)</label>
              <input id="e-cost" type="number" inputMode="decimal" step="0.01" min="0" value={cost} onChange={(e) => setCost(e.target.value)} className={fieldClass} />
            </div>
          )}
          <div>
            <label htmlFor="e-notes" className={labelClass}>{action === "issue" ? "What happened" : "Notes (optional)"}</label>
            <textarea
              id="e-notes"
              rows={3}
              maxLength={1000}
              required={action === "issue"}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={fieldClass}
              autoFocus={!measured}
            />
          </div>
          <div>
            <label htmlFor="e-by" className={labelClass}>Logged by</label>
            <input id="e-by" required maxLength={60} value={loggedBy} onChange={(e) => setLoggedBy(e.target.value)} placeholder="Your name" className={fieldClass} />
          </div>
        </div>
        <Footer pending={pending} error={error} label={copy.button} onCancel={onClose} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- limit

export function LimitDialog({ part, onClose, onSaved }: { part: Part; onClose: () => void; onSaved: (s: TrackerState) => void }) {
  const { pending, error, save } = useSave(onSaved);
  const [limit, setLimitValue] = useState(part.limit != null ? String(part.limit) : "");
  const [newValue, setNewValue] = useState(part.newValue != null ? String(part.newValue) : "");
  const [startValue, setStartValue] = useState("");
  const [inspectEvery, setInspectEvery] = useState(part.inspectEvery != null ? String(part.inspectEvery) : "");
  const [dueAfterRace, setDueAfterRace] = useState(part.dueAfterRace);
  const measured = part.tracking === "measured";
  const counted = part.tracking === "hours" || part.tracking === "weekends";
  const condition = part.tracking === "condition";
  const unit = UNITS[part.tracking];

  return (
    <Modal
      eyebrow={condition ? "Inspection" : "Set limit"}
      title={part.name}
      subtitle={
        condition
          ? "How often it gets inspected. It turns orange when an inspection is due."
          : measured
          ? "Enter the thickness when new and the minimum allowed. The part turns orange in the last 20% and red at the minimum."
          : `Change interval in ${unit}. The part turns orange at 80% and red at 100%.`
      }
      onClose={onClose}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(() =>
            setLimit({
              partId: part.id,
              limit: condition ? "" : limit,
              newValue: measured ? newValue : undefined,
              startValue: counted ? startValue : undefined,
              inspectEvery,
              dueAfterRace: counted ? dueAfterRace : undefined,
            }),
          ); }}>
        {!condition && <div className={measured ? "grid grid-cols-2 gap-3" : ""}>
          {measured && (
            <div>
              <label htmlFor="l-new" className={labelClass}>When new ({unit})</label>
              <input id="l-new" type="number" inputMode="decimal" step="0.1" min="0" required value={newValue} onChange={(e) => setNewValue(e.target.value)} className={fieldClass} autoFocus />
            </div>
          )}
          <div>
            <label htmlFor="l-limit" className={labelClass}>{measured ? `Minimum (${unit})` : `Change every (${unit})`}</label>
            <input id="l-limit" type="number" inputMode="decimal" step="0.1" min="0" required value={limit} onChange={(e) => setLimitValue(e.target.value)} className={fieldClass} autoFocus={!measured} />
          </div>
        </div>}
        {counted && (
          <div className="mt-4">
            <label htmlFor="l-start" className={labelClass}>Already on it right now ({unit}, optional)</label>
            <input
              id="l-start"
              type="number"
              inputMode="decimal"
              step={part.tracking === "weekends" ? "1" : "0.1"}
              min="0"
              value={startValue}
              onChange={(e) => setStartValue(e.target.value)}
              placeholder={`Tracker shows ${formatNumber(part.used ?? 0)} now`}
              className={fieldClass}
            />
            <p className="mt-1.5 text-xs text-zinc-500">
              Sets the count to this number as of today. Sessions logged after this add on top. Leave blank to keep the current count.
            </p>
          </div>
        )}
        {counted && (
          <label className="mt-4 flex items-center gap-2.5 text-sm text-zinc-300">
            <input type="checkbox" checked={dueAfterRace} onChange={(e) => setDueAfterRace(e.target.checked)} className="h-4 w-4 accent-orange" />
            Replaced every race weekend (turns red once one is logged)
          </label>
        )}
        <div className={condition ? "" : "mt-4"}>
          <label htmlFor="l-inspect" className={labelClass}>Inspect every (weekends{condition ? "" : ", optional"})</label>
          <input id="l-inspect" type="number" inputMode="numeric" step="1" min="1" max="50" required={condition} value={inspectEvery} onChange={(e) => setInspectEvery(e.target.value)} placeholder="e.g. 1 = after every weekend" className={fieldClass} autoFocus={condition} />
        </div>
        <Footer pending={pending} error={error} label={condition ? "Save" : "Save limit"} onCancel={onClose} />
      </form>
    </Modal>
  );
}
