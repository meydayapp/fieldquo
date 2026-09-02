// scripts/seed-sales-capabilities.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/seed-sales-capabilities.mjs
//
// Writes the sales-intelligence configuration: the FieldQuo capability matrix,
// the starter opportunity rules, and the confidence weights.
//
// Additive and idempotent — see seedIntelConfig's own header for exactly what a
// re-run refreshes (the derived caveats and classifications) and what it leaves
// alone (a superadmin's priorities, their switched-off capabilities, their
// edited talking points, their tuned weights). It deletes nothing.
//
// The alias loader is required rather than optional: lib/sales/intel/db.js
// imports "@/lib/db", and AGENTS.md's note about bare node not resolving the
// alias is why scripts/alias-loader.mjs exists instead of a rewritten specifier
// that breaks the next time the file gains an import.
import "dotenv/config";
import { seedIntelConfig } from "@/lib/sales/intel/db";

const counts = await seedIntelConfig({ log: (line) => console.log(line) });

console.log(
  `capabilities: ${counts.capabilities.created} created, ${counts.capabilities.updated} refreshed`,
);
console.log(`rules:        ${counts.rules.created} created, ${counts.rules.updated} refreshed`);
console.log(`signals:      ${counts.signals.created} created, ${counts.signals.updated} refreshed`);
console.log("0 deleted");
process.exit(0);
