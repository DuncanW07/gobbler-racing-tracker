"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { logout } from "@/app/actions/auth";
import { STARTING_PARTS, type Part } from "@/lib/parts";
import type { CarHighlight } from "./car-3d";
import { PartList } from "./part-list";
import { Overview } from "./overview";
import { PartDetail } from "./part-detail";
import { AddPartDialog, type NewPart } from "./add-part-dialog";

const Car3D = dynamic(() => import("./car-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600">
      Loading car…
    </div>
  ),
});

// Laptop/PC gets the 3D car; phone/iPad doesn't. The deciding check is the
// main input: mouse/trackpad (laptop, PC, touchscreen laptops too) vs touch
// (phones, iPads). Screen width and 3D support are safety checks.
function isComputer(): boolean {
  const mainInputIsMouse = window.matchMedia("(pointer: fine) and (hover: hover)").matches;
  const wide = window.innerWidth >= 1024;
  let webgl = false;
  try {
    webgl = !!document.createElement("canvas").getContext("webgl2");
  } catch {
    webgl = false;
  }
  return mainInputIsMouse && wide && webgl;
}

export function Dashboard() {
  const [parts, setParts] = useState<Part[]>(STARTING_PARTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [show3D, setShow3D] = useState<boolean | null>(null);
  const [adding, setAdding] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<NewPart | null>(null);

  // Decided once on load (browser-only info, so it can't run on the server).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only info once on mount
    setShow3D(isComputer());
  }, []);

  const selected = parts.find((p) => p.id === selectedId) ?? null;

  const highlight: CarHighlight | null = useMemo(() => {
    if (placing) return null;
    if (!selected) return null;
    return { keys: selected.model, color: selected.color, marker: selected.marker };
  }, [selected, placing]);

  const markers = parts
    .filter((p) => p.marker)
    .map((p) => ({ position: p.marker!, color: p.color, active: p.id === selectedId }));
  if (draft?.marker) markers.push({ position: draft.marker, color: draft.color, active: true });

  const pickFromCar = (key: string) => {
    const match = parts.find((p) => p.model.includes(key));
    if (match) setSelectedId(match.id);
  };

  const finishAdd = (part: NewPart) => {
    const id = `custom-${Date.now()}`;
    setParts((prev) => [
      ...prev,
      {
        id,
        name: part.name,
        group: "custom",
        tracking: part.tracking,
        corner: part.corner,
        model: [],
        color: part.color,
        marker: part.marker,
      },
    ]);
    setDraft(null);
    setAdding(false);
    setPlacing(false);
    setSelectedId(id);
  };

  const removePart = (id: string) => {
    setParts((prev) => prev.filter((p) => p.id !== id));
    setSelectedId(null);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-zinc-100">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-6 border-b border-white/10 bg-black/60 px-5 backdrop-blur">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-black tracking-tight text-white">GOBBLER RACING</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-orange sm:inline">
            Consumables Tracker
          </span>
        </div>
        <div className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
          Next event: not scheduled
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            disabled
            title="Coming next: log a session and hours update automatically"
            className="rounded-lg bg-linear-to-r from-orange to-maroon-bright px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-white opacity-60"
          >
            + Log session
          </button>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-white/10 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-400 transition hover:border-orange/50 hover:text-orange"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* Body */}
      <div className={`grid min-h-0 flex-1 ${show3D ? "grid-cols-[250px_1fr_35%]" : "grid-cols-[250px_1fr]"}`}>
        <PartList
          parts={parts}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={() => {
            setSelectedId(null);
            setAdding(true);
          }}
        />

        <main className="min-h-0 overflow-y-auto border-r border-white/10">
          {selected ? (
            <PartDetail part={selected} onBack={() => setSelectedId(null)} onRemove={removePart} />
          ) : (
            <Overview parts={parts} onSelect={setSelectedId} />
          )}
        </main>

        {show3D && (
          <aside className="relative min-h-0 bg-[radial-gradient(ellipse_at_center,rgba(134,31,65,0.18),transparent_70%)]">
            <div className="pointer-events-none absolute left-5 top-4 z-10 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">
              {placing
                ? "Click the spot where the part is"
                : selected
                  ? `Showing: ${selected.name}`
                  : "Drag to rotate · click a part"}
            </div>
            <Car3D
              highlight={highlight}
              markers={markers}
              onPickPart={pickFromCar}
              placing={placing}
              onPlace={(point) => {
                setDraft((d) => (d ? { ...d, marker: point } : d));
                setPlacing(false);
              }}
            />
          </aside>
        )}
      </div>

      {adding && (
        <AddPartDialog
          draft={draft}
          can3D={!!show3D}
          placing={placing}
          onDraftChange={setDraft}
          onStartPlacing={() => setPlacing(true)}
          onCancel={() => {
            setAdding(false);
            setPlacing(false);
            setDraft(null);
          }}
          onSave={finishAdd}
        />
      )}
    </div>
  );
}
