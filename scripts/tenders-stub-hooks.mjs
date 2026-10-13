// scripts/tenders-stub-hooks.mjs
//
// For scripts/check-tenders.mjs: points the specifiers a tender route reaches
// for at in-memory fixtures, so the check EXECUTES the real route handlers —
// status codes, tenant scoping, redaction — without a database or a session.
//
//   @/lib/db             scripts/fixtures/tendersDb.mjs (an in-memory store
//                        that enforces the two things the routes lean on:
//                        update-by-{id, companyId} and the TenderReminder
//                        unique index)
//   @/lib/apiMember      the shared scripted session (apiMemberStub.mjs)
//   @/lib/activity/log   a recorder — the audit row is not under test here
//   @/lib/jobs/createJob a recorder that writes a Job row — createJob itself
//                        geocodes, attaches waivers and checklists, all of
//                        which have their own checks; what is under test is
//                        that the tender route calls it once, with the
//                        tender's client and quote
//
// Everything else — lib/tenders/*, the permission grid, assertOwnedIds, the
// status table, the ICS builder — is the shipped file.
import { pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

const HERE = resolvePath(dirname(new URL(import.meta.url).pathname));
const fx = (name) => pathToFileURL(join(HERE, "fixtures", name)).href;

const MAP = {
  "@/lib/db": fx("tendersDb.mjs"),
  "@/lib/apiMember": fx("apiMemberStub.mjs"),
  "@/lib/activity/log": fx("tendersActivityStub.mjs"),
  "@/lib/jobs/createJob": fx("tendersCreateJobStub.mjs"),
};

export async function resolve(specifier, context, nextResolve) {
  if (Object.prototype.hasOwnProperty.call(MAP, specifier)) return { url: MAP[specifier], shortCircuit: true };
  if (specifier === "next/server") return nextResolve("next/server.js", context);
  return nextResolve(specifier, context);
}
