import "server-only";
import { createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

export const SESSION_COOKIE = "gr_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type TeamStatus = "ready" | "needs_setup";

// Identifies a device for rate limiting without storing its raw IP address.
export async function getClientKey(): Promise<string> {
  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}

export async function getTeamStatus(): Promise<TeamStatus> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("team_status");
  if (error) throw new Error("Could not reach the database.");
  return data === "ready" ? "ready" : "needs_setup";
}

export async function hasValidSession(): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("team_validate_session", {
    p_token: token,
  });
  return !error && data === true;
}

// Call at the top of any protected page. Sends signed-out visitors to the login page.
export async function requireSession(): Promise<void> {
  if (!(await hasValidSession())) redirect("/");
}
