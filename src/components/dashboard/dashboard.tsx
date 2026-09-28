"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { logout } from "@/app/actions/auth";
import { addPart, getHistory, refreshState, removePart } from "@/app/actions/tracker";
import { formatDate, formatNumber, type HistoryEntry, type TrackerState } from "@/lib/parts";
import type { CarHighlight } from "./car-3d";
import { PartList } from "./part-list";
import { Overview } from "./overview";
import { PartDetail, type PartAction } from "./part-detail";
import { AddPartDialog, type NewPart } from "./add-part-dialog";
import { EntryDialog, LimitDialog, LogSessionDialog } from "./dialogs";

const Car3D = dynamic(() => import("./car-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600">
      Loading car…
    </div>
  ),
});

const REFRESH_MS = 60_000;

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

type History = HistoryEntry[] | "loading" | { error: string };

export function Dashboard({ initialState }: { initialState: TrackerState }) {
  const [state, setState] = useState<TrackerState>(initialState);
  const { parts, sessions } = state;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<History>("loading");
  const [show3D, setShow3D] = useState<boolean | null>(null);
  const [dialog, setDialog] = useState<null | "session" | PartAction>(null);
  const [adding, setAdding] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<NewPart | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Decided once on load (browser-only info, so it can't run on the server).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only info once on mount
    setShow3D(isComputer());
  }, []);

  const selected = parts.find((p) => p.id === selectedId) ?? null;

  const loadHistory = useCallback(async (id: string) => {
    const res = await getHistory(id);
    setHistory(res.ok ? res.history : { error: res.error });
  }, []);

  const select = (id: string | null) => {
    setSelectedId(id);
    if (id) {
      setHistory("loading");
      void loadHistory(id);
    }
  };

  // Keep everyone's screens current: refresh every minute and when the tab
  // comes back into focus.
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await refreshState();
      if (res.ok) setState(res.state);
      if (selectedRef.current) void loadHistory(selectedRef.current);
    };
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [loadHistory]);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 3500);
  };

  const onSaved = (next: TrackerState, msg: string) => {
    setState(next);
    setDialog(null);
    flash(msg);
    if (selectedRef.current) void loadHistory(selectedRef.current);
  };

  const highlight: CarHighlight | null = useMemo(() => {
    if (placing || !selected) return null;
    return { keys: selected.model, color: selected.color, marker: selected.marker ?? undefined };
  }, [selected, placing]);

  const markers = parts
    .filter((p) => p.marker)
    .map((p) => ({ position: p.marker!, color: p.color, active: p.id === selectedId }));
  if (draft?.marker) markers.push({ position: draft.marker, color: draft.color, active: true });

  const pickFromCar = (key: string) => {
    const match = parts.find((p) => p.model.includes(key));
    if (match) select(match.id);
  };

  const finishAdd = (part: NewPart) => {
    setAddError(null);
    startSaving(async () => {
      const res = await addPart({
        name: part.name,
        tracking: part.tracking,
        corner: part.corner ?? null,
        color: part.color,
        marker: part.marker ?? null,
      });
      if (!res.ok) {
        setAddError(res.error);
        return;
      }
      setState(res.state);
      setDraft(null);
      setAdding(false);
      setPlacing(false);
      flash(`Added ${part.name}`);
      if (res.id) select(res.id);
    });
  };

  const onRemove = (id: string) => {
    startSaving(async () => {
      const res = await removePart(id);
      if (!res.ok) {
        flash(res.error);
        return;
      }
      setState(res.state);
      setSelectedId(null);
      flash("Part removed");
    });
  };

  const lastSession = sessions[0];

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
          <span className={`h-1.5 w-1.5 rounded-full ${lastSession ? "bg-emerald-400" : "bg-zinc-600"}`} />
          {lastSession
            ? `Last session: ${lastSession.name} · ${formatDate(lastSession.date)} · ${formatNumber(lastSession.hours)} hrs`
            : "No sessions logged yet"}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setDialog("session")}
            className="rounded-lg bg-linear-to-r from-orange to-maroon-bright px-4 py-2 text-xs font-bold uppercase tracking-[0.15em] text-white shadow-lg shadow-maroon/30 transition hover:brightness-110"
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
          onSelect={select}
          onAdd={() => {
            select(null);
            setAddError(null);
            setAdding(true);
          }}
        />

        <main className="min-h-0 overflow-y-auto">
          {selected ? (
            <PartDetail
              part={selected}
              history={history}
              onBack={() => select(null)}
              onAction={setDialog}
              onRemove={onRemove}
              removing={saving}
            />
          ) : (
            <Overview parts={parts} sessions={sessions} onSelect={select} />
          )}
        </main>

        {show3D && (
          <aside className="car-stage relative min-h-0">
            <div className="pointer-events-none absolute left-5 top-4 z-10 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400">
              {placing ? "Click the spot where the part is" : selected ? `Showing: ${selected.name}` : "Drag to rotate · click a part"}
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

      {/* Dialogs */}
      {dialog === "session" && (
        <LogSessionDialog onClose={() => setDialog(null)} onSaved={(s) => onSaved(s, "Session logged")} />
      )}
      {selected && (dialog === "checked" || dialog === "changed" || dialog === "issue") && (
        <EntryDialog
          part={selected}
          action={dialog}
          onClose={() => setDialog(null)}
          onSaved={(s) => onSaved(s, dialog === "checked" ? "Check saved" : dialog === "changed" ? "Change saved" : "Issue saved")}
        />
      )}
      {selected && dialog === "limit" && (
        <LimitDialog part={selected} onClose={() => setDialog(null)} onSaved={(s) => onSaved(s, "Limit saved")} />
      )}
      {adding && (
        <AddPartDialog
          draft={draft}
          can3D={!!show3D}
          placing={placing}
          saving={saving}
          error={addError}
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

      {notice && (
        <div role="status" className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-zinc-900/95 px-5 py-2.5 text-sm text-zinc-100 shadow-2xl">
          {notice}
        </div>
      )}
    </div>
  );
}
