// lib/followUps/defaults.js
//
// FieldQuo's own follow-up rules: 1, 7 and 14 days after a quote is sent.
//
// ── Why these exist ─────────────────────────────────────────────────────────
//
// The cron (app/api/cron/follow-ups/route.js) and the settings page have been
// live for months, and on 2026-09-19 FollowUpRule held ZERO rows for every
// company. Nothing seeded a rule, so no homeowner had ever received an
// automated chase — the automation was a page full of controls that a company
// had to discover, understand and assemble from parts before it did anything.
// The owner's instruction: "confirm that we have automated follow-ups 1 day
// and 7 days and 14 days to the client — the company should be able to turn
// it off and create different settings in that page."
//
// So every company now gets these three, on by default, and the page shows
// them as "FieldQuo default" with a switch, an editable delay, a template
// picker and "Reset to default". A company that deletes one keeps it deleted
// (FollowUpRule.deletedAt — see the schema comment for why a tombstone and not
// a set on Company).
//
// ── The wording is the client's language, not the company's ────────────────
//
// A built-in rule has no DocumentTemplate. Its wording lives here, in the
// three languages FieldQuo's product copy is written in, and the cron renders
// it in whatever resolveClientLanguage() answers for the quote — the quote's
// own language first, exactly as the covering email that carried the quote
// (AGENTS.md non-negotiable 6). A client whose language is not one of these
// three gets emailCopy's generic follow-up line in their language rather than
// English day-specific copy; the English is never sent to a Ukrainian reader
// just because the Ukrainian is shorter.
//
// The register is the intro email's (lib/email/quoteEmail.js): short, plain,
// one thing to do. The whole message is a greeting, one or two sentences, the
// button to the quote, and the same footer the quote email carries — rendered
// through the same shell (lib/email/documentEmailLayout.js) so the chase is
// unmistakably from the company that sent the quote.
//
// Pure apart from ensureDefaultFollowUps() and resetBuiltInRule(), which take
// the db as an argument so scripts/check-follow-up-defaults.mjs can execute
// them against a fake.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { documentLabels } from "@/lib/i18n/documentLabels";
import {
  documentEmailHtml,
  emailButton,
  escapeHtml,
  EMAIL_FONT,
} from "@/lib/email/documentEmailLayout";
import {
  BUILT_IN_COPY,
  LEAD_COPY,
  BUILT_IN_LANGUAGES,
  BUILT_IN_KEYS,
  LEAD_KEYS,
  builtInCopyKind,
} from "./defaultCopy.js";

export { BUILT_IN_LANGUAGES, BUILT_IN_KEYS, LEAD_KEYS, builtInCopyKind };

/** The trigger the QUOTE built-ins ride. The cron's quote finder owns the stop conditions. */
export const BUILT_IN_TRIGGER = "quote_no_response";

/**
 * The trigger the ENQUIRY built-ins ride (2026-11-02).
 *
 * The trigger itself is not new — `lead_no_response` has been in
 * SUPPORTED_TRIGGERS and in the cron's FINDERS for weeks. What was missing is
 * any rule using it: 114 FollowUpRule rows across 38 companies, every one of
 * them on a quote, an invoice or a job. So the one finder that starts BEFORE a
 * quote exists had nothing to find for, and an enquiry nobody answered was
 * chased by nothing at all.
 */
export const LEAD_TRIGGER = "lead_no_response";

// Order matters: this is the order the page lists them and the order the
// backfill creates them in.
export const BUILT_IN_FOLLOW_UPS = Object.freeze([
  {
    key: "quote_sent_d1",
    name: "Day 1 — did the quote arrive?",
    delayValue: 1,
    delayUnit: "days",
  },
  {
    key: "quote_sent_d7",
    name: "Day 7 — any questions?",
    delayValue: 7,
    delayUnit: "days",
  },
  {
    key: "quote_sent_d14",
    name: "Day 14 — still here if you want to go ahead",
    delayValue: 14,
    delayUnit: "days",
  },
]);

