// lib/sales/windowOverrides.js
//
// The database half of lib/sales/windowPolicy.js: the rows the resolver reads.
//
// Kept apart from the resolver so the resolver stays pure — the queue page
// runs it in the browser on a thirty-second timer, and the check script runs
// it under bare node, and neither can hold a Prisma client. This file is the
// only place the override table and the certificate table are read together
// for a dial, so every gate sees the same two lists at the same instant.
//
// ══ A failed read is "no overrides", never "no window" ═════════════════════
//
// If either table cannot be read, this returns empty lists and the resolver
// answers `enforce` for everything — today's behaviour. The other direction
// (a read failure switching windows off) would make a Neon cold start a
// compliance incident.
import { db } from "@/lib/db";
import { registeredKeys } from "./registrations";
import { windowPolicyFor } from "./windowPolicy";

/**
 * Everything the resolver needs, read once per request.
 *
 * @returns {{ overrides: object[], registeredKeys: string[], readError: string|null }}
 */
export async function loadWindowPolicyContext({ client = db, now = new Date() } = {}) {
  try {
    const [overrides, certificates] = await Promise.all([
      client.salesJurisdictionOverride.findMany({
        select: { country: true, region: true, mode: true, note: true, setById: true, updatedAt: true },
      }),
      client.salesTelemarketerRegistration.findMany({
        select: {
          jurisdictionKey: true,
          certificateNumber: true,
          registeredAt: true,
          expiresAt: true,
          revokedAt: true,
        },
      }),
    ]);
    return { overrides, registeredKeys: registeredKeys(certificates, now), readError: null };
  } catch (err) {
    console.error("[sales window policy] overrides could not be read; enforcing every window:", err?.message);
    return { overrides: [], registeredKeys: [], readError: err?.message || "unreadable" };
  }
}

/**
 * Load and resolve for one prospect in a single call — the shape the dial
 * route and the texting path want, which each judge exactly one record.
 */
export async function windowPolicyForProspect(prospect, { client = db, now = new Date() } = {}) {
  const context = await loadWindowPolicyContext({ client, now });
  return windowPolicyFor(prospect, context);
}
