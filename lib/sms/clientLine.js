// lib/sms/clientLine.js
//
// Which number a company's CLIENT texts leave from — and, going the other
// way, which company a text arriving at a number belongs to.
//
// ══ The gap this closes ════════════════════════════════════════════════════
//
// app/api/sms/inbound resolves a STOP by matching Twilio's `To` against
// Company.smsFromNumber. Nothing writes that column. Grep for it: the schema,
// the inbound route, the reminder cron reading it as a `from`, and this file.
// No settings screen, no provisioning path — the crew line (CrewInboxNumber)
// and the receptionist's number (VoicePhoneNumber, which cannot text at all)
// are different tables for different jobs, and neither touches it. So every
// company texts its clients from FieldQuo's shared system number
// (lib/sms/systemNumber.js), a STOP comes back to that number, the lookup
// finds no company, the sales handler finds no sales number, and the reply
// is dropped with a 200. "Reply STOP to opt out" is on every reminder and
// has never once worked.
//
// ══ Resolving the shared number ════════════════════════════════════════════
//
// One number, every tenant: `To` alone cannot name the company. What can is
// the SENDER — the homeowner's own phone — because the only companies that
// could have texted it from the shared line are the ones holding it on a
// client record. So a STOP to the shared number opts that phone out of
// every company that has it on file, which is also the only honest reading
// of "stop texting me" sent to a number that texts on behalf of many.
//
// Deliberately every holder rather than "the most recent sender": no table
// records which tenant last texted which phone, and inventing one to narrow
// a suppression is inventing a reason to keep texting somebody who said
// stop. START reverses it the same way, for the same set.
//
// ══ The From is decided here too ═══════════════════════════════════════════
//
// Both client-text senders — the on-my-way route and the reminder cron — ask
// clientSmsFrom() for their `from`, so the number a company sends from and
// the number this file resolves inbound are one decision. The reminder cron
// already passed smsFromNumber; the on-my-way route passed nothing, which
// meant a company that ever DID get its own number would still text "on my
// way" from the shared line and get its STOPs filed against strangers.

import { db } from "@/lib/db";
import { toE164 } from "@/lib/sms/twilioClient";
import { systemSmsNumber } from "@/lib/sms/systemNumber";

/**
 * The `from` for a client-facing text on behalf of `company`.
 *
 * The company's own SMS-capable number when one has been bought or hosted
 * for it (Company.smsFromNumber), else undefined — which sendSms resolves to
 * the shared system number. Never a number typed by hand: carriers refuse a
 * send from a number the account does not own.
 */
export function clientSmsFrom(company) {
  const own = String(company?.smsFromNumber || "").trim();
  return own || undefined;
}

/**
 * The digits a client-record phone is matched on: the national number, so
 * "(555) 019-9123", "555-019-9123" and "+15550199123" are one phone.
 *
 * Ten trailing digits rather than the whole E.164 because Client.phone is
 * free text and toE164 is North-American-only (see twilioClient.js); the
 * comparison is done on digits stripped in SQL, and the country code is the
 * part most often left off by hand.
 */
export function nationalDigits(phone) {
  const e164 = toE164(phone);
  const digits = String(e164 || phone || "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : null;
}

/**
 * Which tenants an inbound text at `to` from `from` belongs to. Pure.
 *
 * @param {object} args
 * @param {object|null} args.dedicatedCompany  the Company whose smsFromNumber is `to`
 * @param {string}      args.to
 * @param {string|null} args.systemNumber      the shared line, or null when none
 * @param {Array}       args.holders           companies with `from` on a client record
 * @returns {{ kind: "dedicated"|"shared"|"none", companies: Array<{id, name}> }}
 */
export function tenantsForInbound({ dedicatedCompany, to, systemNumber, holders = [] }) {
  if (dedicatedCompany?.id) return { kind: "dedicated", companies: [dedicatedCompany] };
  const shared =
    !!systemNumber && !!to && toE164(systemNumber) != null && toE164(systemNumber) === toE164(to);
  if (!shared) return { kind: "none", companies: [] };
  // De-duplicated by id: a client entered twice at one company is one tenant.
  const seen = new Map();
  for (const c of holders) if (c?.id && !seen.has(c.id)) seen.set(c.id, c);
  return { kind: "shared", companies: [...seen.values()] };
}

/**
 * The companies holding `phone` on a client record.
 *
 * Postgres strips the formatting, not the application: Client.phone is free
 * text with no normalised twin, and pulling every client row to compare in
 * JS would be a table scan on every inbound STOP. `regexp_replace` on the
 * column is still a scan, but it is one query returning ids, and STOP is
 * rare. The parameter is the ten national digits — never the raw body.
 */
export async function companiesHoldingPhone(phone) {
  const digits = nationalDigits(phone);
  if (!digits) return [];
  const rows = await db.$queryRaw`
    SELECT DISTINCT co.id, co.name
    FROM "Client" c
    JOIN "Company" co ON co.id = c."companyId"
    WHERE c.phone IS NOT NULL
      AND regexp_replace(c.phone, '\\D', '', 'g') LIKE ${"%" + digits}
  `;
  return Array.isArray(rows) ? rows : [];
}

/**
 * Resolve an inbound text to its tenants: the dedicated owner of `to`, else
 * every holder of `from` when `to` is the shared line, else nobody.
 */
export async function resolveInboundTenants({ to, from }) {
  const dedicatedCompany = await db.company.findUnique({
    where: { smsFromNumber: to },
    select: { id: true, name: true },
  });
  if (dedicatedCompany) return tenantsForInbound({ dedicatedCompany, to, systemNumber: null });

  const systemNumber = await systemSmsNumber();
  const shared = tenantsForInbound({ dedicatedCompany: null, to, systemNumber, holders: [] });
  if (shared.kind !== "shared") return shared;

  const holders = await companiesHoldingPhone(from);
  return tenantsForInbound({ dedicatedCompany: null, to, systemNumber, holders });
}
