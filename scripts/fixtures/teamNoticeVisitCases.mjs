// scripts/fixtures/teamNoticeVisitCases.mjs
//
// The inputs for scripts/check-team-notices.mjs's proof that moving the
// OFFICE's copy of a client-cancelled or client-moved visit onto FieldQuo's
// team-notice layout left the CLIENT's copy byte-for-byte alone. Both copies
// are built by one function (app/admin/lib/email/templates.js), so the only
// honest proof is the md5 of the client half, recorded before the office half
// moved (scripts/fixtures/teamNoticeVisitBaseline.json, taken at 23e59b4b9)
// and recomputed by the check with today's code.
//
// Every client language, both initiators, a refunded fee, a kept fee and no
// fee, and a hostile name — an escaping change would show here first.

const START = new Date("2026-08-27T14:00:00Z");
const PREV = new Date("2026-08-25T18:00:00Z");
const COMPANY = {
  id: "cmp_1",
  name: "Northline Refinishing & Sons",
  email: "office@northline.test",
  phone: "555-0100",
  currency: "CAD",
  timezone: "America/Toronto",
  defaultLanguage: "en",
  logoUrl: null,
  brandColor: "#1F6FEB",
};
const WHERE = { mode: "visit", address: "14 Maple St, Toronto", phone: "819-238-7263", email: "dana@example.test" };
const LANGS = ["en", "fr", "es", "it", "de", "uk", "pa", "tl"];

export const VISIT_CASES = [];
for (const language of LANGS) {
  for (const initiatedBy of ["client", "office"]) {
    for (const [feeName, refund] of [
      ["kept", { refunded: false, amountCents: 12000, currency: "cad", reason: "policy_off" }],
      ["refunded", { refunded: true, amountCents: 4900, currency: "cad", reason: "ok" }],
      ["none", {}],
    ]) {
      VISIT_CASES.push({
        name: `cancelled/${language}/${initiatedBy}/${feeName}`,
        kind: "cancelled",
        args: {
          company: { ...COMPANY, defaultLanguage: language === "en" ? "fr" : "en" },
          clientName: language === "en" ? "<b>Dana</b> O'Brien" : "Dana Brien",
          clientEmail: "dana@example.test",
          eventTypeName: "On-site estimate",
          officeEventTypeName: "Estimate visit",
          startTime: START,
          where: WHERE,
          timezone: "America/Toronto",
          quoteNumber: "Q-2026-0042",
          language,
          initiatedBy,
          refund,
        },
      });
    }
    VISIT_CASES.push({
      name: `moved/${language}/${initiatedBy}`,
      kind: "moved",
      args: {
        company: COMPANY,
        clientName: "Dana Brien",
        clientEmail: "dana@example.test",
        eventTypeName: "On-site estimate",
        officeEventTypeName: "Estimate visit",
        previousStartTime: PREV,
        startTime: START,
        where: WHERE,
        timezone: "America/Toronto",
        arrivalWindowMinutes: language === "fr" ? 120 : 0,
        manageUrl: "https://app.fieldquo.com/visit/tok_abcdefghijklmnop",
        quoteNumber: "Q-2026-0042",
        language,
        initiatedBy,
      },
    });
  }
}
