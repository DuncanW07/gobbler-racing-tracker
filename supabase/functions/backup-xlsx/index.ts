// Gobbler Racing tracker: live Excel backup. Runs on Supabase, not on the website.
//
// POST (from the database after every change): rebuilds the workbook from the
//   committed data and saves it as backups/latest.xlsx plus a copy for the day.
// GET ?key=… downloads the latest workbook (works even if the website is down).
//   &day=YYYY-MM-DD gets that day's copy, &list=1 lists the daily copies.
//
// Deployed with JWT verification off; both calls are checked against the
// hashes below instead (the real keys live only in the database / the link).

import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5"; // write-only use; the 0.18 advisories are about reading files

const PING_HASH = "af2c46ba53e283b4d9bb302390d047d1e8d40d19020f5501d709ae476c798c7f";
const LINK_HASH = "8e4c8b4d6b5bedd5644c7a45234ed0a4d98dfedc5798b7d4a51791ad463b376c";
const BUCKET = "backups";
const TZ = "America/New_York";
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const keyOk = async (key: unknown, hash: string) => typeof key === "string" && key.length > 0 && (await sha256(key)) === hash;

// ---------- formatting
const day = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d); // YYYY-MM-DD
function when(iso: string | null | undefined) {
  if (!iso) return "";
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
}
const UNIT: Record<string, string> = { hours: "hrs", weekends: "race weekends", measured: "mm", condition: "" };
const ACTION: Record<string, string> = { changed: "Changed", checked: "Checked", measured: "Measured", note: "Note" };
const RESULT: Record<string, string> = { good: "Good", watch: "Watch", replace: "Replace" };

// ---------- status: same rules as the website (src/lib/parts.ts)
type Part = {
  name: string; tracking: string; limit: number | null; newValue: number | null; used: number | null; current: number | null;
  dueAfterRace: boolean; racesSince: number; inspectEvery: number | null; sinceCheck: number | null;
  checkResult: string | null; lastEntry: string | null; lastChanged: string | null; lastChecked: string | null;
};
const RANK = ["unset", "ok", "soon", "due"];
function lifeStatus(p: Part) {
  if (p.tracking === "condition") return p.lastEntry ? "ok" : "unset";
  if (p.tracking === "measured") {
    if (p.limit == null || p.current == null) return "unset";
    if (p.current <= p.limit) return "due";
    const soonAt = p.newValue != null && p.newValue > p.limit ? p.limit + 0.2 * (p.newValue - p.limit) : p.limit * 1.2;
    return p.current <= soonAt ? "soon" : "ok";
  }
  if (p.limit == null || p.limit <= 0 || p.used == null) return "unset";
  const u = p.used / p.limit;
  if (u >= 1 || (p.dueAfterRace && p.racesSince > 0)) return "due";
  return u >= 0.8 ? "soon" : "ok";
}
function statusLabel(p: Part) {
  const life = lifeStatus(p);
  const inspectionDue = p.inspectEvery != null && (p.sinceCheck ?? 0) >= p.inspectEvery;
  const check = p.checkResult === "replace" ? "due" : p.checkResult === "watch" || inspectionDue ? "soon" : "unset";
  const s = RANK[Math.max(RANK.indexOf(life), RANK.indexOf(check))];
  if (s !== life) return p.checkResult === "replace" ? "Check: replace" : p.checkResult === "watch" ? "Check: watch" : "Inspection due";
  if (s === "due") return "Change now";
  if (s === "soon") return "Due soon";
  if (s === "ok") return "Good";
  if (p.tracking === "condition") return "Not checked yet";
  return p.limit == null ? "Needs a limit" : "Not set up";
}

// ---------- workbook
type Snapshot = {
  at: string;
  parts: Part[];
  history: { at: string; part: string; action: string; result: string | null; measurement: number | null; cost: number | null; loggedBy: string | null; notes: string | null }[];
  sessions: { date: string; name: string; type: string; hours: number | null; notes: string | null; loggedAt: string }[];
  notes: { at: string; by: string | null; note: string }[];
  guides: { part: string; reviewed: boolean; by: string | null; updated: string; guide: string }[];
};

function sheet(header: string[], rows: (string | number | null)[][], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows.map((r) => r.map((v) => v ?? ""))]);
  ws["!cols"] = widths.map((wch) => ({ wch }));
  if (rows.length) ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }) };
  return ws;
}

