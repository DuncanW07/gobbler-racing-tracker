"use client";

import { useState, useTransition } from "react";
import { addNote, deleteNote } from "@/app/actions/tracker";
import { formatDate, type CarNote, type TrackerState } from "@/lib/parts";
import { ConfirmButton } from "./confirm-button";
import { fieldClass, useLoggedBy } from "./dialogs";

// Notes about the whole car (not one part): handling, smells, setup changes...
export function CarNotes({ notes, onSaved }: { notes: CarNote[]; onSaved: (s: TrackerState, msg: string) => void }) {
  const [body, setBody] = useState("");
  const [loggedBy, setLoggedBy] = useLoggedBy();
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await addNote({ body, loggedBy });
      if (!res.ok) return setError(res.error);
      setBody("");
      onSaved(res.state, "Note added");
    });
  };
  const remove = async (id: string) => {
    setDeleting(id);
    const res = await deleteNote(id);
    setDeleting(null);
    if (res.ok) onSaved(res.state, "Note deleted");
    else setError(res.error);
  };

  return (
    <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <h2 className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">Car notes</h2>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="New note"
          required
          maxLength={2000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Anything about the whole car: handling, a noise, a setup change"
          className={`${fieldClass} flex-1`}
        />
        <input aria-label="Logged by" required maxLength={60} value={loggedBy} onChange={(e) => setLoggedBy(e.target.value)} placeholder="Your name" className={`${fieldClass} sm:w-36`} />
        <button type="submit" disabled={pending} className="rounded-lg border border-orange/60 px-4 py-2 text-sm font-semibold text-orange transition hover:bg-orange/10 disabled:opacity-50">
          {pending ? "Adding…" : "Add"}
        </button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm text-red-300">{error}</p>}
      {notes.length > 0 && (
        <ul className="mt-3 divide-y divide-white/5">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap break-words text-zinc-200">{n.body}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{formatDate(n.at)} · {n.loggedBy}</p>
              </div>
              <ConfirmButton steps={["Delete", "Confirm delete"]} busy={deleting === n.id} onConfirm={() => remove(n.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
