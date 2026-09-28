"use client";

import { useState, useTransition } from "react";
import { changeAdminCode, changePasscode } from "@/app/actions/auth";
import { Modal, fieldClass, labelClass } from "./dialogs";

type Mode = "passcode" | "admin";

// Team settings: change the shared passcode or the admin code. Both need the
// admin code, so anyone logged in can open this but only the admin can save.
export function TeamSettingsDialog({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [mode, setMode] = useState<Mode>("passcode");
  const [adminCode, setAdminCode] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const switchMode = (m: Mode) => {
    setMode(m);
    setNext("");
    setConfirm("");
    setError(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res =
        mode === "passcode"
          ? await changePasscode({ adminCode, newPasscode: next, confirm })
          : await changeAdminCode({ currentCode: adminCode, newCode: next, confirm });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onDone(mode === "passcode" ? "Passcode changed. Every other device is logged out." : "Admin code changed.");
    });
  };

  const noun = mode === "passcode" ? "team passcode" : "admin code";

  return (
    <Modal
      eyebrow="Team settings"
      title={mode === "passcode" ? "Change team passcode" : "Change admin code"}
      subtitle={
        mode === "passcode"
          ? "Needs the admin code. Everyone else gets logged out and has to use the new passcode."
          : "The admin code is only for changing the passcode. Keep it separate from the team passcode."
      }
      onClose={onClose}
    >
      <div role="tablist" aria-label="Setting to change" className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-white/10 bg-black/40 p-1">
        {(["passcode", "admin"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => switchMode(m)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              mode === m ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m === "passcode" ? "Team passcode" : "Admin code"}
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        <div className="space-y-4">
          <div>
            <label htmlFor="ts-admin" className={labelClass}>{mode === "passcode" ? "Admin code" : "Current admin code"}</label>
            <input
              id="ts-admin"
              type="password"
              autoComplete="off"
              required
              maxLength={200}
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              className={fieldClass}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="ts-new" className={labelClass}>New {noun}</label>
            <input
              id="ts-new"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={72}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="At least 10 characters"
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="ts-confirm" className={labelClass}>New {noun} again</label>
            <input
              id="ts-confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
              maxLength={72}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldClass}
            />
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-linear-to-r from-orange to-maroon-bright px-5 py-2 text-sm font-bold uppercase tracking-[0.15em] text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : mode === "passcode" ? "Change passcode" : "Change admin code"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