// ── The three enquiry chases ───────────────────────────────────────────────
//
// 1, 3 and 7 days after an enquiry arrives that is still at status "new" with
// no quote on it (the cron's findLeadNoResponse owns the stop conditions).
//
// ── Tighter than the quote chase, on purpose ──────────────────────────────
//
// The quote chase runs 1 / 7 / 14 because a homeowner holding a price is
// deciding, and deciding takes weeks. An enquiry is the opposite: the person
// is comparing contractors right now and will have booked somebody by the end
// of the week. The agency whose leads prompted this calls 2–3 times a day;
// three emails in a week is the conservative end of that, and the day-7 one
// says it is the last.
//
// ── And OFF, unlike the quote chase ───────────────────────────────────────
//
// `active: false`. The quote chase is on for every company because it writes
// to somebody who asked that company for a price and is holding it. These
// write to somebody who filled in a form — which companies have very
// different feelings about, several of them legal — and three emails nobody
// chose, to a stranger, under the contractor's own name and From address, is
// not a default FieldQuo gets to set. They arrive on the Follow-ups page with
// a switch, their wording visible, and off.
//
// `channel: "email"`. Not because the text is worse but because
// Company.followUpSmsOn is off until a company chooses it (see
// lib/sms/followUpTextRules.js), and seeding a row on a channel the company
// has not enabled would be seeding a step that silently does nothing. A
// company that wants the text flips the channel on the row.
export const LEAD_FOLLOW_UPS = Object.freeze([
  {
    key: "lead_new_d1",
    name: "Day 1 — let's find a time",
    delayValue: 1,
    delayUnit: "days",
    trigger: LEAD_TRIGGER,
    active: false,
    channel: "email",
  },
  {
    key: "lead_new_d3",
    name: "Day 3 — still happy to take a look",
    delayValue: 3,
    delayUnit: "days",
    trigger: LEAD_TRIGGER,
    active: false,
    channel: "email",
  },
  {
    key: "lead_new_d7",
    name: "Day 7 — last note",
    delayValue: 7,
    delayUnit: "days",
    trigger: LEAD_TRIGGER,
    active: false,
    channel: "email",
  },
]);

/** Every built-in, quote chase first — the order the page lists them in. */
export const ALL_BUILT_IN_FOLLOW_UPS = Object.freeze([...BUILT_IN_FOLLOW_UPS, ...LEAD_FOLLOW_UPS]);

/** Every built-in key, in the same order. */
export const ALL_BUILT_IN_KEYS = Object.freeze(ALL_BUILT_IN_FOLLOW_UPS.map((r) => r.key));

export function builtInFollowUp(key) {
  return ALL_BUILT_IN_FOLLOW_UPS.find((r) => r.key === key) || null;
}

/** The trigger a built-in rides — quote chase unless the def says otherwise. */
export function builtInTrigger(key) {
  return builtInFollowUp(key)?.trigger || BUILT_IN_TRIGGER;
}

/**
 * The entity a built-in's wording is WRITTEN for.
 *
 * The cron asks this before rendering: a company that re-pointed a default at
 * another trigger keeps the trigger but must pick a template, because the
 * built-in words for a quote ("the quote we sent yesterday") are nonsense on
 * an invoice. It used to be a bare `finder.entityType !== "quote"`, which was
 * true while every built-in was a quote chase and became wrong the moment the
 * enquiry ones existed.
 */
export function builtInEntityType(key) {
  const kind = builtInCopyKind(key);
  if (kind === "quote") return "quote";
  if (kind === "lead") return "lead";
  return null;
}

/**
 * The subject and paragraphs for one built-in, in one language.
 *
 * A language outside BUILT_IN_LANGUAGES gets emailCopy's generic follow-up
 * line — which exists in every document language — rather than the English
 * day-specific text. `generic: true` says which happened, so a preview can
 * be honest about it.
 */
export function builtInWording(
  key,
  language = "en",
  { companyName = "", quoteNumber = "", service = null } = {},
) {
  const kind = builtInCopyKind(key);
  const c = emailCopy(language);

  if (kind === "lead") {
    const written = LEAD_COPY[language]?.[key];
    if (written) {
      return {
        language,
        generic: false,
        subject: written.subject(companyName),
        paragraphs: written.body(companyName, service),
      };
    }
    // The generic ENQUIRY line, not the generic quote one: followUpSubject
    // names a quote number this person does not have.
    return {
      language,
      generic: true,
      subject: c.leadFollowUpSubject(companyName),
      paragraphs: [c.leadFollowUpIntro()],
    };
  }

  const table = BUILT_IN_COPY[language]?.[key];
  if (table) {
    return {
      language,
      generic: false,
      subject: table.subject(companyName, quoteNumber),
      paragraphs: table.body(companyName),
    };
  }
  return {
    language,
    generic: true,
    subject: c.followUpSubject(companyName, quoteNumber),
    paragraphs: [c.followUpIntro()],
  };
}

