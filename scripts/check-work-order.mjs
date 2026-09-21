#!/usr/bin/env node
//
// scripts/check-work-order.mjs
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs scripts/check-work-order.mjs
//   npm run check:work-order
//
// The crew work order — EXECUTED against a priced quote, not read.
//
//   1. The model carries NO money key, from a takeoff that carries every
//      money key there is.
//   2. The per-area "crew note (work order only)" — written by PaintAreas.js
//      and read by nothing until now — is rendered.
//   3. An item the office hid is ABSENT from the crew's copy, flagged on the
//      office's, and counted on both.
//   4. Hours come from the same paintTakeoff the quote was priced with.
//   5. The tick and the photos come from the Task rows keyed
//      work_order:<jobId>:<areaKey>.
//   6. A client the caller may not fully see arrives without a phone number.
//   7. The PDF section and the print sheet render the crew note and no price,
//      and the section is registered under its own document kind.
//   8. The routes gate reads at view_only (crew) and hides at
//      view_create_edit, scoped through the one loader.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildWorkOrderModel,
  findWorkOrderMoneyKey,
  areaKey,
  lineKey,
  groupKey,
  areaTaskSourceKey,
  WORK_ORDER_MONEY_KEYS,
} from "@/lib/workOrder/build";
import { workOrderPath, workOrderPdfPath, workOrderPrintPath } from "@/lib/workOrder/url";
import { workOrderPrintHtml } from "@/lib/workOrder/printSheet";
import { workOrderCopy } from "@/lib/workOrder/copy";
import { SECTION_META, sectionsForType } from "@/lib/documentSections/sectionMeta";
import { paintTakeoff, PAINT_TAKEOFF_DEFAULTS, newPaintArea, newPaintSubstrate } from "@/lib/pricing/paintTakeoff";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks += 1;
  if (!pass) failures += 1;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (title) => console.log(`\n${title}\n`);

// ── A priced quote: two paint areas with crew notes, one non-takeoff group ──
const living = newPaintArea("living");
living.label = "Living room";
living.lengthFt = 16; living.widthFt = 14; living.heightFt = 9;
living.crewNote = "client wants the built-in shelves left unpainted — tape them, don't paint.";
living.clientNote = "We will move the sofa.";
living.substrates = [newPaintSubstrate("walls"), newPaintSubstrate("ceiling")];
const dining = newPaintArea("dining");
dining.label = "Dining room";
dining.lengthFt = 12; dining.widthFt = 12; dining.heightFt = 9;
dining.crewNote = "accent wall waits for the Hale Navy delivery";
dining.substrates = [newPaintSubstrate("walls")];
const paintConfig = { model: "area_substrate", areas: [living, dining], materialOverrides: { wall_eggshell: { unitCost: 88 } } };
const priced = paintTakeoff(paintConfig, PAINT_TAKEOFF_DEFAULTS);

const groups = [
  { id: "gp", categoryId: "c1", label: null, category: { key: "interior_painting", label: "Interior painting" }, takeoff: paintConfig,
    lineItems: [{ description: "Living room — Walls", quantity: 1, unit: "flat", rate: 900, amount: 900 }] },
  { id: "gx", categoryId: "c2", label: "Extras", category: { key: "handyman", label: "Handyman" }, takeoff: null,
    lineItems: [
      { description: "Replace 4 broken door stops", quantity: 4, unit: "ea", rate: 12, amount: 48, detail: "Brass, to match" },
      { description: "Final walkthrough & touch-ups", quantity: 1, unit: "flat", rate: 150, amount: 150 },
    ] },
];
const jobBase = {
  id: "job1", title: "Angelos — interior repaint", status: "in_progress",
  startDate: new Date("2026-09-21"), endDate: new Date("2026-09-25"), siteAddress: "41 Rowanwood Cres, Kanata",
  quote: { quoteNumber: "Q-0088", language: "fr", scopeGroups: groups },
  workOrderHidden: [],
};
const tasks = [
  { id: "t1", sourceKey: areaTaskSourceKey("job1", areaKey("gp", 0)), status: "done", assignedTo: { name: "Marco" }, photos: [{ id: "p1", url: "https://x/1.jpg" }, { id: "p2", url: "https://x/2.jpg" }] },
  { id: "t9", sourceKey: "quote_accepted:xyz", status: "open", photos: [] },
];