function workbook(d: Snapshot): Uint8Array {
  const wb = XLSX.utils.book_new();
  const status = sheet(
    ["Part", "Status", "Used", "Limit", "Unit", "Last check", "Last changed", "Last checked", "Inspect every (race weekends)"],
    d.parts.map((p) => [
      p.name, statusLabel(p), p.tracking === "measured" ? p.current : p.used, p.limit, UNIT[p.tracking] ?? "",
      p.checkResult ? RESULT[p.checkResult] ?? p.checkResult : "", when(p.lastChanged), when(p.lastChecked), p.inspectEvery,
    ]),
    [26, 16, 8, 8, 14, 11, 17, 17, 14],
  );
  XLSX.utils.sheet_add_aoa(status, [[`Last backup: ${when(d.at)} (Eastern)`]], { origin: "K1" });
  status["!cols"]!.push({ wch: 2 }, { wch: 34 });
  XLSX.utils.book_append_sheet(wb, status, "Status");
  XLSX.utils.book_append_sheet(wb, sheet(
    ["When", "Part", "Action", "Result", "Measurement", "Cost", "Logged by", "Notes"],
    d.history.map((h) => [when(h.at), h.part, ACTION[h.action] ?? h.action, h.result ? RESULT[h.result] ?? h.result : "", h.measurement, h.cost, h.loggedBy, h.notes]),
    [17, 26, 10, 9, 12, 8, 16, 50],
  ), "History");
  XLSX.utils.book_append_sheet(wb, sheet(
    ["Date", "Event", "Type", "Hours", "Notes", "Logged at"],
    d.sessions.map((s) => [s.date, s.name, s.type === "race_weekend" ? "Race weekend" : "Test day", s.hours, s.notes, when(s.loggedAt)]),
    [11, 24, 13, 7, 50, 17],
  ), "Sessions");
  XLSX.utils.book_append_sheet(wb, sheet(["When", "By", "Note"], d.notes.map((n) => [when(n.at), n.by, n.note]), [17, 16, 90]), "Car notes");
  XLSX.utils.book_append_sheet(wb, sheet(
    ["Part", "Reviewed", "Last edited by", "Updated", "Guide"],
    d.guides.map((g) => [g.part, g.reviewed ? "Yes" : "Draft", g.by, when(g.updated), g.guide]),
    [26, 9, 16, 17, 100],
  ), "Guides");
  return XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true }) as Uint8Array;
}

// ---------- handlers
async function rebuild() {
  const { data, error } = await db.rpc("backup_snapshot_service");
  if (error) throw new Error(`snapshot: ${error.message}`);
  const file = workbook(data as Snapshot);
  for (const path of ["latest.xlsx", `daily/${day()}.xlsx`]) {
    const up = await db.storage.from(BUCKET).upload(path, file, { contentType: XLSX_TYPE, upsert: true, cacheControl: "0" });
    if (up.error) throw new Error(`upload ${path}: ${up.error.message}`);
  }
  return file.byteLength;
}

const notFound = () => new Response("Not found", { status: 404 });

async function download(url: URL) {
  if (url.searchParams.get("list")) {
    const { data, error } = await db.storage.from(BUCKET).list("daily", { limit: 400, sortBy: { column: "name", order: "desc" } });
    if (error) throw new Error(error.message);
    const key = encodeURIComponent(url.searchParams.get("key")!);
    const items = (data ?? []).filter((f) => f.name.endsWith(".xlsx")).map((f) => f.name.slice(0, -5))
      .map((d) => `<li><a href="?key=${key}&day=${d}">${d}</a></li>`).join("");
    return new Response(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Tracker backups</title>` +
      `<body style="font:16px system-ui;margin:24px"><h1 style="font-size:20px">Gobbler Racing tracker: daily backups</h1>` +
      `<p><a href="?key=${key}">Latest</a></p><p>Each day's file is the data as it stood at the end of that day.</p><ul>${items}</ul></body>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
  const d = url.searchParams.get("day");
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) return notFound();
  const { data, error } = await db.storage.from(BUCKET).download(d ? `daily/${d}.xlsx` : "latest.xlsx");
  if (error || !data) return notFound();
  return new Response(data, {
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="${d ? `Gobbler Racing tracker backup ${d}` : `Gobbler Racing tracker backup (downloaded ${day()})`}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (!(await keyOk(body?.ping, PING_HASH))) return notFound();
      const bytes = await rebuild();
      return Response.json({ ok: true, bytes });
    }
    if (req.method === "GET") {
      if (!(await keyOk(url.searchParams.get("key"), LINK_HASH))) return notFound();
      return await download(url);
    }
    return new Response("Method not allowed", { status: 405 });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
});
