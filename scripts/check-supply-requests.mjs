#!/usr/bin/env node
//
// scripts/check-supply-requests.mjs
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/db-stub-loader.mjs scripts/check-supply-requests.mjs
//   npm run check:supply-requests
//
// Supplies: request → ordered → restocked — EXECUTED.
//
//   1. The state machine is closed: every pair of states is tried and only
//      the four legal moves pass. Restocked and cancelled are terminal.
//   2. "Restocked" writes ONE `received` movement, positive, with an
//      idempotent ref — and none for a free-text item.
//   3. The low-stock pre-fill asks for the SHORTFALL, never for a material
//      without a threshold, never twice for one already asked for.
//   4. The phone form's body is normalised: a foreign material id, a zero
//      quantity, a bad date, an http photo and an invented source are all
//      refused or corrected.
//   5. The route writes the movement inside the transaction that moves the
//      status, re-reads the row first, and never edits a stock level.
//   6. The three notifications are in the catalogue with destinations and
//      English + French sentences; the two answers narrow to the requester.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { SUPPLY_STATUSES, transition, restockMovementFor, lowStockPrefills, normaliseRequest } from "@/lib/supplies/state";
import { shapeRequest } from "@/lib/supplies/shape";
import { stockLevels } from "@/lib/purchasing/stock";
import { normaliseMovement } from "@/lib/purchasing/stock";
import { NOTIFICATION_TYPES, typeProblems } from "@/lib/notifications/catalog";
import { hrefFor } from "@/lib/notifications/render";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

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

// ═══════════════════════════════════════════════════════════════════════════
section("1. The state machine is closed");
// ═══════════════════════════════════════════════════════════════════════════

const LEGAL = new Set(["requested>ordered", "requested>cancelled", "ordered>restocked", "ordered>cancelled"]);
let legalSeen = 0;
for (const from of SUPPLY_STATUSES) {
  for (const to of SUPPLY_STATUSES) {
    const r = transition(from, to);
    const should = LEGAL.has(`${from}>${to}`);
    if (should) legalSeen += 1;
    ok(`${from} → ${to} is ${should ? "allowed" : "refused"}`, r.ok === should, r.error || "");
  }
}
ok("exactly four legal moves", legalSeen === 4);
ok("an unknown state is refused both ways", !transition("shipped", "ordered").ok && !transition("requested", "shipped").ok);
ok("null and junk are refused", !transition(null, "ordered").ok && !transition("requested", 42).ok);
ok("a refused move says why in a sentence", /already restocked/.test(transition("restocked", "ordered").error) && /cancelled/.test(transition("cancelled", "ordered").error));

// ═══════════════════════════════════════════════════════════════════════════
section("2. Restocked writes one received movement");
// ═══════════════════════════════════════════════════════════════════════════

