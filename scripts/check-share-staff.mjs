// scripts/check-share-staff.mjs
//
//   npm run check:share-staff
//
// "Share with staff" — the quote Send menu's team-chat share — EXECUTED.
//
// The owner (2026-10-03): "what about the option to share a quote with the
// team? I think the crew can see the very basic things, or is that meant for
// someone else?" It posted a /app/quotes/<id> link into #general by default;
// the Crew preset is at quotes:none, the route refused them, and the page said
// "Quote not found." This holds the fix in place:
//
//   1. canOpenQuote is the route's own rung, run over every preset.
//   2. The message carries the WORK ORDER (no prices) for the crew when the
//      quote is a job, and an access note when it is not.
//   3. A share straight to one person who can open neither is refused.
//   4. The directory says who can open a quote (a boolean, never the grid).
//   5. Both callers hand the modal the job's id; the quote page tells a
//      refused reader the truth instead of "not found".
import { readFileSync } from "node:fs";
import { canOpenQuote, shareMessageBody, shareVerdict } from "@/lib/quotes/shareWithStaff";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let pass = 0;
const failures = [];
const ok = (label, cond, detail = "") => {
  if (cond) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}${detail ? `  — ${detail}` : ""}`); }
};
const section = (t) => console.log(`\n${t}\n`);
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const code = (p) => read(p).split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
const preset = (k) => ({ role: PRESET_TO_ROLE[k], permissions: PERMISSION_PRESETS[k].values });

section("1. Who can open the quote link — the route's own rung, per preset");
ok("Crew cannot (quotes: none)", canOpenQuote(preset("worker")) === false);
for (const k of ["estimator", "dispatcher", "manager"]) ok(`${PERMISSION_PRESETS[k].label} can`, canOpenQuote(preset(k)) === true);
ok("owner and admin can, whatever their grid", canOpenQuote({ role: "owner", permissions: { quotes: "none" } }) && canOpenQuote({ role: "admin", permissions: { quotes: "none" } }));
ok("a gridless member can (hasLevel's fail-open, as the route)", canOpenQuote({ role: "employee", permissions: null }));
ok("junk is a no", !canOpenQuote(null) && !canOpenQuote({}) && !canOpenQuote({ role: 7 }));
const route = code("app/api/quotes/[id]/route.js");
ok("GET /api/quotes/[id] refuses below quotes:view_only — the rung canOpenQuote asks",
  /levelOrRefusal\(\s*member,\s*"quotes",\s*"view_only",/.test(route));

section("2. The message");
const withJob = shareMessageBody({ message: "  have a look ", quoteLine: "Q: /app/quotes/q1", workOrderLine: "WO: /app/jobs/j1/work-order", accessNote: "NOTE" });
ok("with a job: the sender's line, the quote link, the work order link — in that order",
  withJob === "have a look\nQ: /app/quotes/q1\nWO: /app/jobs/j1/work-order", JSON.stringify(withJob));
ok("…and no access note (the work order IS the crew's answer)", !withJob.includes("NOTE"));
const noJob = shareMessageBody({ message: "", quoteLine: "Q: /app/quotes/q1", workOrderLine: null, accessNote: "NOTE" });
ok("without a job: the quote link and the access note, no empty first line", noJob === "Q: /app/quotes/q1\nNOTE", JSON.stringify(noJob));
ok("no line carries a price — the body is only the links and the sender's words",
  !/\$|€|£|\d+\.\d{2}/.test(withJob + noJob));

section("3. Who it may be sent to");
ok("a room is always fine (the message says who each link is for)", shareVerdict({ kind: "room", hasWorkOrder: false }).ok);
ok("one person who can open the quote: fine", shareVerdict({ kind: "person", personCanOpenQuote: true, hasWorkOrder: false }).ok);
ok("one person who cannot, with a work order to give them: fine", shareVerdict({ kind: "person", personCanOpenQuote: false, hasWorkOrder: true }).ok);
const refused = shareVerdict({ kind: "person", personCanOpenQuote: false, hasWorkOrder: false });
ok("one person who can open neither: refused before it posts", !refused.ok && refused.reason === "no_access_no_work_order");
ok("unknown (an old directory row) is not a refusal", shareVerdict({ kind: "person", personCanOpenQuote: null, hasWorkOrder: false }).ok);

section("4. The directory says who can open a quote — a boolean, not the grid");
const store = code("lib/company/chat/store.js");
ok("directoryFor sets canOpenQuote from the shared helper", /canOpenQuote: canOpenQuote\(m\)/.test(store));
const dirBlock = store.slice(store.indexOf("export async function directoryFor"), store.indexOf("export async function directoryFor") + 1400);
ok("…and does not hand the grid itself to the browser", !/permissions:\s*m\.permissions/.test(dirBlock) && !/\.\.\.m\b/.test(dirBlock));

section("5. The modal, its callers, and the refused reader");
const modal = code("app/components/quotes/ShareWithStaffModal.js");
ok("the modal runs shareVerdict before posting", /shareVerdict\(\{/.test(modal) && modal.indexOf("shareVerdict({") < modal.indexOf('fetchJson(`/api/chat/rooms/${roomId}`'));
ok("…builds the body with shareMessageBody", /shareMessageBody\(\{/.test(modal));
ok("…links the work order by the one URL helper", /workOrderPath\(workOrderJobId\)/.test(modal));
ok("…and marks people who can't open quotes in the picker", /p\.canOpenQuote === false/.test(modal));
ok("the quote page hands it the job", /workOrderJobId=\{quote\.jobs\?\.\[0\]\?\.id \|\| null\}/.test(code("app/app/quotes/[id]/page.js")));
ok("the builder hands it the job", /workOrderJobId=\{workOrderJobId\}/.test(code("app/components/quotes/builder/DocumentBuilder.js")));
const page = code("app/app/quotes/[id]/page.js");
ok("the quote page tells a 403 apart from a 404", /setRefused\(r\.status === 403\)/.test(page) && /app\.quoteDetail\.noAccess/.test(page));

section("6. Every new sentence, in every catalogue language");
const KEYS = [
  "app.shareStaff.quoteLine", "app.shareStaff.workOrderLine", "app.shareStaff.accessNote", "app.shareStaff.hintWithJob",
  "app.shareStaff.hintNoJob", "app.shareStaff.getsWorkOrder", "app.shareStaff.cantOpen", "app.shareStaff.noAccessNoWorkOrder",
  "app.quoteDetail.noAccess",
];
for (const [lang, msgs] of Object.entries(APP_MESSAGES)) {
  const missing = KEYS.filter((k) => typeof msgs[k] !== "string" || !msgs[k].trim());
  ok(`${lang}: all ${KEYS.length} present`, missing.length === 0, missing.join(", "));
  const placeholders = ["app.shareStaff.quoteLine", "app.shareStaff.workOrderLine", "app.shareStaff.noAccessNoWorkOrder"];
  const broken = placeholders.filter((k) => {
    const want = (APP_MESSAGES.en[k].match(/\{\w+\}/g) || []).sort().join();
    return ((msgs[k] || "").match(/\{\w+\}/g) || []).sort().join() !== want;
  });
  ok(`${lang}: placeholders match English`, broken.length === 0, broken.join(", "));
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
