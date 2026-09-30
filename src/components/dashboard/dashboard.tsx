"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { logout } from "@/app/actions/auth";
import { addPart, deleteEntry, deleteSession, getHistory, refreshState, removePart } from "@/app/actions/tracker";
import { canShow3D } from "@/lib/device";
import { STATUS_STYLES, formatDate, formatNumber, partStatus, type HistoryEntry, type TrackerState } from "@/lib/parts";
import type { CarHighlight, HoverLine } from "./car-3d";
import { MobilePartPicker, PartList } from "./part-list";
import { Overview } from "./overview";
import { PartDetail, type PartAction } from "./part-detail";
import { AddPartDialog, type NewPart } from "./add-part-dialog";
import { EntryDialog, LimitDialog, LogSessionDialog } from "./dialogs";
import { TeamSettingsDialog } from "./team-settings-dialog";
import { WeekendChecklist } from "./weekend-checklist";

// Only downloaded on computers (phones/tablets never load the 3D code).
const Car3D = dynamic(() => import("./car-3d"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-600">
      Loading car…
    </div>
  ),
});

const REFRESH_MS = 60_000;

// Divider between the info and the car: the car's share of that area.
const SPLIT_KEY = "gr-car-split";
const SPLIT_DEFAULT = 0.41;
const SPLIT_MAX = 0.55; // car at most 55%, info at least 45%
const SPLIT_SNAP = 0.08; // drag closer than this to the edge and the car closes

type History = HistoryEntry[] | "loading" | { error: string };

