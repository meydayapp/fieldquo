// scripts/service-seeds/authoring/gen-source-map.mjs <hcp.json> <trade> "<Industry>[:<category regex>]" ...
//
// Writes scripts/service-seeds/source-map/<trade>.json by zipping the seed
// file's services, IN ORDER, with the source rows of the named industries (in
// order, optionally filtered by a category regex). The seed files are written
// in source order for exactly this reason. Asserts the counts match and that
// every benchmark median in the seed equals the source row's median.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , hcpPath, trade, ...specs] = process.argv;
const hcp = JSON.parse(fs.readFileSync(hcpPath, "utf8"));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const seedFile = path.join(root, "app/data/serviceSeeds", `${trade}.js`);
const { SEED } = await import(pathToFileURL(seedFile).href);

const rows = [];
for (const spec of specs) {
  const [industry, re] = spec.split(":");
  const ind = hcp[industry];
  if (!ind) throw new Error(`no industry ${industry}`);
  const filter = re ? new RegExp(re, "i") : null;
  for (const s of ind.services) {
    if (filter && !filter.test(s.category)) continue;
    rows.push({ industry, category: s.category, service: s.service, taskCode: s.taskCode || null, median: s.median });
  }
}
if (rows.length !== SEED.services.length) {
  console.error(`${trade}: seed has ${SEED.services.length} services, source has ${rows.length}`);
  const n = Math.min(rows.length, SEED.services.length);
  for (let i = 0; i < n; i++) console.error(`  ${i}: ${SEED.services[i].seedKey}  <-  ${rows[i].service}`);
  process.exit(1);
}
const out = SEED.services.map((s, i) => {
  const r = rows[i];
  const m = s.benchmark?.median ?? null;
  if (m !== r.median) {
    console.error(`${trade}#${i} ${s.seedKey}: median ${m} != source ${r.median} (${r.service})`);
    process.exitCode = 1;
  }
  return { seedKey: s.seedKey, industry: r.industry, sourceCategory: r.category, sourceService: r.service, taskCode: r.taskCode };
});
if (process.exitCode) process.exit(1);
fs.writeFileSync(path.join(root, "scripts/service-seeds/source-map", `${trade}.json`), JSON.stringify(out, null, 1) + "\n");
console.log(`${trade}: ${out.length} rows mapped`);
