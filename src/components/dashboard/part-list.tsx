"use client";

import { GROUP_LABELS, STATUS_STYLES, partStatus, statusLabel, type Part, type PartGroup } from "@/lib/parts";

const GROUP_ORDER: PartGroup[] = ["consumable", "wear", "custom"];

type Props = {
  parts: Part[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
};

// Computer sidebar.
export function PartList({ parts, selectedId, onSelect, onAdd, className = "" }: Props & { className?: string }) {
  const item = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
      active
        ? "bg-linear-to-r from-orange/20 to-transparent text-white shadow-[inset_2px_0_0_#e5751f]"
        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
    }`;

  return (
    <nav className={`min-h-0 flex-col border-r border-white/10 bg-black/40 ${className}`}>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <button type="button" onClick={() => onSelect(null)} className={item(selectedId === null)}>
          <span className="h-2 w-2 rounded-sm bg-orange" />
          <span className="font-semibold">Overview</span>
        </button>

        {GROUP_ORDER.map((group) => {
          const inGroup = parts.filter((p) => p.group === group);
          if (inGroup.length === 0) return null;
          return (
            <div key={group} className="mt-5">
              <p className="mb-1.5 px-3 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">
                {GROUP_LABELS[group]}
              </p>
              {inGroup.map((part) => {
                const status = STATUS_STYLES[partStatus(part)];
                return (
                  <button
                    key={part.id}
                    type="button"
                    onClick={() => onSelect(part.id)}
                    className={item(selectedId === part.id)}
                  >
                    <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${status.dot}`} />
                    <span className="truncate">{part.name}</span>
                    <span className="sr-only">, {statusLabel(part).toLowerCase()}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded-md border border-dashed border-white/15 px-3 py-2 text-sm text-zinc-400 transition hover:border-orange/60 hover:text-orange"
        >
          + Add part
        </button>
      </div>
    </nav>
  );
}

// Phone/tablet: a native dropdown (light, and phones show their own picker).
export function MobilePartPicker({ parts, selectedId, onSelect, onAdd }: Props) {
  return (
    <div className="sticky top-0 z-20 flex gap-2 border-b border-white/10 bg-background px-4 py-3 lg:hidden">
      <label htmlFor="part-picker" className="sr-only">Choose a part</label>
      <select
        id="part-picker"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value || null)}
        className="min-w-0 flex-1 rounded-lg border border-white/15 bg-zinc-900 px-3 py-2.5 text-base text-white"
      >
        <option value="">Overview</option>
        {GROUP_ORDER.map((group) => {
          const inGroup = parts.filter((p) => p.group === group);
          if (inGroup.length === 0) return null;
          return (
            <optgroup key={group} label={GROUP_LABELS[group]}>
              {inGroup.map((p) => {
                const s = partStatus(p);
                const flag = s === "due" ? "🔴 " : s === "soon" ? "🟡 " : "";
                return (
                  <option key={p.id} value={p.id}>
                    {flag}{p.name}
                  </option>
                );
              })}
            </optgroup>
          );
        })}
      </select>
      <button
        type="button"
        onClick={onAdd}
        className="shrink-0 rounded-lg border border-dashed border-white/20 px-3 text-sm text-zinc-300"
      >
        + Add
      </button>
    </div>
  );
}