/**
 * The email itself: subject, HTML and a plain-text alternative, through the
 * same shell as the quote email so the chase and the quote are one set of
 * stationery. Pure — the caller resolves the language and mints the URL.
 *
 * @param key       one of BUILT_IN_KEYS
 * @param quote     needs quoteNumber
 * @param client    needs name
 * @param company   the Company row (brand, name, contact)
 * @param url       the quote link — minted by the caller, never guessed here
 * @param language  the CLIENT's language (lib/i18n/clientLanguage.js)
 */
export function buildBuiltInFollowUpEmail({ key, quote, client, company, url, language = "en" }) {
  const t = documentTheme(company);
  const fill = fillPair(t);
  const c = emailCopy(language);
  const labels = documentLabels(language);
  const clientName = String(client?.name || "").split(" ")[0] || "";
  const wording = builtInWording(key, language, {
    companyName: company?.name || "",
    quoteNumber: quote?.quoteNumber || "",
  });

  const cta = emailButton({ url, label: escapeHtml(c.quoteCta), fill });

  const paragraphs = wording.paragraphs
    .map(
      (p) =>
        `        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 16px;color:${t.inkMuted};">${escapeHtml(p)}</p>`,
    )
    .join("\n");

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">
          ${escapeHtml(c.greeting(clientName))}
        </p>
${paragraphs}
${cta}
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${t.inkMuted};margin:16px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>`;

  const html = documentEmailHtml({
    company,
    theme: t,
    fill,
    label: labels.quote,
    reference: quote?.quoteNumber || "",
    body,
    footerNote: escapeHtml(c.questions(company?.phone)),
  });

  const text = [
    c.greeting(clientName),
    "",
    ...wording.paragraphs,
    "",
    `${c.quoteCta}: ${url}`,
    "",
    c.questions(company?.phone),
    company?.name || "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject: wording.subject, html, text, generic: wording.generic };
}

/**
 * The ENQUIRY chase's email: subject, HTML and a plain-text alternative,
 * through the same shell as the quote email so every letter this company
 * sends is one set of stationery. Pure — the caller resolves the language.
 *
 * ── No button, unless there is a video ───────────────────────────────────
 *
 * The quote chase's email is built around one button, because there is one
 * thing to do: open the quote. An enquiry has no document and no page of its
 * own, so there is nothing to link to — and emailButton with an empty url is
 * precisely the dead control this codebase keeps deleting (the "Payment
 * received" template shipped one for months). The call to action is a reply,
 * which goes to the company's own inbox (resolveSender sets replyTo), and the
 * footer carries their phone.
 *
 * The one exception is the pre-quote video: when the company has set one
 * (Company.preQuoteVideoUrl) it becomes the button, because "watch this
 * before we come" is a real thing to tap. When they have not, the section is
 * absent — no placeholder, no "video coming soon".
 *
 * @param key       one of LEAD_KEYS
 * @param lead      needs nothing; the service is passed separately
 * @param client    needs name
 * @param company   the Company row (brand, name, contact)
 * @param service   what they asked about, or null
 * @param videoUrl  the company's pre-quote video, or null — resolved by the
 *                  caller through lib/followUps/preQuoteVideo.js so a
 *                  half-typed address never becomes a link in an inbox
 * @param language  the CLIENT's language (the language they filled the form in)
 */
export function buildBuiltInLeadEmail({
  key,
  client,
  company,
  service = null,
  videoUrl = null,
  language = "en",
}) {
  const t = documentTheme(company);
  const fill = fillPair(t);
  const c = emailCopy(language);
  const labels = documentLabels(language);
  const clientName = String(client?.name || "").split(" ")[0] || "";
  const wording = builtInWording(key, language, { companyName: company?.name || "", service });

  const paragraphs = wording.paragraphs
    .map(
      (p) =>
        `        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 16px;color:${t.inkMuted};">${escapeHtml(p)}</p>`,
    )
    .join("\n");

  const video = videoUrl
    ? `${emailButton({ url: videoUrl, label: escapeHtml(c.preQuoteVideoCta), fill })}
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${t.inkMuted};margin:16px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(videoUrl)}</span>
        </p>`
    : "";

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">
          ${escapeHtml(c.greeting(clientName))}
        </p>
