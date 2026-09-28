"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { logEntry, logSession, setLimit, type TrackerResult } from "@/app/actions/tracker";
import { UNITS, type EntryAction, type Part, type SessionType, type TrackerState } from "@/lib/parts";

export const fieldClass =
  "w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-orange/70 focus:ring-2 focus:ring-orange/25";
export const labelClass = "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400";

const NAME_KEY = "gr-logged-by";

// Who's logging: remembered per device since everyone shares one login.
export function useLoggedBy(): [string, (v: string) => void] {
  const [name, setName] = useState("");
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value read once
      setName(localStorage.getItem(NAME_KEY) ?? "");
    } catch {
      // storage unavailable: just start blank
    }
  }, []);
  const update = (v: string) => {
    setName(v);
    try {
      localStorage.setItem(NAME_KEY, v);
    } catch {
      // ignore
    }
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

function Footer({ pending, error, label, onCancel }: { pending: boolean; error: string | null; label: string; onCancel: () => void }) {
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
function useSave(onSaved: (state: TrackerState) => void) {
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

export function LogSessionDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (s: TrackerState) => void }) {
  const { pending, error, save } = useSave(onSaved);
  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [type, setType] = useState<SessionType>("race_weekend");
  const [hours, setHours] = useState("");
  const [notes, setNotes] = useState("");
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <Modal
      eyebrow="Log session"
      title="Time on track"
      subtitle="Hours are added to every part tracked by engine hours, since its last change."
      onClose={onClose}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(() => logSession({ name, date, type, hours, notes })); }}>
        <div className="space-y-4">
          <div>
            <label htmlFor="s-name" className={labelClass}>Event / track</label>
            <input id="s-name" ref={first} required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. VIR, CRS Round 3" className={fieldClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="s-date" className={labelClass}>Date</label>
              <input id="s-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="s-type" className={labelClass}>Type</label>
              <select id="s-type" value={type} onChange={(e) => setType(e.target.value as SessionType)} className={fieldClass}>
                <option value="race_weekend">Race weekend</option>
                <option value="test_day">Test day</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="s-hours" className={labelClass}>Time on track (hours)</label>
            <input id="s-hours" type="number" inputMode="decimal" step="0.1" min="0" max="100" required value={hours} onChange={(e) => setHours(e.target.value)} placeholder="e.g. 2.5" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="s-notes" className={labelClass}>Notes (optional)</label>
            <textarea id="s-notes" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className={fieldClass} />
          </div>
        </div>
        <Footer pending={pending} error={error} label="Log session" onCancel={onClose} />
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
  const copy = ENTRY_COPY[action];
  const measured = part.tracking === "measured" && action !== "issue";
  const unit = UNITS[part.tracking];

  return (
    <Modal eyebrow={copy.eyebrow} title={part.name} subtitle={copy.subtitle(part)} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save(() => logEntry({ partId: part.id, action, measurement, cost, loggedBy, notes }));
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
            <input id="e-by" maxLength={60} value={loggedBy} onChange={(e) => setLoggedBy(e.target.value)} placeholder="Your name" className={fieldClass} />
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
  const measured = part.tracking === "measured";
  const unit = UNITS[part.tracking];

  return (
    <Modal
      eyebrow="Set limit"
      title={part.name}
      subtitle={
        measured
          ? "Enter the thickness when new and the minimum allowed. The part turns amber in the last 20% and red at the minimum."
          : `Change interval in ${unit}. The part turns amber at 80% and red at 100%.`
      }
      onClose={onClose}
    >
      <form onSubmit={(e) => { e.preventDefault(); save(() => setLimit({ partId: part.id, limit, newValue: measured ? newValue : undefined })); }}>
        <div className={measured ? "grid grid-cols-2 gap-3" : ""}>
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
        </div>
        <Footer pending={pending} error={error} label="Save limit" onCancel={onClose} />
      </form>
    </Modal>
  );
}
