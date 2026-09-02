// scripts/seed-sales-signatures.mjs
//
//   npm run seed:sales-signatures
//
// Writes the starter `TechnologySignature` rows — Jobber, Housecall Pro,
// ServiceTitan, Workiz, Markate and the adjacent tooling — so the detector has
// something to match against on a fresh database.
//
// This is the SECOND way in, not the only one: /platform/sales/signatures has
// a "Load the starter signatures" button that calls the same function, for the
// reason the capabilities route's own header gives — "ssh in and run a script"
// is not a control anybody can see. The script exists for a first deploy and
// for a machine with no session.
//
// Additive and idempotent. A signature that already exists keeps its patterns,
// its weights, its active flag and its competitor classification: those belong
// to whoever edited the screen, and a re-seed that reset them would make the
// screen a control that appears to work and doesn't. Only the display name is
// refreshed. It deletes nothing.
import "dotenv/config";
import { db } from "@/lib/db";
import { seedTechnologySignatures, unverifiedSignatures } from "@/lib/sales/intel/signatureSeed";

const counts = await seedTechnologySignatures({ db, log: (line) => console.log(line) });

console.log(`signatures: ${counts.created} created, ${counts.existing} left alone`);
console.log("0 deleted");

const unverified = unverifiedSignatures();
if (unverified.length) {
  console.log(
    `\n${unverified.length} shipped INACTIVE because the fingerprint could not be verified:`,
  );
  for (const s of unverified) console.log(`  - ${s.code} (${s.name})`);
  console.log("Read the reason on /platform/sales/signatures before switching one on.");
}

process.exit(0);
