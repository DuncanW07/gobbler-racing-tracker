"use client";

import { GROUP_LABELS, STATUS_STYLES, partStatus, type Part, type PartGroup } from "@/lib/parts";

const GROUP_ORDER: PartGroup[] = ["consumable", "wear", "custom"];

export function PartList({
  parts,
  selectedId,
  onSelect,
  onAdd,
}: {
  parts: Part[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
}) {
  const item = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition ${
      active
        ? "bg-linear-to-r from-orange/20 to-transparent text-white shadow-[inset_2px_0_0_#e5751f]"
        : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100"
    }`;

  return (
    <nav className="flex min-h-0 flex-col border-r border-white/10 bg-black/40">
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
                    <span className="sr-only">, {status.label.toLowerCase()}</span>
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
