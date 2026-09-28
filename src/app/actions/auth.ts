"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  getClientKey,
} from "@/lib/auth";

// setupCode is echoed back on errors so the form doesn't make you retype it.
// Passcodes are never echoed back.
export type AuthFormState = { error?: string; setupCode?: string } | undefined;

type AuthResult = { ok: boolean; token?: string; error?: string };

const ERROR_MESSAGES: Record<string, string> = {
  bad_passcode: "Incorrect passcode.",
  bad_setup_code: "That setup code isn't valid.",
  weak_passcode: "Passcode must be 10 to 72 characters.",
  rate_limited: "Too many attempts. Try again in 15 minutes.",
  already_setup: "The team account already exists. Log in instead.",
  needs_setup: "The team account hasn't been created yet.",
};

function readField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function startSession(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function login(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const passcode = readField(formData, "passcode");
  if (!passcode || passcode.length > 200) {
    return { error: "Enter the team passcode." };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("team_login", {
    p_passcode: passcode,
    p_client_key: await getClientKey(),
  });
  if (error) return { error: "Couldn't reach the server. Try again." };

  const result = data as AuthResult;
  if (!result.ok || !result.token) {
    return { error: ERROR_MESSAGES[result.error ?? ""] ?? "Login failed." };
  }

  await startSession(result.token);
  redirect("/dashboard");
}

export async function createTeamAccount(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const setupCode = readField(formData, "setupCode").trim().toUpperCase();
  const passcode = readField(formData, "passcode");
  const confirm = readField(formData, "confirmPasscode");

  if (!setupCode) return { error: "Enter the setup code." };
  if (passcode.length < 10 || passcode.length > 72) {
    return { error: ERROR_MESSAGES.weak_passcode, setupCode };
  }
  if (passcode !== confirm) {
    return { error: "Passcodes don't match.", setupCode };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("team_setup", {
    p_setup_code: setupCode,
    p_passcode: passcode,
    p_client_key: await getClientKey(),
  });
  if (error) return { error: "Couldn't reach the server. Try again.", setupCode };

  const result = data as AuthResult;
  if (!result.ok || !result.token) {
    return {
      error: ERROR_MESSAGES[result.error ?? ""] ?? "Setup failed.",
      setupCode,
    };
  }

  await startSession(result.token);
  redirect("/dashboard");
}

// ---------------------------------------------------------------- team settings
// Both need a logged-in session plus the admin code (checked in the database,
// with the same 5-tries-per-15-minutes limit as the login).

export type SettingsResult = { ok: true } | { ok: false; error: string };

const SETTINGS_ERRORS: Record<string, string> = {
  bad_admin_code: "Incorrect admin code.",
  no_admin_code: "No admin code has been set up yet.",
  weak_passcode: "New passcode must be 10 to 72 characters.",
  weak_admin_code: "New admin code must be 10 to 72 characters.",
  same_as_admin: "The passcode can't be the same as the admin code.",
  same_as_passcode: "The admin code can't be the same as the team passcode.",
  rate_limited: "Too many attempts. Try again in 15 minutes.",
};

function settingsError(message: string | undefined): string {
  if (message?.includes("not_authenticated")) return "Your login expired. Refresh the page and log in again.";
  return SETTINGS_ERRORS[message ?? ""] ?? "Couldn't save. Try again.";
}

function checkNew(value: unknown, confirm: unknown, label: string): string | null {
  if (typeof value !== "string" || value.length < 10 || value.length > 72) {
    return `New ${label} must be 10 to 72 characters.`;
  }
  if (value !== confirm) return `The new ${label}s don't match.`;
  return null;
}

export async function changePasscode(input: {
  adminCode: string;
  newPasscode: string;
  confirm: string;
}): Promise<SettingsResult> {
  const bad = checkNew(input.newPasscode, input.confirm, "passcode");
  if (bad) return { ok: false, error: bad };
  if (typeof input.adminCode !== "string" || !input.adminCode || input.adminCode.length > 200) {
    return { ok: false, error: "Enter the admin code." };
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, error: settingsError("not_authenticated") };

  const { data, error } = await createServerClient().rpc("team_change_passcode", {
    p_token: token,
    p_admin_code: input.adminCode,
    p_new_passcode: input.newPasscode,
    p_client_key: await getClientKey(),
  });
  if (error) return { ok: false, error: settingsError(error.message) };
  const result = data as AuthResult;
  if (!result.ok || !result.token) return { ok: false, error: settingsError(result.error) };

  // Every other device was logged out; this one gets a fresh session.
  await startSession(result.token);
  return { ok: true };
}

export async function changeAdminCode(input: {
  currentCode: string;
  newCode: string;
  confirm: string;
}): Promise<SettingsResult> {
  const bad = checkNew(input.newCode, input.confirm, "admin code");
  if (bad) return { ok: false, error: bad };
  if (typeof input.currentCode !== "string" || !input.currentCode || input.currentCode.length > 200) {
    return { ok: false, error: "Enter the current admin code." };
  }
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { ok: false, error: settingsError("not_authenticated") };

  const { data, error } = await createServerClient().rpc("team_change_admin_code", {
    p_token: token,
    p_current: input.currentCode,
    p_new: input.newCode,
    p_client_key: await getClientKey(),
  });
  if (error) return { ok: false, error: settingsError(error.message) };
  const result = data as AuthResult;
  if (!result.ok) return { ok: false, error: settingsError(result.error) };
  return { ok: true };
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const supabase = createServerClient();
    await supabase.rpc("team_logout", { p_token: token });
  }
  cookieStore.delete(SESSION_COOKIE);
  redirect("/");
}
