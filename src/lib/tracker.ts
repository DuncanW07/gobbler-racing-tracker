import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { createServerClient } from "@/lib/supabase/server";
import type { Part, TrackerState } from "@/lib/parts";

// Every tracker read/write goes through database functions that check the
// login session token first. The token only ever lives in the httpOnly cookie
// and here on the server.
export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

type RawPart = Omit<Part, "marker"> & { marker: number[] | null };

export function normalizeState(raw: { parts: RawPart[]; sessions: TrackerState["sessions"] }): TrackerState {
  return {
    parts: raw.parts.map((p) => ({
      ...p,
      marker: p.marker && p.marker.length === 3 ? [p.marker[0], p.marker[1], p.marker[2]] : null,
    })),
    sessions: raw.sessions,
  };
}

export async function loadTrackerState(): Promise<TrackerState> {
  const token = await sessionToken();
  if (!token) throw new Error("not_authenticated");
  const { data, error } = await createServerClient().rpc("tracker_state", { p_token: token });
  if (error) throw new Error(error.message);
  return normalizeState(data);
}