export function Dashboard({ initialState }: { initialState: TrackerState }) {
  const [state, setState] = useState<TrackerState>(initialState);
  const { parts, sessions } = state;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<History>("loading");
  const [show3D, setShow3D] = useState<boolean | null>(null);
  const [split, setSplit] = useState(SPLIT_DEFAULT);
  const [dragging, setDragging] = useState(false);
  const splitRef = useRef<HTMLDivElement>(null);
  const splitValue = useRef(SPLIT_DEFAULT);
  const [dialog, setDialog] = useState<null | "race_weekend" | "test_day" | "settings" | "checklist" | PartAction>(null);
  const [adding, setAdding] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [draft, setDraft] = useState<NewPart | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  // Decided once on load (browser-only info, so it can't run on the server).
  useEffect(() => {
    let saved = SPLIT_DEFAULT;
    try {
      const raw = localStorage.getItem(SPLIT_KEY);
      if (raw != null && Number.isFinite(Number(raw))) saved = Math.min(Math.max(Number(raw), 0), SPLIT_MAX);
    } catch {
      // storage unavailable: use the default
    }
    splitValue.current = saved;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser-only info once on mount
    setSplit(saved);
    setShow3D(canShow3D());
  }, []);

  const applySplit = (value: number, save: boolean) => {
    const v = value < SPLIT_SNAP ? 0 : Math.min(value, SPLIT_MAX);
    splitValue.current = v;
    setSplit(v);
    if (save) {
      try {
        localStorage.setItem(SPLIT_KEY, String(v));
      } catch {
        // ignore
      }
    }
  };

  const startDrag = (e: React.PointerEvent) => {
    const box = splitRef.current?.getBoundingClientRect();
    if (!box) return;
    e.preventDefault();
    const startX = e.clientX;
    const wasClosed = splitValue.current === 0;
    let moved = false;
    setDragging(true);
    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 3) moved = true;
      if (moved) applySplit((box.right - ev.clientX) / box.width, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDragging(false);
      // A plain click on the closed divider reopens the car.
      if (!moved && wasClosed) applySplit(SPLIT_DEFAULT, true);
      else applySplit(splitValue.current, true);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const onDividerKey = (e: React.KeyboardEvent) => {
    const step = 0.03;
    if (e.key === "ArrowLeft") applySplit(Math.max(splitValue.current, SPLIT_SNAP) + step, true);
    else if (e.key === "ArrowRight") applySplit(splitValue.current - step, true);
    else if (e.key === "Home") applySplit(SPLIT_MAX, true);
    else if (e.key === "End") applySplit(0, true);
    else return;
    e.preventDefault();
  };

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

  // Worst wear per car piece, for the gray / orange / red colors on the 3D car.
  const wear = useMemo(() => {
    const out: Record<string, "soon" | "due"> = {};
    for (const p of parts) {
      const s = partStatus(p);
      if (s !== "soon" && s !== "due") continue;
      for (const k of p.model) if (out[k] !== "due") out[k] = s;
    }
    return out;
  }, [parts]);

  const describePiece = useCallback(
    (key: string): HoverLine[] =>
      parts.filter((p) => p.model.includes(key)).map((p) => ({ name: p.name, dot: STATUS_STYLES[partStatus(p)].dot })),
    [parts],
  );

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

  const onDeleteEntry = async (id: string) => {
    setDeletingId(id);
    const res = await deleteEntry(id);
    setDeletingId(null);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setState(res.state);
    if (selectedRef.current) await loadHistory(selectedRef.current);
    flash("Entry deleted");
  };

  const onDeleteSession = async (id: string) => {
    setDeletingId(id);
    const res = await deleteSession(id);
    setDeletingId(null);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setState(res.state);
    flash("Session deleted");
  };

  const lastSession = sessions[0];
  const carOpen = !!show3D && split > 0;
  const onAdd = () => {
    select(null);
    setAddError(null);
    setAdding(true);
  };

  return (
    <div className={`flex h-dvh flex-col overflow-hidden bg-background text-zinc-100 ${dragging ? "cursor-col-resize select-none" : ""}`}>
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 bg-black px-4 sm:gap-6 sm:px-5">
        <div className="flex min-w-0 items-baseline gap-3">
          <span className="truncate text-sm font-black tracking-tight text-white">GOBBLER RACING</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.25em] text-orange sm:inline">
            Consumables Tracker
          </span>
        </div>
        <div className="hidden items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500 xl:flex">
          <span className={`h-1.5 w-1.5 rounded-full ${lastSession ? "bg-emerald-400" : "bg-zinc-600"}`} />
          {lastSession
            ? `Last session: ${lastSession.name} · ${formatDate(lastSession.date)} · ${formatNumber(lastSession.hours)} hrs`
            : "No sessions logged yet"}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setDialog("race_weekend")}
            className="rounded-lg bg-linear-to-r from-orange to-maroon-bright px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white shadow-lg shadow-maroon/30 transition hover:brightness-110 sm:px-4"
          >
            + Race<span className="hidden sm:inline"> weekend</span>
          </button>
          <button
            type="button"
            onClick={() => setDialog("test_day")}
            className="rounded-lg border border-orange/60 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-orange transition hover:bg-orange/10 sm:px-4"
          >
            + Test<span className="hidden sm:inline"> day</span>
          </button>
          <button
            type="button"
            onClick={() => setDialog("settings")}
            aria-label="Team settings"
            title="Team settings"
            className="rounded-lg border border-white/10 p-2 text-zinc-400 transition hover:border-orange/50 hover:text-orange"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
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
      <div className="flex min-h-0 flex-1">
        <PartList
          className="hidden w-[250px] shrink-0 lg:flex"
          parts={parts}
          selectedId={selectedId}
          onSelect={select}
          onAdd={onAdd}
        />

        <div ref={splitRef} className="relative flex min-h-0 min-w-0 flex-1">
          <main
            className="min-h-0 min-w-0 overflow-y-auto"
            style={{ width: carOpen ? `${(1 - split) * 100}%` : "100%" }}
          >
            <MobilePartPicker parts={parts} selectedId={selectedId} onSelect={select} onAdd={onAdd} />
            {selected ? (
              <PartDetail
                part={selected}
                history={history}
                onBack={() => select(null)}
                onAction={setDialog}
                onRemove={onRemove}
                removing={saving}
                onDeleteEntry={onDeleteEntry}
                deletingId={deletingId}
              />
            ) : (
              <Overview
                parts={parts}
                sessions={sessions}
                onSelect={select}
                onDeleteSession={onDeleteSession}
                deletingId={deletingId}
                onChecklist={() => setDialog("checklist")}
              />
            )}
          </main>

          {show3D && (
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize the car view"
              aria-valuemin={0}
              aria-valuemax={Math.round(SPLIT_MAX * 100)}
              aria-valuenow={Math.round(split * 100)}
              tabIndex={0}
              title={carOpen ? "Drag to resize the car view" : "Click or drag to show the car"}
              onPointerDown={startDrag}
              onKeyDown={onDividerKey}
              className="group absolute inset-y-0 z-30 flex w-4 -translate-x-1/2 cursor-col-resize items-center justify-center outline-none"
              style={{ left: carOpen ? `${(1 - split) * 100}%` : "calc(100% - 8px)" }}
            >
              <span className={`h-full w-px transition ${dragging ? "bg-orange" : "bg-white/10 group-hover:bg-orange/60 group-focus-visible:bg-orange"}`} />
              <span
                className={`absolute flex h-12 items-center justify-center rounded-full border transition ${
                  carOpen ? "w-2.5" : "w-6 -translate-x-1"
                } ${dragging ? "border-orange bg-orange/30" : "border-white/20 bg-zinc-900 group-hover:border-orange/70 group-focus-visible:border-orange"}`}
              >
                {!carOpen && <span className="font-mono text-[10px] text-zinc-300">‹</span>}
              </span>
            </div>
          )}

          {carOpen && (
            <aside className="car-stage relative min-h-0 min-w-0" style={{ width: `${split * 100}%` }}>
              <div className="pointer-events-none absolute left-5 top-4 z-10 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400">
                {placing ? "Click the spot where the part is" : selected ? `Showing: ${selected.name}` : "Drag to rotate · click a part"}
              </div>
              <Car3D
                highlight={highlight}
                describe={describePiece}
                wear={wear}
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
      </div>

      {/* Dialogs */}
      {dialog === "checklist" && (
        <WeekendChecklist parts={parts} onClose={() => setDialog(null)} onSaved={(s) => onSaved(s, "Checklist saved")} />
      )}
      {dialog === "settings" && (
        <TeamSettingsDialog
          onClose={() => setDialog(null)}
          onDone={(msg) => {
            setDialog(null);
            flash(msg);
          }}
        />
      )}
      {(dialog === "race_weekend" || dialog === "test_day") && (
        <LogSessionDialog
          key={dialog}
          type={dialog}
          onClose={() => setDialog(null)}
          onSaved={(s) => {
            onSaved(s, dialog === "race_weekend" ? "Race weekend logged" : "Test day logged");
            // Straight into the service checklist after a race weekend (skippable).
            if (dialog === "race_weekend") setDialog("checklist");
          }}
        />
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
          can3D={carOpen}
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