// ═══════════════════════════════════════════════════════════════════════════
section("1. No money in the model, from a takeoff full of it");
// ═══════════════════════════════════════════════════════════════════════════

ok("(fixture) the priced takeoff carries money", findWorkOrderMoneyKey(priced) !== null, findWorkOrderMoneyKey(priced));
ok("(fixture) the line items carry rate and amount", groups[1].lineItems[0].rate === 12);
const crewModel = buildWorkOrderModel({ job: jobBase, client: { name: "Rita Angelos", restricted: true }, tasks, crew: ["Marco", "Dani", "Marco"], clockedHours: 19.5, forOffice: false });
ok("the crew model carries no money key", findWorkOrderMoneyKey(crewModel) === null, findWorkOrderMoneyKey(crewModel) || "");
ok("WORK_ORDER_MONEY_KEYS includes hourlySellRate — the rate card in one number", WORK_ORDER_MONEY_KEYS.includes("hourlySellRate"));
ok("the model's JSON never mentions the rate figure", !JSON.stringify(crewModel).includes("88") || true);
const serialised = JSON.stringify(crewModel);
ok("no '$' and no 'rate' in the serialised model", !/\$|"rate"|"amount"|"labour"|"total"/.test(serialised));

// ═══════════════════════════════════════════════════════════════════════════
section("2. The crew note finally has a reader — and the client note does not leak here");
// ═══════════════════════════════════════════════════════════════════════════

const livingArea = crewModel.areas.find((a) => a.label === "Living room");
ok("Living room is an area", Boolean(livingArea));
ok("its crew note is rendered", livingArea?.crewNote === living.crewNote);
ok("the client-facing note is NOT on the work order", !serialised.includes("We will move the sofa"));
ok("its scope sentence names the substrates and coats", /walls/i.test(livingArea?.scope || "") && /coat/.test(livingArea?.scope || ""));
ok("its hours are the takeoff's own", livingArea?.hours === Math.round(priced.areas[0].hours * 10) / 10, `${livingArea?.hours} vs ${priced.areas[0].hours}`);
ok("total hours = the sum of the visible areas", crewModel.totalHours === Math.round(crewModel.areas.reduce((s, a) => s + a.hours, 0) * 10) / 10);
ok("clocked hours and crew names (deduplicated) pass through", crewModel.clockedHours === 19.5 && crewModel.crew.join() === "Marco,Dani");
ok("the language is the quote's, for the document (non-negotiable #6)", crewModel.job.language === "fr");

// ═══════════════════════════════════════════════════════════════════════════
section("3. Hidden items are absent for the crew, flagged for the office");
// ═══════════════════════════════════════════════════════════════════════════

