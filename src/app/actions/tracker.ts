"use server";

import { createServerClient } from "@/lib/supabase/server";
import { normalizeState, sessionToken } from "@/lib/tracker";
import type {
  CheckResult,
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
const RESULTS: CheckResult[] = ["good", "watch", "replace"];

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
  if (message.includes("nothing_selected")) return "Tick at least one item.";
  if (message.includes("hours_required")) return "Enter the hours on track.";
  if (message.includes("entry_not_found") || message.includes("session_not_found")) {
    return "Already deleted. Refresh the page.";
  }
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
      p_hours: (() => {
        const h = num(input.hours, 0.1, 100, "Hours on track");
        if (h == null) throw new InputError("Enter the hours on track.");
        return h;
      })(),
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
  result?: CheckResult | null;
}): Promise<TrackerResult> {
  return run(async (token) => {
    const loggedBy = text(input.loggedBy, 60);
    if (!loggedBy) throw new InputError("Add your name in Logged by.");
    return createServerClient().rpc("tracker_log_entry", {
      p_result: input.result ? pick(input.result, RESULTS) : null,
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
  /** Optional: how much is already on the part right now (hours or weekends). */
  startValue?: string | number;
  /** Inspect every N weekends (blank = none). */
  inspectEvery?: string | number;
  dueAfterRace?: boolean;
}): Promise<TrackerResult> {
  return run(async (token) => {
    const partId = uuid(input.partId);
    const limit = num(input.limit, 0.001, 99999, "Limit");
    const inspectEvery = num(input.inspectEvery, 1, 50, "Inspect every");
    if (inspectEvery != null && !Number.isInteger(inspectEvery)) throw new InputError("Inspect every must be a whole number.");
    const newValue = num(input.newValue, 0.001, 99999, "New value");
    const startValue = num(input.startValue, 0, 99999, "Amount already on it");
    if (newValue != null && limit != null && newValue <= limit) {
      throw new InputError("The new value has to be bigger than the minimum.");
    }
    const db = createServerClient();
    const res = await db.rpc("tracker_set_limit", {
      p_token: token,
      p_component: partId,
      p_limit: limit,
      p_new_value: newValue,
    });
    if (res.error) return res;
    const sched = await db.rpc("tracker_set_schedule", {
      p_token: token,
      p_component: partId,
      p_inspect_every: inspectEvery,
      p_count_test_days: null,
      p_due_after_race: typeof input.dueAfterRace === "boolean" ? input.dueAfterRace : null,
    });
    if (sched.error || startValue == null) return sched;
    return db.rpc("tracker_set_start", { p_token: token, p_component: partId, p_value: startValue });
  });
}

// After a race weekend: every replaced part and every inspection in one save.
export async function afterWeekend(input: {
  loggedBy: string;
  changed: string[];
  checks: { id: string; result: CheckResult; notes?: string }[];
}): Promise<TrackerResult> {
  return run(async (token) => {
    const loggedBy = text(input.loggedBy, 60);
    if (!loggedBy) throw new InputError("Add your name in Logged by.");
    if (!Array.isArray(input.changed) || !Array.isArray(input.checks) || input.changed.length + input.checks.length > 100) {
      throw new InputError("Invalid input.");
    }
    if (!input.changed.length && !input.checks.length) throw new InputError("Tick at least one item.");
    return createServerClient().rpc("tracker_after_weekend", {
      p_token: token,
      p_logged_by: loggedBy,
      p_changed: input.changed.map(uuid),
      p_checks: input.checks.map((c) => ({ id: uuid(c.id), result: pick(c.result, RESULTS), notes: text(c.notes, 1000) })),
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

export async function deleteEntry(entryId: string): Promise<TrackerResult> {
  return run(async (token) =>
    createServerClient().rpc("tracker_delete_entry", { p_token: token, p_entry: uuid(entryId) }),
  );
}

export async function deleteSession(sessionId: string): Promise<TrackerResult> {
  return run(async (token) =>
    createServerClient().rpc("tracker_delete_session", { p_token: token, p_session: uuid(sessionId) }),
  );
}
