// lib/sales/contactBasis.js
//
// Where a contact came from, and whether that is consent.
//
// ══ Why this is its own file, with NO imports ══════════════════════════════
//
// It began inside suppressionRules.js, which is where the rule belongs
// conceptually — and that file imports `toE164` from lib/voice/numbers.js,
// which imports lib/db.js, which imports `pg`. lib/sales/prospectView.js needs
// this rule to render "email is closed on this record", and prospectView is
// imported by app/sales/queue/page.js, which is a CLIENT component. The result
// was a build failure with seven errors, the first of which was Turbopack
// trying to resolve Node's `dns` module for the browser.
//
// So the rule lives here, importing nothing, and suppressionRules.js
// re-exports it. There is still exactly one definition of what the law
// permits; it is simply somewhere both a server gate and a client screen can
// reach without dragging a Postgres driver into the browser.

//
// ══ CASL, stated plainly ═══════════════════════════════════════════════════
//
// Canada's Anti-Spam Legislation governs COMMERCIAL ELECTRONIC MESSAGES —
// email and SMS. It does not govern a live two-way voice call, which is why
// this section closes two channels and not three; a call is governed by the
// CRTC's Unsolicited Telecommunications Rules, and by the internal do-not-call
// obligation the rest of this file already implements.
//
// A CEM needs consent, express or implied. The implied route that looks like
// it fits a published business address is s.10(9)(b): consent is implied where
// the recipient has CONSPICUOUSLY PUBLISHED the address, without a statement
// that they do not want unsolicited messages, and the message is relevant to
// their business role.
//
// It does not fit, and it fails on both halves. The CRTC's own CASL FAQ, which
// is the regulator interpreting its own statute:
//
//   "A 'conspicuous publication' online entails that the electronic address is
//    directly available to the public because it is typically indexed by a
//    search engine. Therefore, an electronic address that requires specific
//    queries in a corporate database to be found is not conspicuously
//    published."
//
// A 10.8 MB zip behind an open-data portal is the second description. And on
// who did the publishing:
//
//   "However, if a third party were to reproduce this address or sell a list of
//    such addresses on its own initiative, this would not create implied
//    consent on its own, because in that instance neither the account holder
//    nor the message recipient would be publishing the address, or be causing
//    it to be published."
//
// s.10(9)(b) requires that the RECIPIENT "has conspicuously published, or has
// caused to be conspicuously published" the address. In this file the Régie
// publishes it, as a condition of licensing; the contractor neither published
// it nor caused it to be published. s.10(9)(c) fails for the same reason — the
// address was disclosed to the RBQ, not to FieldQuo — and there is no existing
// business relationship with a cold prospect.
//
// The onus is on us, not on them: "if relying on conspicuous publication, the
// sender has the responsibility of demonstrating... how its situation meets the
// criteria." There is no demonstration available here.
//
// ══ What the address MAY be used for ═══════════════════════════════════════
//
// Storing it is fine and it is not dropped. CC-BY grants the copy, and the
// address does real work that is not sending: it deduplicates a licence
// against a row already in the bank, it matches a domain, and it lets a rep
// recognise which business they are looking at. What it is not is a mailing
// list. The whole risk is that 45,831 stored addresses LOOK like one.
//
// So: an address obtained from a licence register is NOT consent to email or
// text, and 45,831 addresses being technically available changes nothing about
// that. The register is a phone source. This is the difference between what a
// dataset's LICENCE permits (CC-BY: copy it, redistribute it, use it
// commercially) and what the LAW permits you to do with the people in it, and
// conflating the two is how a compliant company sends 45,000 illegal emails.
//
// ══ Why "undetermined" is a third value ════════════════════════════════════
//
// Overture's rows come from directory listings a business often published
// itself, which is a genuinely different question with a genuinely different
// answer, and nobody has measured it. Recording that as "permitted" would be
// inventing a legal position; recording it as "prohibited" would silently stop
// sends that may be perfectly lawful. So it is `undetermined`, it blocks
// nothing, and it is rendered on screen as an open question — the same
// three-valued honesty `hasWebsite` gets for the same reason.

/** What a source's provenance says about contacting the people in it. */
export const CONTACT_BASIS_STATES = ["permitted", "prohibited", "undetermined"];

/**
 * Per discovery provider, per channel.
 *
 * Keyed on `Prospect.sourceProvider`. A provider that is not listed here
 * returns `undetermined` for every channel, which blocks nothing — this is a
 * deny-list where an entry is a positive legal finding, not a permission
 * system where absence means yes. That is deliberate and it is also why this
 * cannot be the only control: it stops what it knows about and says so.
 */
export const SOURCE_CONTACT_BASIS = {
  rbq: {
    label: "Quebec RBQ licence register",
    email: {
      state: "prohibited",
      reason:
        "This email address came from Quebec's RBQ licence register. A business discloses it to the " +
        "regulator to hold a licence; it has not conspicuously published it, so CASL implies no consent " +
        "and FieldQuo may not email it. Call instead — the register is a phone source.",
    },
    sms: {
      state: "prohibited",
      reason:
        "Texting is a commercial electronic message under CASL, and a number from Quebec's RBQ licence " +
        "register carries no implied consent to receive one. Call instead.",
    },
    phone: {
      state: "permitted",
      reason:
        "CASL does not govern live voice calls. A business-to-business call is exempt from the National " +
        "DNCL but NOT from FieldQuo's internal do-not-call list, which is checked separately, nor from " +
        "the CRTC's calling-hours and identification rules.",
    },
  },
  overture: {
    label: "Overture Places",
    email: { state: "undetermined", reason: "Nobody has established what consent, if any, an Overture listing carries." },
    sms: { state: "undetermined", reason: "Nobody has established what consent, if any, an Overture listing carries." },
    phone: {
      state: "permitted",
      reason:
        "CASL does not govern live voice calls, and a business-to-business call is exempt from the " +
        "National DNCL. FieldQuo's internal list and the CRTC's calling hours still apply.",
    },
  },
};

/**
 * What the law says about reaching this contact on this channel, given where
 * the record came from.
 *
 * Pure, and separate from the suppression list on purpose: a suppression is
 * something a PERSON asked for, and this is something the source's provenance
 * decides before anybody has said anything at all. Both close a channel; only
 * one of them is a request, and a screen that showed them as the same thing
 * would tell a rep somebody had opted out when nobody had.
 */
export function contactBasisFor(sourceProvider, channel) {
  const source = SOURCE_CONTACT_BASIS[sourceProvider];
  const declared = source?.[channel];
  if (!declared) {
    return {
      state: "undetermined",
      reason: null,
      sourceLabel: source?.label || null,
    };
  }
  return { state: declared.state, reason: declared.reason, sourceLabel: source.label };
}

