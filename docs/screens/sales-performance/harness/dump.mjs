// docs/screens/sales-performance/harness/dump.mjs
//
// Snapshots what the three routes return for the REAL database into
// fixtures/data.js — read-only, through the same loaders the routes call —
// so the frames carry real numbers and nothing invented. The agency is the
// first agency-kind rep; its "team" is what agencyTeamIds returns for it.
//   node --env-file=.env --import ./scripts/alias-loader.mjs docs/screens/sales-performance/harness/dump.mjs [preset]
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "@/lib/db";
import { loadPerformanceReport, performanceBounds } from "@/lib/sales/performanceLoad";
import { agencyTeamIds } from "@/lib/sales/agency";
import { repViewer, visibleRepIds } from "@/lib/sales/team";
import { callQaQueue } from "@/lib/sales/calls/qaQueue";

const H = dirname(fileURLToPath(import.meta.url));
const preset = process.argv[2] || "thisMonth";
const { from, to } = performanceBounds(preset);
const platform = await loadPerformanceReport({ from, to, repIds: null });

const agency = await db.salesRep.findFirst({ where: { kind: "agency", active: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, email: true, code: true } });
if (!agency) throw new Error("no agency-kind rep to photograph");
const teamIds = await agencyTeamIds(agency.id);
const repIds = visibleRepIds(repViewer(agency.id, teamIds));
const report = await loadPerformanceReport({ from, to, repIds });
const rows = await callQaQueue({ repIds, from, to });
const quality = { rows, scope: { agencyId: agency.id, repIds }, serverNow: new Date().toISOString() };
const me = { id: agency.id, name: agency.name, email: agency.email, code: agency.code, kind: "agency", isAgency: true, agencyEmployee: false, agency: null };
// One module of named exports rather than JSON files: scripts/check-exports.mjs
// resolves every import against a real export, and a JSON default is not one.
writeFileSync(
  join(H, "fixtures/data.js"),
  `// Written by dump.mjs on ${new Date().toISOString()} for preset "${preset}" (${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)}). Real routes, real database, read-only.\n` +
    `export const PLATFORM = ${JSON.stringify(platform)};\nexport const AGENCY = ${JSON.stringify(report)};\nexport const QUALITY = ${JSON.stringify(quality)};\nexport const ME = ${JSON.stringify(me)};\n`,
);
console.log(`dumped ${preset}: ${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)} — platform reps ${platform.calls.reps.length}, agency ${agency.name} team ${repIds.length}, quality rows ${rows.length}`);
process.exit(0);
