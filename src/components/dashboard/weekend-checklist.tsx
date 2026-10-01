"use client";

import { useState } from "react";
import { afterWeekend } from "@/app/actions/tracker";
import { INSPECT_HINTS, type CheckResult, type Part, type TrackerState } from "@/lib/parts";
import { Footer, Modal, ResultPicker, fieldClass, labelClass, useLoggedBy, useSave } from "./dialogs";

type Check = { result: CheckResult | null; notes: string };

// After a race weekend: tick what was replaced, rate each inspection, save once.
// The lists build themselves: parts replaced every weekend, and parts with an
// inspection interval.
export function WeekendChecklist({ parts, onClose, onSaved }: { parts: Part[]; onClose: () => void; onSaved: (s: TrackerState) => void }) {
  const replace = parts.filter((p) => p.dueAfterRace);
  const inspect = parts.filter((p) => p.inspectEvery != null);
  const [changed, setChanged] = useState(() => new Set(replace.map((p) => p.id)));
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [loggedBy, setLoggedBy] = useLoggedBy();
  const { pending, error, save } = useSave(onSaved);

  const toggle = (id: string) =>
    setChanged((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const setCheck = (id: string, patch: Partial<Check>) =>
    setChecks((c) => ({ ...c, [id]: { ...(c[id] ?? { result: null, notes: "" }), ...patch } }));
  // Marks every inspection not yet rated as Good; anything already rated (or
  // changed afterwards) keeps its own result. Clear one to leave it uninspected.
  const allGood = () =>
    setChecks((c) => Object.fromEntries(inspect.map((p) => [p.id, c[p.id]?.result ? c[p.id] : { result: "good" as const, notes: c[p.id]?.notes ?? "" }])));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save(() =>
      afterWeekend({
        loggedBy,
        changed: [...changed],
        checks: Object.entries(checks).flatMap(([id, c]) => (c.result ? [{ id, result: c.result, notes: c.notes }] : [])),
      }),
    );
  };

  return (
    <Modal eyebrow="After race weekend" title="Service checklist" subtitle="Anything left unticked or unrated stays flagged. Skip it now and it's on the overview later." onClose={onClose}>
      <form onSubmit={submit} className="space-y-6">
        {replace.length > 0 && (
          <section>
            <p className={labelClass}>Replaced</p>
            <ul className="space-y-1.5">
              {replace.map((p) => (
                <li key={p.id}>
                  <label className="flex items-center gap-2.5 text-sm text-zinc-200">
                    <input type="checkbox" checked={changed.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 accent-orange" />
                    {p.name}
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {inspect.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className={`${labelClass} mb-0`}>Inspected</p>
              <button type="button" onClick={allGood} className="rounded-md border border-emerald-400/50 px-2.5 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/10">
                All good
              </button>
            </div>
            <ul className="space-y-3">
              {inspect.map((p) => {
                const c = checks[p.id];
                return (
                  <li key={p.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-zinc-200">
                        {p.name}
                        {p.slug && INSPECT_HINTS[p.slug] && <span className="block text-xs text-zinc-500">{INSPECT_HINTS[p.slug]}</span>}
                      </span>
                      <ResultPicker value={c?.result ?? null} onChange={(result) => setCheck(p.id, { result })} label={p.name} />
                    </div>
                    {(c?.result === "watch" || c?.result === "replace") && (
                      <input
                        aria-label={`${p.name} notes`}
                        maxLength={1000}
                        value={c.notes}
                        onChange={(e) => setCheck(p.id, { notes: e.target.value })}
                        placeholder="What did you see?"
                        className={`${fieldClass} mt-2 py-1.5`}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div>
          <label htmlFor="w-by" className={labelClass}>Logged by</label>
          <input id="w-by" required maxLength={60} value={loggedBy} onChange={(e) => setLoggedBy(e.target.value)} placeholder="Your name" className={fieldClass} />
        </div>
        <Footer pending={pending} error={error} label="Save checklist" onCancel={onClose} />
      </form>
    </Modal>
  );
}
