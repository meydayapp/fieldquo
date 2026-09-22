// Parse the HCP capture into JSON per industry.
import fs from "node:fs";
const src = fs.readFileSync("/Users/emilioboves/StudioProjects/fq-wt-hcp/docs/research/hcp-price-books-by-trade.md", "utf8");
const lines = src.split("\n");
const out = {};
let cur = null;
const money = (s) => { const t = String(s||"").replace(/[$,\s]/g,""); if (!t) return null; const n = Number(t); return Number.isFinite(n)?n:null; };
for (const line of lines) {
  const h = line.match(/^## (.+)$/);
  if (h) { if (h[1].startsWith("Summary")) { cur = null; continue; } cur = h[1].trim(); out[cur] = { industry: cur, services: [], categories: [], medianOfMedians: null }; continue; }
  if (!cur) continue;
  const mm = line.match(/median of medians \*\*\$([\d,]+)\*\*/);
  if (mm) out[cur].medianOfMedians = money(mm[1]);
  if (!line.startsWith("| ")) continue;
  if (line.startsWith("| Category |") || line.startsWith("|---")) continue;
  // split on " | " respecting the leading/trailing pipe
  const cells = line.slice(1, line.endsWith("|") ? -1 : undefined).split(" | ").map((c) => c.trim());
  if (cells.length < 11) { console.error("short row", cur, cells.length, line.slice(0,80)); continue; }
  const [category, service, taskCode, unit, base, p25, median, p75, dur, ob, ...rest] = cells;
  const description = rest.join(" | ");
  out[cur].services.push({ category, service, taskCode, unit, base: money(base), p25: money(p25), median: money(median), p75: money(p75), durationMinutes: dur ? Number(dur) : null, bookable: ob === "yes", description });
  if (!out[cur].categories.includes(category)) out[cur].categories.push(category);
}
fs.writeFileSync("hcp.json", JSON.stringify(out, null, 1));
const rows = Object.values(out);
console.log("industries", rows.length, "services", rows.reduce((a,r)=>a+r.services.length,0));
for (const r of rows) console.log(String(r.services.length).padStart(4), String(r.services.filter(s=>s.median!=null).length).padStart(4), r.industry);
