"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { getGuide, saveGuide, type Guide } from "@/app/actions/tracker";
import { formatDate, type Part } from "@/lib/parts";
import { fieldClass, labelClass, useLoggedBy } from "./dialogs";

// Tiny renderer for the guide text: "## heading", "1. step", "- bullet",
// "| a | b |" table rows, **bold**. Enough for how-tos, nothing more.
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((t, i) =>
    t.startsWith("**") && t.endsWith("**") ? <strong key={i} className="text-zinc-100">{t.slice(2, -2)}</strong> : <Fragment key={i}>{t}</Fragment>,
  );
}
function Markdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; ) {
    const line = lines[i].trim();
    const take = (re: RegExp) => { const out: string[] = []; while (i < lines.length && re.test(lines[i].trim())) out.push(lines[i++].trim()); return out; };
    if (!line) { i++; continue; }
    if (line.startsWith("## ")) { blocks.push(<h3 key={i} className="mt-5 text-xs font-bold uppercase tracking-[0.15em] text-orange first:mt-0">{line.slice(3)}</h3>); i++; continue; }
    if (/^\d+\.\s/.test(line)) { const items = take(/^\d+\.\s/); blocks.push(<ol key={i} className="mt-2 list-decimal space-y-1.5 pl-5">{items.map((t, k) => <li key={k}>{inline(t.replace(/^\d+\.\s/, ""))}</li>)}</ol>); continue; }
    if (line.startsWith("- ")) { const items = take(/^- /); blocks.push(<ul key={i} className="mt-2 list-disc space-y-1 pl-5">{items.map((t, k) => <li key={k}>{inline(t.slice(2))}</li>)}</ul>); continue; }
    if (line.startsWith("|")) {
      const rows = take(/^\|/).filter((r) => !/^\|[\s:|-]+\|$/.test(r)).map((r) => r.slice(1, -1).split("|").map((c) => c.trim()));
      blocks.push(
        <table key={i} className="mt-2 w-full text-left text-sm">
          <tbody>{rows.map((r, k) => <tr key={k} className={k === 0 ? "text-xs uppercase tracking-wider text-zinc-500" : "border-t border-white/5"}>{r.map((c, j) => <td key={j} className="py-1.5 pr-3">{inline(c)}</td>)}</tr>)}</tbody>
        </table>,
      );
      continue;
    }
    blocks.push(<p key={i} className="mt-2">{inline(line)}</p>);
    i++;
  }
  return <div className="text-sm leading-relaxed text-zinc-300">{blocks}</div>;
}

// "How to replace" on a part's page: draft guides say so until the lead tech
// marks them reviewed. Anyone logged in can edit (their name is recorded).
export function GuideSection({ part }: { part: Part }) {
  const [guide, setGuide] = useState<Guide | null | "loading">("loading");
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [loggedBy, setLoggedBy] = useLoggedBy();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let live = true;
    getGuide(part.id).then((res) => live && setGuide(res.ok ? res.guide : null));
    return () => { live = false; };
  }, [part.id]);

  if (guide === "loading") return null;

  const edit = () => { setDraft(guide?.body ?? "## What you need\n- \n\n## Steps\n1. \n\n## Torque specs\n| Fastener | Torque |\n| --- | --- |\n|  |  |\n\n## Before you're done\n- "); setReviewed(false); setEditing(true); setError(null); };
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveGuide({ partId: part.id, body: draft, loggedBy, reviewed });
      if (!res.ok) return setError(res.error);
      const fresh = await getGuide(part.id);
      setGuide(fresh.ok ? fresh.guide : null);
      setEditing(false);
    });
  };

  return (
    <details className="mt-8 rounded-xl border border-white/10 bg-white/[0.02]" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-5 py-4">
        <span className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300">{part.tracking === "condition" ? "How to inspect" : "How to replace"}</span>
        {guide ? (
          guide.reviewed ? (
            <span className="rounded-full border border-emerald-400/40 px-2.5 py-0.5 text-[11px] text-emerald-300">Reviewed by {guide.reviewedBy}</span>
          ) : (
            <span className="rounded-full border border-orange-400/50 px-2.5 py-0.5 text-[11px] text-orange-300">Draft: needs lead tech review</span>
          )
        ) : (
          <span className="text-xs text-zinc-500">No guide yet</span>
        )}
      </summary>
      <div className="border-t border-white/5 px-5 py-4">
        {editing ? (
          <form onSubmit={save}>
            <p className="mb-2 text-xs text-zinc-500">
              <code>## Heading</code>, <code>1. step</code>, <code>- item</code>, <code>| table | row |</code>, <code>**bold**</code>
            </p>
            <textarea aria-label="Guide" rows={18} maxLength={20000} value={draft} onChange={(e) => setDraft(e.target.value)} className={`${fieldClass} font-mono text-xs`} />
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="g-by" className={labelClass}>Logged by</label>
                <input id="g-by" required maxLength={60} value={loggedBy} onChange={(e) => setLoggedBy(e.target.value)} placeholder="Your name" className={fieldClass} />
              </div>
              <label className="flex items-center gap-2 pb-2.5 text-sm text-zinc-300">
                <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="h-4 w-4 accent-orange" />
                Reviewed and correct (lead tech)
              </label>
              <div className="ml-auto flex gap-3">
                <button type="button" onClick={() => setEditing(false)} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white">Cancel</button>
                <button type="submit" disabled={pending} className="rounded-lg bg-linear-to-r from-orange to-maroon-bright px-5 py-2 text-sm font-bold uppercase tracking-[0.15em] text-white disabled:opacity-50">
                  {pending ? "Saving…" : "Save guide"}
                </button>
              </div>
            </div>
            {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          </form>
        ) : (
          <>
            {guide ? <Markdown text={guide.body} /> : <p className="text-sm text-zinc-500">Nobody has written steps for this part yet.</p>}
            <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
              {guide?.updatedBy && <span>Last edited by {guide.updatedBy}, {formatDate(guide.updatedAt)}</span>}
              <button type="button" onClick={edit} className="ml-auto rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-200 transition hover:border-orange/60 hover:text-orange">
                {guide ? "Edit guide" : "Write a guide"}
              </button>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