${paragraphs}${video}`;

  const html = documentEmailHtml({
    company,
    theme: t,
    fill,
    // The header's label. "Enquiry" rather than "Quote": there is no quote,
    // and labelling it one would have the homeowner looking for a price.
    label: c.enquiryLabel,
    reference: "",
    body,
    footerNote: escapeHtml(c.questions(company?.phone)),
  });

  const text = [
    c.greeting(clientName),
    "",
    ...wording.paragraphs,
    "",
    ...(videoUrl ? [`${c.preQuoteVideoCta}: ${videoUrl}`, ""] : []),
    c.questions(company?.phone),
    company?.name || "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject: wording.subject, html, text, generic: wording.generic };
}

/**
 * The `activatedAt` write for a switch that is being turned ON.
 *
 * One helper, two callers — the PATCH route and resetBuiltInRule — because
 * "when did this rule start chasing" decides which entities are in scope
 * (lib/followUps/stopConditions.js chaseFloor), and two places deciding it
 * differently means one of them blasts a backlog.
 *
 * Only on a genuine false → true transition. Re-saving an already-active rule
 * must not move the floor forward, or every edit would quietly narrow what
 * the rule chases; and nothing clears the stamp, because a rule that was on
 * before is a rule whose backlog has already been dealt with.
 *
 * @returns {{activatedAt?: Date}} spreadable into a Prisma `data`
 */
export function activationStamp(existing, nextActive, now = new Date()) {
  return nextActive === true && existing?.active !== true ? { activatedAt: now } : {};
}

// ── Seeding ─────────────────────────────────────────────────────────────────

function rowFor(companyId, def) {
  return {
    companyId,
    builtInKey: def.key,
    name: def.name,
    // The def's own trigger. This was BUILT_IN_TRIGGER for every row, which
    // was true while every built-in chased a quote and would have seeded the
    // three enquiry rules onto the quote trigger — three rules that look
    // right on the page and chase the wrong thing.
    triggerEvent: def.trigger || BUILT_IN_TRIGGER,
    delayValue: def.delayValue,
    delayUnit: def.delayUnit,
    templateId: null,
    // Likewise: `active: true` was right for the quote chase and is wrong for
    // the enquiry one. A def that does not say is on, so the three rows that
    // have been on for every company since September keep arriving on.
    active: def.active !== false,
    channel: def.channel || "email",
  };
}

/**
 * Make sure a company has its built-in rules — the three quote chases (on)
 * and the three enquiry chases (off). Idempotent: keyed on
 * (companyId, builtInKey), which the schema makes unique, so a row that
 * already exists — active, paused, edited, or DELETED (deletedAt set) — is
 * left exactly as it is. A deleted default stays deleted; that is the point
 * of the tombstone.
 *
 * @returns {Promise<number>} how many rules were created (0 on a re-run)
 */
export async function ensureDefaultFollowUps(db, companyId, { dryRun = false } = {}) {
  if (!companyId) return 0;
  const existing = await db.followUpRule.findMany({
    where: { companyId, builtInKey: { in: [...ALL_BUILT_IN_KEYS] } },
    select: { builtInKey: true },
  });
  const have = new Set(existing.map((r) => r.builtInKey));
  let created = 0;
  for (const def of ALL_BUILT_IN_FOLLOW_UPS) {
    if (have.has(def.key)) continue;
    if (!dryRun) {
      await db.followUpRule.create({ data: rowFor(companyId, def) });
    }
    created++;
  }
  return created;
}

/**
 * "Reset to default": the row goes back to FieldQuo's delay, name, wording
 * (templateId null) and switch position — and comes back from a delete. The
 * FollowUpLog rows stay, so a quote already chased by this rule is not chased
 * again by the reset one.
 */
export async function resetBuiltInRule(db, rule) {
  const def = builtInFollowUp(rule?.builtInKey);
  if (!def || !rule?.id) return null;
  return db.followUpRule.update({
    where: { id: rule.id },
    data: {
      name: def.name,
      triggerEvent: def.trigger || BUILT_IN_TRIGGER,
      delayValue: def.delayValue,
      delayUnit: def.delayUnit,
      templateId: null,
      // Back to the def's own switch position, not to "on": "Reset to
      // default" on an enquiry chase the company switched ON must put it back
      // the way FieldQuo ships it, which is off. Resetting it to on would be
      // the one control on this page that starts sending.
      active: def.active !== false,
      channel: def.channel || "email",
      deletedAt: null,
      // A reset that switches a paused rule back ON starts its clock now, so
      // resuming does not blast the quotes or leads that piled up while it
      // was off. A reset to OFF (the enquiry defaults) stamps nothing.
      ...activationStamp(rule, def.active !== false),
    },
    include: { template: { select: { id: true, name: true, type: true } } },
  });
}