const req = { id: "sr1", materialId: "tape", quantity: "6.000", jobId: "j1", restockNote: "in van 2" };
const mv = restockMovementFor(req);
ok("a matched request yields a received movement of +6", mv && mv.kind === "received" && mv.quantity === 6);
ok("its ref is the request id — the ledger's unique refuses a second", mv.ref === "supply_request:sr1");
ok("it carries the job and the note", mv.jobId === "j1" && mv.note === "in van 2");
ok("the ledger's own normaliser agrees on the sign", normaliseMovement({ kind: mv.kind, quantity: mv.quantity }).quantity === 6);
ok("a free-text item yields no movement — nothing in stock to move", restockMovementFor({ id: "x", materialId: null, quantity: 3 }) === null);
ok("a zero or junk quantity yields no movement", restockMovementFor({ id: "x", materialId: "m", quantity: 0 }) === null && restockMovementFor({ id: "x", materialId: "m", quantity: "lots" }) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The reorder banner pre-fills the shortfall");
// ═══════════════════════════════════════════════════════════════════════════

const levels = stockLevels(
  [
    { id: "tape", name: "Painter's tape", unit: "roll", reorderThreshold: 6 },
    { id: "hinge", name: "Blum hinges", unit: "ea", reorderThreshold: 80 },
    { id: "caulk", name: "Caulk", unit: "tube", reorderThreshold: null },
    { id: "rag", name: "Rags", unit: "box", reorderThreshold: 2 },
  ],
  [
    { materialId: "tape", quantity: 3 },
    { materialId: "hinge", quantity: 100 }, { materialId: "hinge", quantity: -32 },
    { materialId: "caulk", quantity: 1 },
    { materialId: "rag", quantity: 5 },
  ],
);
const pre = lowStockPrefills(levels, [{ materialId: "hinge", status: "ordered" }, { materialId: "rag", status: "cancelled" }]);
ok("tape 3 of 6 → asks for 3", pre.find((p) => p.materialId === "tape")?.quantity === 3);
ok("hinges 68 of 80 are already ordered → not asked again", !pre.some((p) => p.materialId === "hinge"));
ok("caulk has no threshold → no statement, no request", !pre.some((p) => p.materialId === "caulk"));
ok("rags are above threshold → not asked", !pre.some((p) => p.materialId === "rag"));
ok("a cancelled request does not count as cover", lowStockPrefills(levels, [{ materialId: "tape", status: "cancelled" }]).some((p) => p.materialId === "tape"));
ok("the pre-fill carries name, unit, level and threshold", (() => { const t = pre.find((p) => p.materialId === "tape"); return t.itemName === "Painter's tape" && t.unit === "roll" && t.level === 3 && t.threshold === 6; })());
ok("junk in, nothing out", lowStockPrefills(null).length === 0 && lowStockPrefills([{ belowThreshold: true }]).length === 0);

// ═══════════════════════════════════════════════════════════════════════════
section("4. The phone form's body");
// ═══════════════════════════════════════════════════════════════════════════

const materials = [{ id: "tape", name: "Painter's tape", unit: "roll" }];
ok("a stock item fills its own name and unit", (() => { const r = normaliseRequest({ materialId: "tape", quantity: "6" }, { materials }); return r.row?.itemName === "Painter's tape" && r.row.unit === "roll" && r.row.quantity === 6; })());
ok("a foreign material id is refused", Boolean(normaliseRequest({ materialId: "other", quantity: 1 }, { materials }).error));
ok("free text needs a name", Boolean(normaliseRequest({ quantity: 1 }, { materials }).error) && normaliseRequest({ itemName: "  Roller covers ", quantity: 4, unit: "ea" }, { materials }).row?.itemName === "Roller covers");
ok("zero, negative, NaN and absurd quantities are refused", ["0", "-2", "abc", "1e9"].every((q) => Boolean(normaliseRequest({ itemName: "x", quantity: q }).error)));
ok("a bad date is refused, a good one kept", Boolean(normaliseRequest({ itemName: "x", quantity: 1, neededBy: "tomorrowish" }).error) && normaliseRequest({ itemName: "x", quantity: 1, neededBy: "2026-09-22" }).row.neededBy instanceof Date);
ok("an http photo is dropped, an https one kept", normaliseRequest({ itemName: "x", quantity: 1, photoUrl: "http://x/a.jpg" }).row.photoUrl === null && normaliseRequest({ itemName: "x", quantity: 1, photoUrl: "https://x/a.jpg" }).row.photoUrl === "https://x/a.jpg");
ok("an invented source becomes field", normaliseRequest({ itemName: "x", quantity: 1, source: "magic" }).row.source === "field");
ok("the note is clipped", normaliseRequest({ itemName: "x", quantity: 1, note: "n".repeat(5000) }).row.note.length === 1000);
ok("shapeRequest turns the Decimal into a number and adds nothing private", (() => { const s = shapeRequest({ id: "a", quantity: "2.500", requestedBy: { name: "Marco" }, job: { title: "J" } }); return s.quantity === 2.5 && s.requestedByName === "Marco" && s.jobTitle === "J" && !("company" in s); })());

// ═══════════════════════════════════════════════════════════════════════════
section("5. The route: one transaction, re-read first, no level edited");
// ═══════════════════════════════════════════════════════════════════════════

const route = read("app/api/supply-requests/[id]/route.js");
const patch = route.slice(route.indexOf("export async function PATCH"));
ok("the status move and the movement are one $transaction", /db\.\$transaction\(async \(tx\)/.test(patch) && /tx\.stockMovement\.create/.test(patch) && /tx\.supplyRequest\.update/.test(patch));
ok("the row is re-read inside the transaction before the move", patch.indexOf("tx.supplyRequest.findUnique") < patch.indexOf("tx.stockMovement.create") && /transition\(fresh\?\.status, to\)/.test(patch));
ok("a request already carrying a movement id is refused", /fresh\.restockMovementId\) throw/.test(patch));
ok("the material is re-read inside this company before the movement", /tx\.material\.findFirst\(\{\s*where: \{ id: movement\.materialId, companyId: member\.companyId \}/.test(patch));
ok("a P2002 on the ref answers 409, not a second delivery", /P2002/.test(patch) && /409/.test(patch));
ok("nothing here edits a stock level", !/material\.update|quantityOnHand|level:/.test(patch));
ok("ordered and restocked need purchasing; the requester may cancel their own", /to === "cancelled" \? !\(office \|\| mine\) : !office/.test(patch));
ok("the two answers narrow to the requester", /recipientUserIds: \[updated\.requestedById\]/.test(patch));
const list = read("app/api/supply-requests/route.js");
ok("a member without purchasing sees only their own requests", /requestedById: member\.userId/.test(list) && /scope: office \? "company" : "mine"/.test(list));
ok("a request's job is scoped to the caller's assigned jobs", /assignedJobWhere\(full\)/.test(list));
ok("the low-stock source may only be claimed by purchasing", /row\.source === "field" \|\| hasLevel\(full, PURCHASING_CATEGORY, PURCHASING_LEVEL\) \? row\.source : "field"/.test(list));
ok("the office is notified on creation", /type: "supply\.requested"/.test(list));

// ═══════════════════════════════════════════════════════════════════════════
section("6. The notifications");
// ═══════════════════════════════════════════════════════════════════════════

for (const type of ["supply.requested", "supply.ordered", "supply.restocked"]) {
  ok(`${type} is in the catalogue and sound`, NOTIFICATION_TYPES[type] && typeProblems(type).length === 0, typeProblems(type)?.join("; "));
  ok(`${type} has an English and a French sentence`, typeof APP_MESSAGES.en[`app.notif.type.${type}`] === "string" && typeof APP_MESSAGES.fr[`app.notif.type.${type}`] === "string");
  ok(`${type} resolves to a destination`, hrefFor({ entityType: NOTIFICATION_TYPES[type].entityType, entityId: "x" }) !== null);
}
ok("the office's row opens the Requests tab", hrefFor({ entityType: "supplyRequest", entityId: "x" }) === "/app/purchasing?tab=requests");
ok("the requester's row opens their own requests", hrefFor({ entityType: "mySupplyRequest", entityId: "x" }) === "/app/me/supplies");
ok("the request lands on purchasing's rung", JSON.stringify(NOTIFICATION_TYPES["supply.requested"].audience) === JSON.stringify({ category: "expenses", level: "view_record_edit_all" }));
ok("the Purchasing page reads ?tab=requests", /get\("tab"\)/.test(read("app/app/purchasing/page.js")));
ok("the More sheet links to the phone form", /\/app\/me\/supplies/.test(read("app/app/me/more/page.js")));
ok("the job's materials card links to the phone form with the job", /\/app\/me\/supplies\?jobId=/.test(read("app/components/jobs/JobMaterials.js")));

console.log(`\n${checks} checks, ${failures} failed`);
process.exit(failures ? 1 : 0);
