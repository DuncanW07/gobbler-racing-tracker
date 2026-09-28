"use server";

import { createServerClient } from "@/lib/supabase/server";
import { normalizeState, sessionToken } from "@/lib/tracker";
import type {
  Corner,
  EntryAction,
  HistoryEntry,
  SessionType,
  Tracking,
  TrackerState,
} from "@/lib/parts";

export type TrackerResult =
  | { ok: true; state: TrackerState; id?: string }
  | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOR = /^#[0-9a-fA-F]{6}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TRACKING: Tracking[] = ["hours", "weekends", "measured", "condition"];
const CORNERS: Corner[] = ["FL", "FR", "RL", "RR"];
const ACTIONS: EntryAction[] = ["checked", "changed", "issue"];
const SESSION_TYPES: SessionType[] = ["race_weekend", "test_day"];

class InputError extends Error {}

function text(value: unknown, max: number, required = false): string | null {
  if (value == null || value === "") {
    if (required) throw new InputError("Please fill in the required fields.");
    return null;
  }
  if (typeof value !== "string") throw new InputError("Invalid input.");
  const trimmed = value.trim();
  if (required && !trimmed) throw new InputError("Please fill in the required fields.");
  if (trimmed.length > max) throw new InputError(`Keep it under ${max} characters.`);
  return trimmed || null;
}

function num(value: unknown, min: number, max: number, label: string): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new InputError(`${label} must be between ${min} and ${max}.`);
  }
  return Math.round(n * 1000) / 1000;
}

function pick<T extends string>(value: unknown, allowed: T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new InputError("Invalid input.");
  return value as T;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new InputError("Invalid part.");
  return value;
}

function friendly(message: string): string {
  if (message.includes("not_authenticated")) return "Your login expired. Refresh the page and log in again.";
  if (message.includes("cannot_remove")) return "Only parts your team added can be removed.";
  if (message.includes("part_not_found")) return "That part no longer exists. Refresh the page.";
  if (message.includes("name_required")) return "Add your name in Logged by.";
  return "Couldn't save. Check your connection and try again.";
}

// Runs a write, then returns the fresh dashboard state in the same round trip.
async function run(
  write: ((token: string) => Promise<{ error: { message: string } | null; data?: unknown }>) | null,
): Promise<TrackerResult> {
  try {
    const token = await sessionToken();
    if (!token) return { ok: false, error: friendly("not_authenticated") };
    let id: string | undefined;
    if (write) {
      const res = await write(token);
      if (res.error) return { ok: false, error: friendly(res.error.message) };
      if (typeof res.data === "string") id = res.data;
    }
    const { data, error } = await createServerClient().rpc("tracker_state", { p_token: token });
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, state: normalizeState(data), id };
  } catch (e) {
    if (e instanceof InputError) return { ok: false, error: e.message };
    return { ok: false, error: friendly("") };
  }
}

export async function refreshState(): Promise<TrackerResult> {
  return run(null);
}

export async function getHistory(
  partId: string,
): Promise<{ ok: true; history: HistoryEntry[] } | { ok: false; error: string }> {
  try {
    const token = await sessionToken();
    if (!token) return { ok: false, error: friendly("not_authenticated") };
    const { data, error } = await createServerClient().rpc("tracker_history", {
      p_token: token,
      p_component: uuid(partId),
    });
    if (error) return { ok: false, error: friendly(error.message) };
    return { ok: true, history: data as HistoryEntry[] };
  } catch (e) {
    return { ok: false, error: e instanceof InputError ? e.message : friendly("") };
  }
}

export async function logSession(input: {
  name: string;
  date: string;
  type: SessionType;
  hours: string | number;
  notes?: string;
}): Promise<TrackerResult> {
  return run(async (token) => {
    const date = text(input.date, 10, true)!;
    if (!DATE.test(date)) throw new InputError("Pick a date.");
    return createServerClient().rpc("tracker_log_session", {
      p_token: token,
      p_name: text(input.name, 80, true),
      p_date: date,
      p_type: pick(input.type, SESSION_TYPES),
      p_hours: num(input.hours, 0, 100, "Time on track"),
      p_notes: text(input.notes, 1000),
    });
  });
}

export async function logEntry(input: {
  partId: string;
  action: EntryAction;
  measurement?: string | number;
  cost?: string | number;
  loggedBy?: string;
  notes?: string;
}): Promise<TrackerResult> {
  return run(async (token) => {
    const loggedBy = text(input.loggedBy, 60);
    if (!loggedBy) throw new InputError("Add your name in Logged by.");
    return createServerClient().rpc("tracker_log_entry", {
      p_token: token,
      p_component: uuid(input.partId),
      p_action: pick(input.action, ACTIONS),
      p_measurement: num(input.measurement, 0, 99999, "Measurement"),
      p_cost: num(input.cost, 0, 999999, "Cost"),
      p_logged_by: loggedBy,
      p_notes: text(input.notes, 1000),
    });
  });
}

export async function setLimit(input: {
  partId: string;
  limit: string | number;
  newValue?: string | number;
}): Promise<TrackerResult> {
  return run(async (token) => {
    const limit = num(input.limit, 0.001, 99999, "Limit");
    const newValue = num(input.newValue, 0.001, 99999, "New value");
    if (newValue != null && limit != null && newValue <= limit) {
      throw new InputError("The new value has to be bigger than the minimum.");
    }
    return createServerClient().rpc("tracker_set_limit", {
      p_token: token,
      p_component: uuid(input.partId),
      p_limit: limit,
      p_new_value: newValue,
    });
  });
}

export async function addPart(input: {
  name: string;
  tracking: Tracking;
  corner?: Corner | null;
  color: string;
  marker?: [number, number, number] | null;
}): Promise<TrackerResult> {
  return run(async (token) => {
    if (typeof input.color !== "string" || !COLOR.test(input.color)) throw new InputError("Invalid color.");
    let marker: number[] | null = null;
    if (input.marker != null) {
      if (!Array.isArray(input.marker) || input.marker.length !== 3) throw new InputError("Invalid location.");
      marker = input.marker.map((v) => num(v, -10, 10, "Location")!);
    }
    return createServerClient().rpc("tracker_add_part", {
      p_token: token,
      p_name: text(input.name, 60, true),
      p_tracking: pick(input.tracking, TRACKING),
      p_corner: input.corner ? pick(input.corner, CORNERS) : null,
      p_color: input.color,
      p_marker: marker,
    });
  });
}

export async function removePart(partId: string): Promise<TrackerResult> {
  return run(async (token) =>
    createServerClient().rpc("tracker_remove_part", { p_token: token, p_component: uuid(partId) }),
  );
}