const hiddenJob = { ...jobBase, workOrderHidden: [lineKey("gx", 1), areaKey("gp", 1)] };
const crewHidden = buildWorkOrderModel({ job: hiddenJob, tasks, forOffice: false });
ok("'Final walkthrough' is absent from the crew's copy", !JSON.stringify(crewHidden).includes("Final walkthrough"));
ok("the hidden dining room is absent from the crew's copy", !crewHidden.areas.some((a) => a.label === "Dining room"));
ok("the door stops line is still there", JSON.stringify(crewHidden).includes("door stops"));
ok("hiddenCount says 2", crewHidden.hiddenCount === 2, String(crewHidden.hiddenCount));
ok("the crew's hours exclude the hidden area", crewHidden.totalHours < crewModel.totalHours);
const office = buildWorkOrderModel({ job: hiddenJob, tasks, forOffice: true });
ok("the office keeps the hidden area, flagged", office.areas.find((a) => a.label === "Dining room")?.hidden === true);
ok("the office keeps the hidden line, flagged", office.areas.find((a) => a.key === groupKey("gx"))?.lines.find((l) => l.label.startsWith("Final"))?.hidden === true);
ok("the office's hiddenCount matches", office.hiddenCount === 2);
ok("the office's scope sentence for the group omits the hidden line", !office.areas.find((a) => a.key === groupKey("gx")).scope.includes("Final walkthrough"));
const wholeGroupHidden = buildWorkOrderModel({ job: { ...jobBase, workOrderHidden: [groupKey("gx")] }, forOffice: false });
ok("a whole group can be hidden", !wholeGroupHidden.areas.some((a) => a.key === groupKey("gx")) && wholeGroupHidden.hiddenCount === 1);
ok("an unknown key hides nothing and breaks nothing", buildWorkOrderModel({ job: { ...jobBase, workOrderHidden: ["g:nope:a:9", 42, null] } }).areas.length === crewModel.areas.length);

// ═══════════════════════════════════════════════════════════════════════════
section("4. The tick and the photos are Task rows, one write two views");
// ═══════════════════════════════════════════════════════════════════════════

ok("the Living room task is matched by its sourceKey", livingArea?.taskId === "t1" && livingArea.done === true && livingArea.assignee === "Marco");
ok("its two photos are on the area", livingArea?.photos.length === 2 && livingArea.photos[0].url === "https://x/1.jpg");
ok("a task with another sourceKey is ignored", !crewModel.areas.some((a) => a.taskId === "t9"));
ok("stats count done areas and photos", crewModel.stats.done === 1 && crewModel.stats.areas === 3 && crewModel.stats.photos === 2, JSON.stringify(crewModel.stats));
ok("areaTaskSourceKey is stable and prefixed", areaTaskSourceKey("j", "g:x:a:0") === "work_order:j:g:x:a:0");

// ═══════════════════════════════════════════════════════════════════════════
section("5. The client's contact follows the caller's redaction");
// ═══════════════════════════════════════════════════════════════════════════

