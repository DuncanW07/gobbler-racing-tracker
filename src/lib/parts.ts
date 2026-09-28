// Shared types and display rules for tracked parts.

export type PartGroup = "consumable" | "wear" | "custom";
export type Tracking = "hours" | "weekends" | "measured" | "condition";
export type Corner = "FL" | "FR" | "RL" | "RR";

export type Part = {
  id: string;
  slug: string | null;
  name: string;
  group: PartGroup;
  tracking: Tracking;
  /** Keys of pieces on the 3D car that light up for this part. */
  model: string[];
  /** Highlight color on the car. */
  color: string;
  /** For added parts: a spot picked on the car (car coordinates, meters). */
  marker: [number, number, number] | null;
  corner: Corner | null;
  /** hours/weekends: change after this much. measured: minimum allowed. */
  limit: number | null;
  /** measured: value when new (e.g. new pad thickness). */
  newValue: number | null;
  /** hours/weekends used since the last change. */
  used: number | null;
  /** measured: latest measurement. */
  current: number | null;
  lastChanged: string | null;
  lastEntry: string | null;
};

export type SessionType = "race_weekend" | "test_day";

export type Session = {
  id: string;
  name: string;
  date: string;
  type: SessionType;
  hours: number | null;
  notes: string | null;
};

export type TrackerState = { parts: Part[]; sessions: Session[] };

export type EntryAction = "checked" | "changed" | "issue";

export type HistoryEntry = {
  id: string;
  action: EntryAction | "topped_off";
  measurement: number | null;
  cost: number | null;
  loggedBy: string | null;
  notes: string | null;
  at: string;
};

// Neon highlight colors: they stand out against the dark and maroon car view.
export const NEON = {
  yellow: "#ffe14d",
  blue: "#4d8dff",
  green: "#3dff8a",
  pink: "#ff4fd8",
  cyan: "#22e5ff",
} as const;

export const GROUP_LABELS: Record<PartGroup, string> = {
  consumable: "Consumables",
  wear: "Wear parts",
  custom: "Added parts",
};

export const TRACKING_LABELS: Record<Tracking, string> = {
  hours: "Engine hours",
  weekends: "Race weekends",
  measured: "Measured wear",
  condition: "Condition checks",
};

export const UNITS: Record<Tracking, string> = {
  hours: "hrs",
  weekends: "weekends",
  measured: "mm",
  condition: "",
};

export const ACTION_LABELS: Record<HistoryEntry["action"], string> = {
  checked: "Check",
  changed: "Change",
  issue: "Issue",
  topped_off: "Top off",
};

export type PartStatus = "unset" | "ok" | "soon" | "due";

// How much of the part's life is used, 0..1+ (null if it can't be worked out yet).
export function lifeUsed(part: Part): number | null {
  if (part.tracking === "hours" || part.tracking === "weekends") {
    if (part.limit == null || part.used == null) return null;
    return part.used / part.limit;
  }
  if (part.tracking === "measured") {
    if (part.limit == null || part.current == null || part.newValue == null) return null;
    const range = part.newValue - part.limit;
    if (range <= 0) return null;
    return (part.newValue - part.current) / range;
  }
  return null;
}

export function partStatus(part: Part): PartStatus {
  if (part.tracking === "condition") return part.lastEntry ? "ok" : "unset";
  if (part.tracking === "measured") {
    if (part.limit == null || part.current == null) return "unset";
    if (part.current <= part.limit) return "due";
    const soonAt = part.newValue != null && part.newValue > part.limit
      ? part.limit + 0.2 * (part.newValue - part.limit)
      : part.limit * 1.2;
    return part.current <= soonAt ? "soon" : "ok";
  }
  const used = lifeUsed(part);
  if (used == null) return "unset";
  if (used >= 1) return "due";
  if (used >= 0.8) return "soon";
  return "ok";
}

export const STATUS_STYLES: Record<PartStatus, { dot: string; label: string }> = {
  unset: { dot: "bg-zinc-600", label: "Not set up" },
  ok: { dot: "bg-emerald-400", label: "Good" },
  soon: { dot: "bg-amber-400", label: "Due soon" },
  due: { dot: "bg-red-500", label: "Change now" },
};

export function formatNumber(n: number | null | undefined, digits = 1): string {
  if (n == null) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
