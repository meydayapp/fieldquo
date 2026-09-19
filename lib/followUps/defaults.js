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
import { BUILT_IN_COPY, BUILT_IN_LANGUAGES, BUILT_IN_KEYS } from "./defaultCopy.js";

export { BUILT_IN_LANGUAGES, BUILT_IN_KEYS };

/** The trigger every built-in rides. The cron's quote finder owns the stop conditions. */
export const BUILT_IN_TRIGGER = "quote_no_response";

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

export function builtInFollowUp(key) {
  return BUILT_IN_FOLLOW_UPS.find((r) => r.key === key) || null;
}

/**
 * The subject and paragraphs for one built-in, in one language.
 *
 * A language outside BUILT_IN_LANGUAGES gets emailCopy's generic follow-up
 * line — which exists in every document language — rather than the English
 * day-specific text. `generic: true` says which happened, so a preview can
 * be honest about it.
 */
export function builtInWording(key, language = "en", { companyName = "", quoteNumber = "" } = {}) {
  const table = BUILT_IN_COPY[language]?.[key];
  if (table) {
    return {
      language,
      generic: false,
      subject: table.subject(companyName, quoteNumber),
      paragraphs: table.body(companyName),
    };
  }
  const c = emailCopy(language);
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

// ── Seeding ─────────────────────────────────────────────────────────────────

function rowFor(companyId, def) {
  return {
    companyId,
    builtInKey: def.key,
    name: def.name,
    triggerEvent: BUILT_IN_TRIGGER,
    delayValue: def.delayValue,
    delayUnit: def.delayUnit,
    templateId: null,
    active: true,
  };
}

/**
 * Make sure a company has its three defaults. Idempotent: keyed on
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
    where: { companyId, builtInKey: { in: [...BUILT_IN_KEYS] } },
    select: { builtInKey: true },
  });
  const have = new Set(existing.map((r) => r.builtInKey));
  let created = 0;
  for (const def of BUILT_IN_FOLLOW_UPS) {
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
      triggerEvent: BUILT_IN_TRIGGER,
      delayValue: def.delayValue,
      delayUnit: def.delayUnit,
      templateId: null,
      active: true,
      deletedAt: null,
    },
    include: { template: { select: { id: true, name: true, type: true } } },
  });
}
