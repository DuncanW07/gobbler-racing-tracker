// Parts the tracker follows. Preview data only: values are blank until the
// team fills in real intervals and history.

export type PartGroup = "consumable" | "wear" | "custom";
export type Tracking = "hours" | "weekends" | "measured" | "condition";
export type Corner = "FL" | "FR" | "RL" | "RR";

export type Part = {
  id: string;
  name: string;
  group: PartGroup;
  tracking: Tracking;
  /** Keys of pieces on the 3D car that light up for this part. */
  model: string[];
  /** Highlight color on the car. */
  color: string;
  /** For custom parts: a spot picked on the car (car coordinates, meters). */
  marker?: [number, number, number];
  corner?: Corner;
  /** Life limit and current usage. Blank until the team sets them. */
  limit?: number;
  used?: number;
};

const corners = (prefix: string, which: Corner[] = ["FL", "FR", "RL", "RR"]) =>
  which.map((c) => `${prefix}-${c}`);

export const STARTING_PARTS: Part[] = [
  // Consumables
  { id: "engine-oil", name: "Engine oil", group: "consumable", tracking: "hours", model: ["oil-pan", "engine-block"], color: "#f5a524" },
  { id: "trans-oil", name: "Transmission oil", group: "consumable", tracking: "hours", model: ["transmission"], color: "#38bdf8" },
  { id: "diff-oil", name: "Differential oil", group: "consumable", tracking: "hours", model: ["differential"], color: "#4ade80" },
  { id: "pads-front", name: "Brake pads (front)", group: "consumable", tracking: "measured", model: corners("pad", ["FL", "FR"]), color: "#fb7185" },
  { id: "pads-rear", name: "Brake pads (rear)", group: "consumable", tracking: "measured", model: corners("pad", ["RL", "RR"]), color: "#fb7185" },

  // Wear parts
  { id: "rotors", name: "Brake rotors", group: "wear", tracking: "measured", model: corners("rotor"), color: "#f97316" },
  { id: "clutch", name: "Clutch", group: "wear", tracking: "hours", model: ["clutch"], color: "#e879f9" },
  { id: "engine", name: "Engine", group: "wear", tracking: "hours", model: ["engine-block", "engine-head"], color: "#f97316" },
  { id: "transmission", name: "Transmission", group: "wear", tracking: "hours", model: ["transmission"], color: "#38bdf8" },
  { id: "differential", name: "Differential", group: "wear", tracking: "hours", model: ["differential"], color: "#4ade80" },
  { id: "dampers", name: "Dampers", group: "wear", tracking: "hours", model: corners("damper"), color: "#a78bfa" },
  { id: "bearings", name: "Wheel bearings", group: "wear", tracking: "hours", model: corners("hub"), color: "#facc15" },
  { id: "control-arms", name: "Control arms / bushings", group: "wear", tracking: "condition", model: [...corners("arm-upper"), ...corners("arm-lower")], color: "#22d3ee" },
  { id: "axles", name: "Axles / CV joints", group: "wear", tracking: "hours", model: ["axle-L", "axle-R"], color: "#fb923c" },
];

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

export type PartStatus = "unset" | "ok" | "soon" | "due";

export function partStatus(part: Part): PartStatus {
  if (part.limit == null || part.used == null) return "unset";
  const ratio = part.used / part.limit;
  if (ratio >= 1) return "due";
  if (ratio >= 0.8) return "soon";
  return "ok";
}

export const STATUS_STYLES: Record<PartStatus, { dot: string; label: string }> = {
  unset: { dot: "bg-zinc-600", label: "Not set up" },
  ok: { dot: "bg-emerald-400", label: "Good" },
  soon: { dot: "bg-amber-400", label: "Due soon" },
  due: { dot: "bg-red-500", label: "Change now" },
};
