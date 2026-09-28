"use client";

import { useActionState, useState } from "react";
import { createTeamAccount, login } from "@/app/actions/auth";

const labelClass =
  "mb-2 block font-mono text-[11px] uppercase tracking-[0.25em] text-zinc-400";
const inputClass =
  "w-full rounded-lg border border-white/10 bg-black/60 px-4 py-3 text-base text-white placeholder:text-zinc-600 outline-none transition focus:border-orange/70 focus:ring-2 focus:ring-orange/25";

function PasscodeInput(props: {
  id: string;
  name: string;
  autoComplete: string;
  autoFocus?: boolean;
  placeholder?: string;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? "text" : "password"}
        required
        maxLength={72}
        className={`${inputClass} pr-16`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide passcode" : "Show passcode"}
        className="absolute inset-y-0 right-0 px-4 font-mono text-[11px] uppercase tracking-widest text-zinc-500 transition hover:text-orange"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}

// Lets password managers save the passcode under a recognizable name.
function HiddenUsername() {
  return (
    <input
      type="text"
      name="username"
      autoComplete="username"
      value="Gobbler Racing team"
      readOnly
      hidden
    />
  );
}

function ErrorNote({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-maroon-bright/50 bg-maroon/20 px-4 py-3 text-sm text-red-200"
    >
      {message}
    </p>
  );
}

function SubmitButton({
  pending,
  children,
}: {
  pending: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-linear-to-r from-orange to-maroon-bright px-4 py-3 text-sm font-bold uppercase tracking-[0.25em] text-white shadow-lg shadow-maroon/40 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Verifying…" : children}
    </button>
  );
}

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-5">
      <HiddenUsername />
      <div>
        <label htmlFor="passcode" className={labelClass}>
          Team passcode
        </label>
        <PasscodeInput
          id="passcode"
          name="passcode"
          autoComplete="current-password"
          autoFocus
          placeholder="Enter passcode"
        />
      </div>
      <ErrorNote message={state?.error} />
      <SubmitButton pending={pending}>Enter</SubmitButton>
    </form>
  );
}

export function SetupForm() {
  const [state, action, pending] = useActionState(createTeamAccount, undefined);
  const [localError, setLocalError] = useState<string>();

  // Catch a mismatch in the browser so nothing gets cleared. The server checks again.
  function checkMatch(event: React.FormEvent<HTMLFormElement>) {
    const data = new FormData(event.currentTarget);
    if (data.get("passcode") !== data.get("confirmPasscode")) {
      event.preventDefault();
      setLocalError("Passcodes don't match.");
    } else {
      setLocalError(undefined);
    }
  }

  return (
    <form action={action} onSubmit={checkMatch} className="space-y-5">
      <HiddenUsername />
      <div>
        <h2 className="text-lg font-bold text-white">Create team account</h2>
        <p className="mt-1 text-sm text-zinc-400">
          First-time setup. You&apos;ll need the one-time setup code. Everyone on
          the team will log in with the passcode you pick here.
        </p>
      </div>
      <div>
        <label htmlFor="setupCode" className={labelClass}>
          Setup code
        </label>
        <input
          id="setupCode"
          name="setupCode"
          required
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          maxLength={40}
          defaultValue={state?.setupCode}
          className={`${inputClass} font-mono uppercase tracking-widest`}
        />
      </div>
      <div>
        <label htmlFor="passcode" className={labelClass}>
          New team passcode
        </label>
        <PasscodeInput
          id="passcode"
          name="passcode"
          autoComplete="new-password"
          placeholder="At least 10 characters"
          minLength={10}
        />
      </div>
      <div>
        <label htmlFor="confirmPasscode" className={labelClass}>
          Confirm passcode
        </label>
        <PasscodeInput
          id="confirmPasscode"
          name="confirmPasscode"
          autoComplete="new-password"
          placeholder="Type it again"
          minLength={10}
        />
      </div>
      <ErrorNote message={localError ?? state?.error} />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}
