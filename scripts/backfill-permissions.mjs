// scripts/backfill-permissions.mjs
//
// Gives every member without a permissions grid one derived from their role.
//
// Why this is needed: enforce.js treats a null `permissions` as "fall back to
// coarse role behaviour" — deliberately, because defaulting existing members
// to no-access would lock working accounts out the moment enforcement
// deployed. The cost is that enforcement only bites once someone has been
// explicitly configured, so an untouched employee still passes every granular
// check.
//
// This closes that, once, on purpose:
//
//   employee   -> workerFullView   (can see clients and pricing, edits nothing)
//   supervisor -> dispatcher       (edits jobs, clients and quotes)
//   admin      -> untouched        (PERMISSIONS.admin is ["*"]; the grid
//                                   doesn't constrain them)
//   owner      -> untouched        (same)
//
// employee maps to workerFullView rather than the stricter `worker` preset on
// purpose. `worker` hides pricing entirely, and silently hiding prices from
// someone who has been quoting all year is a support call, not a security
// win. Companies that want the tighter preset can set it per member.
//
//   npx tsx scripts/backfill-permissions.mjs           # dry run
//   npx tsx scripts/backfill-permissions.mjs --apply   # write

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
// Namespace import, not a named one. package.json has no "type": "module",
// so tsx transpiles lib/permissions.js to CommonJS, and Node's CJS→ESM
// interop detects named exports by static analysis that misses some patterns
// — producing "does not provide an export named PERMISSION_PRESETS" even
// though it plainly does. Reading off the namespace happens at runtime.
import * as permissionsModule from "../lib/permissions.js";

const { PERMISSION_PRESETS } = permissionsModule;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL isn't set. Check your .env.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

const APPLY = process.argv.includes("--apply");

const ROLE_TO_PRESET = {
  employee: "workerFullView",
  supervisor: "dispatcher",
};

try {
  // Only members with no grid at all. Anyone already configured is left
  // alone — this must never overwrite a deliberate choice.
  const members = await db.member.findMany({
    where: {
      permissions: { equals: null },
      role: { in: Object.keys(ROLE_TO_PRESET) },
    },
    select: {
      id: true,
      role: true,
      companyId: true,
      user: { select: { email: true } },
    },
  });

  if (members.length === 0) {
    console.log("Nothing to backfill — every member already has a grid.");
  } else {
    const byRole = {};
    for (const m of members) byRole[m.role] = (byRole[m.role] || 0) + 1;

    console.log(
      `${members.length} member(s) without a permissions grid:` +
        Object.entries(byRole)
          .map(([r, n]) => `\n  ${r.padEnd(11)} ${n} -> ${ROLE_TO_PRESET[r]}`)
          .join(""),
    );

    if (!APPLY) {
      console.log("\nDry run. Re-run with --apply to write these.");
    } else {
      let updated = 0;
      for (const m of members) {
        const preset = PERMISSION_PRESETS[ROLE_TO_PRESET[m.role]];
        if (!preset) continue;
        await db.member.update({
          where: { id: m.id },
          data: { permissions: preset.values },
        });
        updated++;
      }
      console.log(`\nUpdated ${updated} member(s).`);
      console.log(
        "Granular enforcement is now active for them. Review anyone who " +
          "needs more access in Settings > Manage Team.",
      );
    }
  }
} finally {
  await db.$disconnect();
  await pool.end();
}
