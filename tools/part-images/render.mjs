// Renders the overview part pictures (public/parts/*.webp) from render.html.
//   node tools/part-images/render.mjs            -> all parts
//   node tools/part-images/render.mjs rotor ppf  -> just those
// Needs Playwright (npx playwright install chromium, or CHROME_PATH=...) and Python with Pillow.
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "tools/part-images/png");
// [render name, output file, camera zoom]
const PARTS = [
  ["engine", "engine"], ["transmission", "transmission"], ["differential", "differential"], ["airFilter", "air-filter"],
  ["pads", "pads"], ["tires", "tires"], ["rotor", "rotor"], ["clutch", "clutch"], ["damper", "damper", 1.02],
  ["bearing", "bearing"], ["controlArm", "control-arm"], ["ppf", "ppf"], ["axle", "axle", 0.98],
];
const wanted = process.argv.slice(2);
const types = { ".html": "text/html", ".js": "text/javascript" };
const server = createServer(async (req, res) => {
  try {
    const file = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (!file.startsWith(ROOT)) throw new Error("outside");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] ?? "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
await import("node:fs").then((fs) => fs.mkdirSync(OUT, { recursive: true }));
for (const [part, out, zoom = 0.86] of PARTS.filter(([p, o]) => !wanted.length || wanted.includes(p) || wanted.includes(o))) {
  await page.goto(`http://127.0.0.1:${port}/tools/part-images/render.html?part=${part}&zoom=${zoom}`);
  await page.waitForFunction(() => window.done === true, null, { timeout: 60000 });
  await page.screenshot({ path: path.join(OUT, `${out}.png`) });
  console.log("rendered", out);
}
await browser.close();
server.close();
execFileSync("python3", [path.join(ROOT, "tools/part-images/export.py")], { stdio: "inherit" });
