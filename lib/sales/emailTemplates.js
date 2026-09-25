// lib/sales/emailTemplates.js
//
// The starting points a rep can drop into the compose box.
//
// ══ Three kinds, and where each one's words come from ═════════════════════
//
//   signup      the rep's own signup link — lib/sales/repStats.js's
//               signupLinkFor, the SAME link the Texts screen sends, so a
//               prospect who got it by text and by email got one link.
//   followUp    the plain "did you get a chance to look" — the message that
//               sends more than any other on a floor, written once here.
//   checkIn     the engine's drafts for this lead (SalesCheckIn, status
//               "draft") — the words lib/sales/checkin/draft.js already
//               wrote for a TEXT, offered as an email starting point. Not
//               sent, not marked, not touched: choosing one copies its text
//               into the box and the draft stays where it was, because the
//               text is still owed and the email is not it.
//
// The words are in the PROSPECT's language, which is the lead's — Quebec is
// French (lib/sales/leadLanguage.js), the rest is English — never the rep's
// interface language. A francophone rep writing to an Ontario roofer writes
// English. The rep edits before sending; nothing here sends.
//
// No model. Zero writes openers with an LLM (docs/sales-intel/ZERO-STUDY.md
// §7); a floor of six reps typing to contractors does not need to pay per
// sentence for "Hi Dana,".

import { signupLinkFor } from "./repStats";
import { repPublicName } from "./repIdentity";
import { isQuebec, FRENCH, ENGLISH } from "./leadLanguage";

const WORDS = {
  [ENGLISH]: {
    signupSubject: "Your FieldQuo signup link",
    signup: ({ first, link, rep }) =>
      `Hi ${first},\n\nAs promised, here is the link to start your FieldQuo account — the first month is free and there is nothing to install:\n\n${link}\n\nIt takes about five minutes. If anything is unclear, reply to this email and I'll walk you through it.\n\n${rep}`,
    followUpSubject: "Quick follow-up",
    followUp: ({ first, rep }) =>
      `Hi ${first},\n\nJust checking whether you had a chance to look at what I sent over. Happy to answer any questions, or to set up a short call whenever suits you.\n\n${rep}`,
    checkInLabel: "Check-in the engine drafted",
    signupLabel: "Signup link",
    followUpLabel: "Follow-up",
  },
  [FRENCH]: {
    signupSubject: "Votre lien d'inscription FieldQuo",
    signup: ({ first, link, rep }) =>
      `Bonjour ${first},\n\nComme promis, voici le lien pour créer votre compte FieldQuo — le premier mois est gratuit et il n'y a rien à installer :\n\n${link}\n\nÇa prend environ cinq minutes. Si quelque chose n'est pas clair, répondez à ce courriel et je vous guiderai.\n\n${rep}`,
    followUpSubject: "Petit suivi",
    followUp: ({ first, rep }) =>
      `Bonjour ${first},\n\nJe voulais simplement savoir si vous aviez eu le temps de regarder ce que je vous ai envoyé. Je réponds volontiers à vos questions, ou on peut prévoir un court appel quand ça vous convient.\n\n${rep}`,
    checkInLabel: "Suivi rédigé par le moteur",
    signupLabel: "Lien d'inscription",
    followUpLabel: "Suivi",
  },
};

/** The prospect's language, from the lead's row — Quebec is French. */
export function templateLanguageFor(lead) {
  return isQuebec(lead?.province) ? FRENCH : ENGLISH;
}

function firstNameOf(lead) {
  const name = String(lead?.contactName || "").trim();
  if (name) return name.split(/\s+/)[0];
  return String(lead?.businessName || "").trim() || "there";
}

/**
 * @param rep      { name, workName, linkCode } — `linkCode` is the rep's opaque
 *                 referralToken (lib/sales/repLink.js), never the legacy
 *                 name slug; the sign-off is the work name, else the first
 *                 name (lib/sales/repIdentity.js), never the full real name.
 * @param lead     { contactName, businessName, province }
 * @param origin   the app origin, for the signup link
 * @param checkIns the lead's open SalesCheckIn drafts — [{ id, draftText,
 *                 scheduledFor }]
 * @returns [{ key, label, subject, body }] — `subject` null means "keep
 *          what is in the box".
 */
export function emailTemplatesFor({ rep, lead, origin, checkIns = [] } = {}) {
  const language = templateLanguageFor(lead);
  const w = WORDS[language] || WORDS[ENGLISH];
  const first = firstNameOf(lead);
  const repName = String(repPublicName(rep) || "").trim();
  const out = [];

  const link = signupLinkFor(origin, rep?.linkCode);
  if (link) {
    out.push({
      key: "signup",
      label: w.signupLabel,
      subject: w.signupSubject,
      body: w.signup({ first, link, rep: repName }),
    });
  }
  out.push({
    key: "followUp",
    label: w.followUpLabel,
    subject: w.followUpSubject,
    body: w.followUp({ first, rep: repName }),
  });
  for (const c of Array.isArray(checkIns) ? checkIns : []) {
    const text = String(c?.draftText || "").trim();
    if (!text) continue;
    out.push({
      key: `checkIn:${c.id}`,
      label: w.checkInLabel,
      subject: null,
      body: `${text}\n\n${repName}`,
    });
  }
  return { language, templates: out };
}
