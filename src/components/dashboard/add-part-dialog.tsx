"use client";

import { useEffect, useRef } from "react";
import { NEON, TRACKING_LABELS, type Corner, type Tracking } from "@/lib/parts";

export type NewPart = {
  name: string;
  tracking: Tracking;
  corner?: Corner;
  color: string;
  marker?: [number, number, number];
};

const COLORS = [NEON.cyan, NEON.blue, NEON.yellow, NEON.green, NEON.pink];
const CORNER_OPTIONS: { value: "" | Corner; label: string }[] = [
  { value: "", label: "Whole car" },
  { value: "FL", label: "Front left" },
  { value: "FR", label: "Front right" },
  { value: "RL", label: "Rear left" },
  { value: "RR", label: "Rear right" },
];

const field =
  "w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2.5 text-sm text-white outline-none transition focus:border-orange/70 focus:ring-2 focus:ring-orange/25";
const labelClass = "mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-400";

export function AddPartDialog({
  draft,
  can3D,
  placing,
  onDraftChange,
  onStartPlacing,
  onCancel,
  onSave,
  saving = false,
  error = null,
}: {
  draft: NewPart | null;
  can3D: boolean;
  placing: boolean;
  saving?: boolean;
  error?: string | null;
  onDraftChange: (d: NewPart) => void;
  onStartPlacing: () => void;
  onCancel: () => void;
  onSave: (d: NewPart) => void;
}) {
  const value: NewPart = draft ?? { name: "", tracking: "condition", color: COLORS[0] };
  const nameRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<NewPart>) => onDraftChange({ ...value, ...patch });

  useEffect(() => {
    if (!placing) nameRef.current?.focus();
  }, [placing]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // While placing, shrink to a bar so the car can be clicked.
  if (placing) {
    return (
      <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center">
        <div className="flex items-center gap-4 rounded-full border border-orange/40 bg-zinc-950/95 px-5 py-3 shadow-2xl shadow-black">
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: value.color }} />
          <span className="text-sm text-zinc-200">
            Click where <strong>{value.name || "the part"}</strong> is on the car
          </span>
          <button type="button" onClick={onCancel} className="text-sm text-zinc-500 hover:text-orange">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const canSave = value.name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-part-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) onSave({ ...value, name: value.name.trim() });
        }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl"
      >
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-orange">New part</p>
        <h2 id="add-part-title" className="mt-1 text-xl font-black">Add a part to track</h2>
        <p className="mt-1 text-sm text-zinc-500">
          For anything not already on the list, like a part that broke or needs watching.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="part-name" className={labelClass}>Name</label>
            <input
              id="part-name"
              ref={nameRef}
              value={value.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="e.g. Front left control arm"
              maxLength={60}
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="part-tracking" className={labelClass}>Tracked by</label>
              <select
                id="part-tracking"
                value={value.tracking}
                onChange={(e) => set({ tracking: e.target.value as Tracking })}
                className={field}
              >
                {(Object.keys(TRACKING_LABELS) as Tracking[]).map((t) => (
                  <option key={t} value={t}>{TRACKING_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="part-corner" className={labelClass}>Corner</label>
              <select
                id="part-corner"
                value={value.corner ?? ""}
                onChange={(e) => set({ corner: (e.target.value || undefined) as Corner | undefined })}
                className={field}
              >
                {CORNER_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <span className={labelClass}>Highlight color</span>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Color ${c}`}
                  onClick={() => set({ color: c })}
                  className={`h-7 w-7 rounded-full border-2 transition ${value.color === c ? "border-white" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-sm font-semibold text-zinc-200">Location on the car</p>
            {can3D ? (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-sm text-zinc-500">
                  {value.marker ? "Marked. It will glow when this part is selected." : "Not marked yet."}
                </p>
                <button
                  type="button"
                  disabled={!canSave}
                  onClick={onStartPlacing}
                  className="shrink-0 rounded-lg border border-orange/50 px-3 py-1.5 text-sm text-orange transition hover:bg-orange/10 disabled:opacity-40"
                >
                  {value.marker ? "Move" : "Mark on car"}
                </button>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500">Turn on 3D to mark where it is on the car.</p>
            )}
          </div>
        </div>

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
            disabled={!canSave || saving}
            className="rounded-lg bg-linear-to-r from-orange to-maroon-bright px-5 py-2 text-sm font-bold uppercase tracking-[0.15em] text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : "Add part"}
          </button>
        </div>
      </form>
    </div>
  );
}
