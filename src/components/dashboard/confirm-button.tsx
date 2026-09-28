"use client";

import { useEffect, useRef, useState } from "react";

// A button that needs several clicks to fire. Each click advances one step;
// it resets on its own after a few seconds without a click, so a stray click
// can never delete anything.
export function ConfirmButton({
  steps,
  onConfirm,
  busy = false,
  resetAfterMs = 4000,
  className = "",
}: {
  /** Label for each click, e.g. ["Delete", "Confirm delete"]. The last click fires. */
  steps: string[];
  onConfirm: () => void;
  busy?: boolean;
  resetAfterMs?: number;
  className?: string;
}) {
  const [step, setStep] = useState(0);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const click = () => {
    window.clearTimeout(timer.current);
    if (step >= steps.length - 1) {
      setStep(0);
      onConfirm();
      return;
    }
    setStep(step + 1);
    timer.current = window.setTimeout(() => setStep(0), resetAfterMs);
  };

  const armed = step > 0;
  const last = step === steps.length - 1;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={click}
      aria-live="polite"
      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs transition disabled:opacity-50 ${
        last
          ? "border-red-500 bg-red-500/20 font-semibold text-red-100"
          : armed
            ? "border-red-500/60 bg-red-500/10 text-red-200"
            : "border-white/10 text-zinc-500 hover:border-red-500/40 hover:text-red-300"
      } ${className}`}
    >
      {busy ? "Deleting…" : steps[step]}
    </button>
  );
}
