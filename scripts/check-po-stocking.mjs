// scripts/check-po-stocking.mjs
//
//   node scripts/check-po-stocking.mjs
//
// A purchase order received in full has to put something on the shelf.
//
// ── Why this exists ──────────────────────────────────────────────────────
//
// app/api/purchase-orders/[id]/receive/route.js writes a StockMovement for
// every received line that carries a materialId — correct code, and for the
// whole life of the feature unreachable, because the order form never set a
// materialId on anything. Every line arrived as free text, the order lit up
// "9 of 9 lines fully in · All in", and the Stock tab stayed empty. Measured,
// not guessed: one company's PO-001, nine real products, 0 of 9 lines linked,
// 0 stock movements.
//
// That is a control that appears to work and does not, which AGENTS.md names
// first. So: the form states the buyer's intent per line, the create route
// turns that intent into a shelf, and the receive route stocks it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const fails = [];
const ok = (label, cond, detail = "") => {
  if (cond) pass += 1;
  else fails.push(`${label}${detail ? ` — ${detail}` : ""}`);
};

// ── The form says, per line, whether this is goods ───────────────────────
{
  const panel = read("app/components/purchasing/PurchaseOrdersPanel.js");
  ok(
    "a new order line is goods by default",
    /BLANK_LINE = \{[^}]*stock: true/.test(panel),
    "a default of false would quietly keep the shelf empty",
  );
  ok(
    "…and the buyer can say otherwise on the line",
    /checked=\{line\.stock !== false\}/.test(panel) && /stock: e\.target\.checked/.test(panel),
    "a delivery charge has nothing to put away",
  );
  ok(
    "…with the toggle named in the catalogue, not hard-coded",
    /t\("app\.purchasing\.orders\.lineStock"\)/.test(panel),
  );
  ok(
    "…and the screen explains what ticking it does",
    /t\("app\.purchasing\.orders\.stockNote"\)/.test(panel),
    "a checkbox whose effect is invisible is a guess",
  );
}

// ── The order gives every goods line a shelf ─────────────────────────────
{
  const route = read("app/api/purchase-orders/route.js");
  ok(
    "the order route resolves a material for a goods line",
    /if \(!line\.materialId && line\.stock\)/.test(route) && /findOrCreateMaterial\(/.test(route),
    "without this the receive route's stocking path is unreachable",
  );
  ok(
    "…through the shared rule, not a second copy",
    /from "@\/lib\/stock\/findOrCreateMaterial"/.test(route),
  );
  ok(
    "…and does not try to store the intent as a column",
    /delete line\.stock;/.test(route),
    "PurchaseOrderLine has no `stock` field",
  );
  ok(
    "…while still refusing another tenant's materialId",
    /refers to a material that isn't yours/.test(route),
    "find-or-create must not loosen the tenant check",
  );
}

// ── One find-or-create, not two ──────────────────────────────────────────
{
  const helper = read("lib/stock/findOrCreateMaterial.js");
  ok(
    "the shelf lookup is case-insensitive",
    /mode: "insensitive"/.test(helper),
    '"Frog tape" and "Frog Tape" are one roll',
  );
  ok("…and is scoped to the company", /companyId/.test(helper));

  const purchase = read("app/api/stock/purchase/route.js");
  ok(
    "buying for stock uses the same rule",
    /findOrCreateMaterial\(/.test(purchase),
  );
  ok(
    "…and no longer keeps its own copy of it",
    !/db\.material\.create\(/.test(purchase),
    "the copy nobody edits is the one that makes duplicate shelves",
  );
  // Extracting the lookup took `existing` out of scope, and two behaviours
  // were riding on it: a shelf with no unit learns one from the first
  // purchase that names it, and the response says whether the shelf is new.
  // Both are easy to drop silently when moving code, so both are asserted.
  ok(
    "…while a shelf with no unit still learns one",
    /!material\.created && !material\.unit && unit/.test(purchase),
    "a unit already on the row is the one the shelf was counted in",
  );
  ok(
    "…and the caller is still told whether the shelf is new",
    /created: material\.created/.test(purchase) && /created: true/.test(helper),
    "recomputing it with a second lookup would race",
  );
}

// ── Receiving still stocks ───────────────────────────────────────────────
{
  const receive = read("app/api/purchase-orders/[id]/receive/route.js");
  ok(
    "a received goods line writes a stock movement",
    /tx\.stockMovement\.create\(/.test(receive),
  );
  ok(
    "…and a line with no material is still skipped, not invented",
    /if \(!source\?\.materialId\) continue;/.test(receive),
    "the delivery charge has no shelf",
  );
}

// ── Nine languages, as always ────────────────────────────────────────────
{
  const msgs = read("app/i18n/appMessages.js");
  for (const key of ["lineStock", "stockNote"]) {
    const n = msgs.split(`"app.purchasing.orders.${key}"`).length - 1;
    ok(`"${key}" is translated in all nine catalogues`, n === 9, `found ${n}`);
  }
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  x ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
