// lib/lifecycle/facts.js
//
// What the trial sequence needs to know about ONE company, read in the request
// that decides — never cached, never from an earlier run. Every read names
// companyId itself (the tenant boundary); `client` is injectable so the check
// runs it against a stub that records every where-clause and refuses any
// other company's id.
//
// ══ Where each "done" comes from ══════════════════════════════════════════
//
//   payments     Company.stripeChargesEnabled — the onboarding checklist's own
//                "payments" step (lib/onboarding.js), the same column.
//   booking      bookable hours (AvailabilitySchedule) for an active member —
//                the "availability" set-up step's own measurement
//                (lib/setupStepsSnapshot.js) — AND a business profile the
//                public page will serve (lib/company/profileReadiness.js;
//                lib/booking/findBookingCompany.js answers "not found"
//                without it) AND a slug to put in the link. The event type
//                is created on the first read of the booking page
//                (lib/booking/bookableMembers.js), so hours are the switch.
//   first quote  the earliest Quote.sentAt — a quote that was SENT, not a
//                draft. Not a checklist step anywhere; derived from the data.
//   import       there is no record of an import, so it is derived from the
//                one thing only a bulk insert leaves behind: two or more of
//                the company's clients created in the same second. The CSV
//                import (app/api/clients/import) is the only createMany on
//                Client in this codebase; nobody adds two clients by hand in
//                one second. A company with a big hand-typed list is not
//                "imported" by this test and gets the nudge — the honest
//                failure, since the nudge is about the CSV path.

import { db as realDb } from "@/lib/db";
import { clientFacingGaps } from "@/lib/company/profileReadiness";
import { bookingPageUrl } from "@/lib/reviews/googleBusiness/bookButton";

/** Clients sharing one second of createdAt — the import's fingerprint (see the header). Literal in the SQL below; the check holds them equal. */
export const IMPORT_SAME_SECOND_MIN = 2;

/** Every Company column the plan, the facts and the letters read. One select, used before and after the claim. */
export const LIFECYCLE_COMPANY_SELECT = Object.freeze({
  id: true,
  name: true,
  email: true,
  isDemo: true,
  createdAt: true,
  timezone: true,
  defaultLanguage: true,
  industries: true,
  country: true,
  slug: true,
  bookingSlug: true,
  trialEndsAt: true,
  platformEndsAt: true,
  offerFinancing: true,
  stripeChargesEnabled: true,
  nextStepsEmailSentAt: true,
  nextStepsEmailSkipped: true,
  trialReminder7At: true,
  trialReminder3At: true,
  trialReminder1At: true,
  subscription: { select: { id: true } },
  signupLead: { select: { firstName: true, trades: true } },
});

export async function loadLifecycleCompany(companyId, { client = realDb } = {}) {
  return client.company.findUnique({ where: { id: companyId }, select: LIFECYCLE_COMPANY_SELECT });
}

/**
 * @param company  a LIFECYCLE_COMPANY_SELECT row
 * @param origin   the app origin, for the booking link
 * @returns { paymentsDone, bookingLive, bookingUrl, firstQuoteSentAt, clientsImported }
 */
export async function loadLifecycleFacts(company, { origin, client = realDb } = {}) {
  const companyId = company.id;
  const [bookableRows, firstQuote, sameSecond] = await Promise.all([
    client.availabilitySchedule.count({
      where: { user: { memberships: { some: { companyId, active: true } } } },
    }),
    client.quote.findFirst({
      where: { companyId, sentAt: { not: null } },
      orderBy: { sentAt: "asc" },
      select: { sentAt: true },
    }),
    client.$queryRaw`SELECT 1 AS hit FROM "Client" WHERE "companyId" = ${companyId} GROUP BY date_trunc('second', "createdAt") HAVING count(*) >= 2 LIMIT 1`,
  ]);
  const bookingUrl = bookingPageUrl(origin, company);
  const profileReady = clientFacingGaps(company).length === 0;
  return {
    paymentsDone: company.stripeChargesEnabled === true,
    bookingLive: Number(bookableRows) > 0 && profileReady && Boolean(bookingUrl),
    bookingUrl,
    firstQuoteSentAt: firstQuote?.sentAt || null,
    clientsImported: Array.isArray(sameSecond) && sameSecond.length > 0,
  };
}

/** The person the sequence writes to: the company's first active owner, with their own address and language. */
export async function lifecycleRecipient(companyId, { client = realDb } = {}) {
  const member = await client.member.findFirst({
    where: { companyId, role: "owner", active: true },
    orderBy: { createdAt: "asc" },
    select: { user: { select: { id: true, email: true, name: true, language: true } } },
  });
  return member?.user || null;
}
