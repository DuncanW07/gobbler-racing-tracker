// Gobbler Racing tracker: live backup receiver (Google Apps Script).
//
// The tracker's database sends the full data here after every change, so this
// spreadsheet is always current, even if the website is down. Once a day it also
// saves a dated copy into a Drive folder, so a mistake can be rolled back.
//
// Setup: open the backup Google Sheet > Extensions > Apps Script, paste this file,
// put the secret in SECRET, Deploy > New deployment > Web app
// (Execute as: Me, Who has access: Anyone), and send the web app URL to the tracker.

const SECRET = "PASTE_THE_SECRET_HERE";
const FOLDER = "Gobbler Racing tracker backups";
const TZ = "America/New_York";

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const msg = JSON.parse(e.postData.contents);
    if (msg.secret !== SECRET) return reply({ ok: false, error: "bad secret" });
    dailyCopy(); // yesterday's version is kept before today's first change
    write(msg.data);
    return reply({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// Same rules as the website: red = replace / change now, orange = watch or due soon.
function status(p) {
  const rank = ["Not set up", "Good", "Due soon / watch", "Replace now"];
  let life = 0;
  if (p.tracking === "condition") life = p.lastEntry ? 1 : 0;
  else if (p.limit != null && p.used != null) {
    const u = p.used / p.limit;
    life = u >= 1 || (p.dueAfterRace && p.racesSince > 0) ? 3 : u >= 0.8 ? 2 : 1;
  }
  const inspectionDue = p.inspectEvery != null && (p.sinceCheck || 0) >= p.inspectEvery;
  const check = p.checkResult === "replace" ? 3 : p.checkResult === "watch" || inspectionDue ? 2 : 0;
  let label = rank[Math.max(life, check)];
  if (label === rank[0] && p.tracking === "condition") label = "Not checked yet";
  if (check > life) label += p.checkResult ? ` (check: ${p.checkResult})` : " (inspection due)";
  return label;
}

const when = (iso) => (iso ? Utilities.formatDate(new Date(iso), TZ, "yyyy-MM-dd HH:mm") : "");
const unit = (t) => ({ hours: "hrs", weekends: "race weekends", measured: "mm", condition: "" })[t] || "";

function write(d) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  table(ss, "Status", ["Part", "Status", "Used", "Limit", "Unit", "Last check result", "Last changed", "Inspect every (race weekends)"],
    d.parts.map((p) => [p.name, status(p), p.used ?? "", p.limit ?? "", unit(p.tracking), p.checkResult || "", when(p.lastChanged), p.inspectEvery ?? ""]));
  table(ss, "History", ["When", "Part", "Action", "Result", "Measurement", "Cost", "Logged by", "Notes"],
    d.history.map((h) => [when(h.at), h.part, h.action, h.result || "", h.measurement ?? "", h.cost ?? "", h.loggedBy || "", h.notes || ""]));
  table(ss, "Sessions", ["Date", "Event", "Type", "Hours", "Notes", "Logged at"],
    d.sessions.map((s) => [s.date, s.name, s.type === "race_weekend" ? "Race weekend" : "Test day", s.hours ?? "", s.notes || "", when(s.loggedAt)]));
  table(ss, "Car notes", ["When", "By", "Note"], d.notes.map((n) => [when(n.at), n.by, n.note]));
  table(ss, "Guides", ["Part", "Reviewed", "Last edited by", "Updated", "Guide"],
    d.guides.map((g) => [g.part, g.reviewed ? "Yes" : "Draft", g.by || "", when(g.updated), g.guide]));
  ss.getSheetByName("Status").getRange("J1").setValue(`Last backup: ${when(d.at)}`);
}

function table(ss, name, header, rows) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clearContents();
  sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
  if (rows.length) sh.getRange(2, 1, rows.length, header.length).setValues(rows);
  sh.setFrozenRows(1);
}

function dailyCopy() {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd");
  if (props.getProperty("lastCopy") === today) return;
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const folders = DriveApp.getFoldersByName(FOLDER);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(FOLDER);
  DriveApp.getFileById(ss.getId()).makeCopy(`Tracker backup ${today}`, folder);
  props.setProperty("lastCopy", today);
}
