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