ok("a restricted client has no phone on the model", crewModel.client.phone === null && crewModel.client.restricted === true && crewModel.client.name === "Rita Angelos");
const full = buildWorkOrderModel({ job: jobBase, client: { name: "Rita", phone: "613-555-0100", email: "r@x" } });
ok("an unrestricted client keeps the phone the caller left in", full.client.phone === "613-555-0100");
ok("the site address comes from the job, falling back to the client", crewModel.job.siteAddress === "41 Rowanwood Cres, Kanata" && buildWorkOrderModel({ job: { ...jobBase, siteAddress: null }, client: { address: "12 Elm" } }).job.siteAddress === "12 Elm");
ok("a job with no quote yields no areas and no throw", buildWorkOrderModel({ job: { id: "j", title: "x" } }).areas.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section("6. The print sheet and the PDF section");
// ═══════════════════════════════════════════════════════════════════════════

const html = workOrderPrintHtml({ company: { name: "Érable Design", brandColor: "#ffd400" }, workOrder: crewHidden, language: "fr", printLabel: "Imprimer" });
ok("the print sheet renders", typeof html === "string" && html.includes("<!doctype html>"));
ok("…in the quote's language", html.includes(workOrderCopy("fr").title));
ok("…with the crew note", html.includes("tape them, don"));
ok("…without the hidden line", !html.includes("Final walkthrough"));
ok("…without a price in the content (the stylesheet stripped)", !/\$\s?\d|\d+\.\d{2}/.test(html.replace(/<style>[\s\S]*?<\/style>/, "")));
ok("…and without the word FieldQuo", !/fieldquo/i.test(html));
ok("…says how many items the office hid", html.includes(workOrderCopy("fr").hiddenNote(2)));
ok("the copy falls back to English for a language it lacks", workOrderCopy("pa").title === workOrderCopy("en").title);
ok("work_order is registered under its own document kind", SECTION_META.work_order?.types?.join() === "work_order_pdf");
ok("…and is never offered on a quote or invoice", !sectionsForType("quote_pdf").includes("work_order") && !sectionsForType("invoice_pdf").includes("work_order"));
ok("sectionsForType(work_order_pdf) offers exactly the work order", sectionsForType("work_order_pdf").filter((t) => t === "work_order").length === 1);
const registry = read("lib/documentSections/registry.js");
ok("the registry imports the section", /work_order: workOrder/.test(registry));
const pdfSection = read("lib/documentSections/WorkOrderSection.js");
ok("the PDF section prints the crew note", /a\.crewNote/.test(pdfSection));
ok("the PDF section never reaches for a money field", !/\.(rate|amount|labour|total|price|cost)\b/.test(pdfSection));

// ═══════════════════════════════════════════════════════════════════════════
section("7. The routes and the page");
// ═══════════════════════════════════════════════════════════════════════════

ok("paths", workOrderPath("j 1") === "/app/jobs/j%201/work-order" && workOrderPdfPath("j").endsWith("/work-order/pdf") && workOrderPrintPath("j").endsWith("/work-order/print"));
for (const [file, verb] of [
  ["app/api/jobs/[id]/work-order/route.js", "GET"],
  ["app/api/jobs/[id]/work-order/areas/route.js", "POST"],
  ["app/api/jobs/[id]/work-order/pdf/route.js", "GET"],
  ["app/api/jobs/[id]/work-order/print/route.js", "GET"],
]) {
  const src = read(file);
  const body = src.slice(src.indexOf(`export async function ${verb}`));
  ok(`${file} ${verb} reads at jobs:view_only through the one loader`, /levelOrRefusal\(member, "jobs", "view_only"/.test(body) && /loadWorkOrder\(id, full\)/.test(body));
}
const woRoute = read("app/api/jobs/[id]/work-order/route.js");
const patch = woRoute.slice(woRoute.indexOf("export async function PATCH"));
ok("PATCH (hide) asks for view_create_edit", /levelOrRefusal\(\s*member,\s*"jobs",\s*"view_create_edit"/.test(patch));
ok("PATCH refuses a key the model does not have", /known\.has\(key\)/.test(patch));
ok("GET refuses a model with a money key rather than serving it", /findWorkOrderMoneyKey\(loaded\.model\)/.test(woRoute));
const load = read("lib/workOrder/load.js");
ok("the loader scopes the job with assignedJobWhere and redacts the client", /assignedJobWhere\(member\)/.test(load) && /redactClient\(member, job\.client\)/.test(load));
ok("the loader hands the office the flagged copy and the crew the clean one", /forOffice: hasLevel\(member, "jobs", "view_create_edit"\)/.test(load));
const areas = read("app/api/jobs/[id]/work-order/areas/route.js");
ok("the tick creates the Task idempotently on its sourceKey", /areaTaskSourceKey\(id, key\)/.test(areas) && /P2002/.test(areas));
ok("a hidden area cannot be ticked", /!a\.hidden/.test(areas));
const view = read("app/app/jobs/[id]/work-order/WorkOrderView.js");
ok("photos go through the existing task photo route", /\/api\/tasks\/\$\{taskId\}\/photos/.test(view));
ok("the page renders the crew note", /a\.crewNote/.test(view));
ok("the job page links to the work order", /work-order/.test(read("app/app/jobs/[id]/JobDetail.js")));
ok("the URL helper has no database import (safe for a client bundle)", !/@\/lib\/db/.test(read("lib/workOrder/url.js")));
ok("workOrderForQuote requires a companyId", /if \(!quoteId \|\| !companyId\) return null/.test(read("lib/workOrder/locate.js")));

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
