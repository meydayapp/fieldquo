// scripts/check-sales-calendar.mjs
//
//   npm run check:sales-calendar
//
// The rep calendar's contact rule, executed: what the rep TYPED wins, the
// linked lead's snapshot fills the blanks, and a re-snapshot happens only
// when the lead actually changes. The first version had the snapshot win on
// every save — the modal resends leadId each time — so a corrected phone
// number came back wrong, silently, and `website` could never be stored on a
// linked event. Found by the 6 September QA rerun, live.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contactFields, leadChanged, clean } from "../lib/sales/calendar/event.js";

let passed = 0;
let failed = 0;
function ok(name, cond, extra) {
  if (cond) passed += 1;
  else {
    failed += 1;
    console.error(`  ✗ ${name}`, extra === undefined ? "" : JSON.stringify(extra));
  }
}

const SNAP = { id: "lead1", businessName: "Acme Paint", contactName: "Sam", phone: "+16135550100", website: null };

// ── contactFields: typed wins, snapshot fills ───────────────────────────────
{
  const r = contactFields({ phone: "+16135550199", website: "https://acme.example" }, SNAP);
  ok("a typed phone beats the lead's phone", r.phone === "+16135550199", r);
  ok("a typed website is stored even though the lead has none", r.website === "https://acme.example", r);
  ok("fields the rep did not type come from the snapshot", r.businessName === "Acme Paint" && r.contactName === "Sam", r);
}
{
  const r = contactFields({ phone: "   ", businessName: "" }, SNAP);
  ok("blank typed values are blanks, so the snapshot fills them", r.phone === SNAP.phone && r.businessName === "Acme Paint", r);
}
{
  const r = contactFields({ phone: "+1 613 555 0100 x".repeat(10) }, null);
  ok("no snapshot: typed only, trimmed to the field's max", r.phone.length === 60 && r.website === null, r);
}
ok("no body, no snapshot: four nulls, no throw", JSON.stringify(contactFields(undefined, undefined)) === JSON.stringify({ businessName: null, contactName: null, phone: null, website: null }));
ok("a non-string typed value is not a value", contactFields({ phone: 12345, website: { x: 1 } }, SNAP).phone === SNAP.phone);
ok("clean() still trims and caps", clean("  hi  ", 1) === "h" && clean("", 5) === null && clean(null) === null);

// ── leadChanged: resend is not a change ─────────────────────────────────────
ok("leadId absent from the body: no change", leadChanged(undefined, "lead1") === false);
ok("the same leadId resent (what the modal does on every save): no change", leadChanged("lead1", "lead1") === false);
ok("a different leadId: change", leadChanged("lead2", "lead1") === true);
ok("null against a linked event: change (unlink)", leadChanged(null, "lead1") === true);
ok("empty string against a linked event: change (unlink)", leadChanged("", "lead1") === true);
ok("null against an unlinked event: no change", leadChanged(null, null) === false && leadChanged("", undefined) === false);
ok("a leadId against an unlinked event: change (link)", leadChanged("lead1", null) === true);

// ── The routes use them ─────────────────────────────────────────────────────
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
{
  const post = read("app/api/sales/events/route.js");
  ok("POST spreads contactFields(body, snapshot) into the create", /\.\.\.contactFields\(body, snapshot\)/.test(post));
  ok("POST no longer lets the snapshot win over the typed value", !/snapshot\?\.phone \?\? clean\(/.test(post));
  const patch = read("app/api/sales/events/[id]/route.js");
  ok("PATCH re-snapshots only when leadChanged()", /if \(leadChanged\(body\.leadId, existing\.leadId\)\)/.test(patch));
  ok("PATCH selects leadId and endAt on the existing row", /select: \{ id: true, startAt: true, endAt: true, leadId: true \}/.test(patch));
  ok("PATCH writes the id the rep-scoped lookup returned", /data\.leadId = snapshot\.id \?\? body\.leadId/.test(patch));
  ok("PATCH refuses a start moved past the standing end", /existing\.endAt\.getTime\(\) <= startAt\.getTime\(\)/.test(patch));
  ok("PATCH applies typed-or-snapshot per field, leaving unmentioned fields stored", /if \(body\[key\] !== undefined \|\| snapshot\) data\[key\] = typed\[key\];/.test(patch));
}

console.log(`\ncheck-sales-calendar: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
