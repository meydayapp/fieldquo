// lib/email/teamNotice.js
//
// The ONE envelope for a notice FieldQuo emails to a company's OWN team —
// owners, admins, staff — about something that happened in their account: a
// large quote, a payment, a quote approved or declined, a client ticket, a
// kitchen request, a saved client design, a photo @mention, a visit a client
// cancelled or moved. The owner, 2026-10-13, looking at Settings ›
// Notifications: "right now these type of emails is a simple text email can
// we add better formatting to the emails that the company gets as forms of
// notifications?"
//
// Every one of them now has the same shape:
//
//   FieldQuo layout (lib/email/platformLayout.js) as TRANSACTIONAL mail
//   a preheader              — the notice's own first sentence, no new words
//   a clear title            — the heading
//   the sentence(s) it always said
//   a facts card             — label/value rows: client, number, amount, who, when
//   ONE button               — to the exact record in the app
//   a plain-text part        — the same things, in words
//
// ── Why FieldQuo's layout and not the company's stationery ────────────────
//
// The white-label rule is for mail a HOMEOWNER reads (AGENTS.md). These go to
// the contractor's own people, about their own FieldQuo account — the
// billing-letter family's reasoning (lib/email/billingEmail.js), not the
// quote email's. Client-facing mail never comes through here, and the client
// half of a two-sided event (a visit cancelled: one letter to the client, one
// to the office) keeps its own stationery untouched.
//
// ── Money is decided here, not by the caller remembering ─────────────────
//
// A fact flagged `money: true` is DROPPED for a reader who may not see money
// (lib/permissions/enforce.js canSeeMoney — the "showPricing" toggle, the
// same one rbac-redaction strips quote and invoice totals with). Most of these
// notices go to owners and admins only, who always see money; the rule is
// still enforced in the builder so that widening a recipient list can never
// widen what a recipient reads. The notices whose whole point IS an amount
// (the large-quote alert, "payment received") refuse to build at all for such
// a reader — lib/notifications/teamEmails.js — matching the in-app feed, whose
// money types are never delivered to a member without money sight
// (lib/notifications/recipients.js, requiresMoneySight).
//
// The company's own inbox (Company.email — the office copy of a visit a client
// cancelled) is not a member and has no grid; it is the business itself, and
// it reads what it always read. COMPANY_INBOX says so explicitly rather than
// passing `null`, which canSeeMoney correctly treats as "nobody, no money".

import { escapeHtml, escapeAttr } from "@/lib/email/emailTheme";
import { renderPlatformEmail, platformTextFooter, EMAIL_ASSET_ORIGIN } from "@/lib/email/platformLayout";
import { labelled } from "@/lib/i18n/lifecycleEmailCopy";
import { mailingAddress as fieldquoMailingAddress } from "@/lib/legal/mailingAddress";
import { canSeeMoney } from "@/lib/permissions/enforce";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { getAppOrigin } from "@/lib/appUrl";

/** The reader of a notice sent to the company's own address rather than a member. */
export const COMPANY_INBOX = Object.freeze({ companyInbox: true });

/** May this reader see amounts? A member by their grid; the company inbox, yes. */
export function readerSeesMoney(reader) {
  if (reader && reader.companyInbox === true) return true;
  return canSeeMoney(reader || null);
}

// The palette — the layout's own measured inks, on a faint card inside the
// always-white letter card (platformLayout.js keeps that white in both
// schemes, so these pairs hold in dark mode too).
const INK = "#111827";
const MUTED = "#4b5563";
const CARD_BG = "#f9fafb";
const CARD_RULE = "#e5e7eb";

/** Every text/background pair the facts card draws. Measured by the check. */
export const TEAM_NOTICE_PAIRS = Object.freeze([
  { name: "fact label on facts card", fg: MUTED, bg: CARD_BG },
  { name: "fact value on facts card", fg: INK, bg: CARD_BG },
  { name: "section title on facts card", fg: INK, bg: CARD_BG },
  { name: "small print on letter card", fg: MUTED, bg: "#ffffff" },
]);

/**
 * The From header for a team notice sent under FieldQuo's fixed notifications
 * address with the company's name on it. The name is stripped of the three
 * characters that would break a "Name <addr>" header — lib/email/resend.js's
 * senderFor() strips the same three — because a company called
 * `Acme "Best" <Painting>` was interpolated raw and produced a malformed From
 * header (two angle-bracketed addresses, an unbalanced quote).
 */
export function teamNoticeFrom(companyName) {
  const name = String(companyName || "").replace(/[<>"]/g, "").replace(/\s+/g, " ").trim();
  return `${name || "FieldQuo"} <notifications@fieldquo.com>`;
}

/**
 * A date and time in the company's zone, in the reader's language. Empty for
 * no date — an absent time is printed as no row, never "Invalid Date".
 */
export function noticeWhen(value, { timezone = null, language = "en" } = {}) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const opts = { dateStyle: "medium", timeStyle: "short" };
  try {
    return new Intl.DateTimeFormat(numberLocaleFor(language), { ...opts, ...(timezone ? { timeZone: timezone } : {}) }).format(d);
  } catch {
    // A zone Intl does not know (a stale or hand-typed Company.timezone) —
    // UTC, said so, rather than a lambda's local time passed off as theirs.
    try {
      return `${new Intl.DateTimeFormat(numberLocaleFor(language), { ...opts, timeZone: "UTC" }).format(d)} UTC`;
    } catch {
      return d.toISOString();
    }
  }
}

/** Only rows with something to say; money rows only for a reader who may see money. */
function visibleRows(rows, seesMoney) {
  return (Array.isArray(rows) ? rows : []).filter((r) => {
    if (!r || !r.label) return false;
    if (r.money && !seesMoney) return false;
    // A label-only row (an extra the client added, for a reader with no money
    // sight) is a statement in itself; any other row with no value is absence,
    // which is printed as nothing.
    if (r.labelOnly) return true;
    return r.value !== null && r.value !== undefined && String(r.value).trim() !== "";
  });
}

function factRowHtml(r, first) {
  const top = first ? "" : `border-top:1px solid ${CARD_RULE};`;
  if (r.labelOnly) {
    return `<tr><td colspan="2" style="padding:9px 14px;${top}font-size:14px;line-height:1.45;color:${INK};">${escapeHtml(r.label)}</td></tr>`;
  }
  return `<tr>
      <td valign="top" style="padding:9px 14px;${top}font-size:13px;line-height:1.45;color:${MUTED};">${escapeHtml(r.label)}</td>
      <td valign="top" align="right" style="padding:9px 14px;${top}font-size:14px;line-height:1.45;color:${INK};font-weight:700;text-align:right;">${escapeHtml(r.value)}</td>
    </tr>`;
}

function cardHtml(sections) {
  const blocks = sections
    .map((s) => {
      const title = s.title
        ? `<tr><td colspan="2" style="padding:12px 14px 4px 14px;font-size:13px;line-height:1.4;font-weight:700;color:${INK};border-top:1px solid ${CARD_RULE};">${escapeHtml(s.title)}</td></tr>`
        : "";
      return title + s.rows.map((r, i) => factRowHtml(r, i === 0 && !s.title)).join("");
    })
    .join("");
  return `<table role="presentation" class="fq-facts" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;margin:4px 0 0 0;background:${CARD_BG};border:1px solid ${CARD_RULE};border-radius:8px;">${blocks}</table>`;
}

const para = (text) => `<p style="font-size:15px;line-height:1.6;margin:0 0 14px 0;color:${INK};">${text}</p>`;

/**
 * Build one team notice.
 *
 * @param language   the reader's language (letterLanguage) — the chrome, the
 *                   labels and the sentences the caller passes are all in it
 * @param subject    the subject line, unchanged from what the notice sent before
 * @param heading    the title at the top of the card
 * @param sub        one small line under it — the company's name
 * @param intro      [string] sentences, PLAIN TEXT (escaped here). The first
 *                   is the preheader unless `preheader` is given.
 * @param bodyHtml   optional pre-escaped HTML in place of `intro` (a client's
 *                   own multi-line message) — `bodyText` is its text twin
 * @param facts      [{ label, value, money?, labelOnly? }]
 * @param sections   [{ title, rows: [...] }] further groups inside the card
 * @param outro      [string] sentences after the card
 * @param cta        { url, label } — the ONE button
 * @param note       small print under the button (plain text), or null
 * @param noteUrl    a link the small print carries, or null
 * @param reader     the member it is for (role, permissions) or COMPANY_INBOX
 * @param origin     the app origin, for the layout's Help · Your account links
 * @returns {{ subject, html, text, preheader, facts: [...] }}
 */
export function buildTeamNotice({
  language = "en",
  subject,
  heading,
  sub = null,
  preheader = null,
  intro = [],
  bodyHtml = null,
  bodyText = null,
  facts = [],
  sections = [],
  outro = [],
  cta = null,
  note = null,
  noteUrl = null,
  reader,
  origin = null,
  mailingAddress = fieldquoMailingAddress(),
} = {}) {
  const seesMoney = readerSeesMoney(reader);
  const groups = [
    { title: null, rows: visibleRows(facts, seesMoney) },
    ...(Array.isArray(sections) ? sections : []).map((s) => ({ title: s?.title || null, rows: visibleRows(s?.rows, seesMoney) })),
  ].filter((g) => g.rows.length);

  const introLines = (Array.isArray(intro) ? intro : [intro]).filter((l) => l && String(l).trim());
  const outroLines = (Array.isArray(outro) ? outro : [outro]).filter((l) => l && String(l).trim());
  const base = originOf(origin, cta?.url);
  const button = cta && cta.url && cta.label ? { url: cta.url, label: cta.label } : null;
  // The inbox preview: the notice's own first sentence — no new words.
  const pre = preheader || introLines[0] || (bodyText ? String(bodyText).split("\n").find((l) => l.trim()) : null) || heading || null;

  const html = renderPlatformEmail({
    language,
    kind: "transactional",
    preheader: pre,
    heading,
    sub,
    bodyHtml: [
      bodyHtml != null ? para(bodyHtml) : introLines.map((l) => para(escapeHtml(l))).join(""),
      groups.length ? cardHtml(groups) : "",
      outroLines.length ? `<div style="margin-top:16px;">${outroLines.map((l) => para(escapeHtml(l))).join("")}</div>` : "",
    ].join(""),
    cta: button,
    afterCtaHtml: note
      ? `<p style="margin:22px 0 0 0;font-size:13px;line-height:1.5;color:${MUTED};text-align:center;">${
          noteUrl ? `<a href="${escapeAttr(noteUrl)}" style="color:${MUTED};text-decoration:underline;">${escapeHtml(note)}</a>` : escapeHtml(note)
        }</p>`
      : "",
    origin: base,
    mailingAddress,
  }).html;

  const factLines = groups.flatMap((g, i) => [
    ...(i > 0 || g.title ? [""] : []),
    ...(g.title ? [g.title] : []),
    ...g.rows.map((r) => (r.labelOnly ? `- ${r.label}` : labelled(language, r.label, r.value))),
  ]);
  const text = [
    heading,
    ...(sub ? [sub] : []),
    "",
    ...(bodyHtml != null ? [String(bodyText || "")] : introLines.flatMap((l, i) => (i ? ["", l] : [l]))),
    ...(factLines.length ? ["", ...factLines] : []),
    ...(outroLines.length ? ["", ...outroLines.flatMap((l, i) => (i ? ["", l] : [l]))] : []),
    "",
    ...(button ? [labelled(language, button.label, button.url), ""] : []),
    // The note is a sentence, not a label — its link goes on its own line.
    ...(note ? [note, ...(noteUrl ? [noteUrl] : []), ""] : []),
    ...platformTextFooter({ language, kind: "transactional", mailingAddress }),
  ].join("\n");

  return {
    subject,
    html,
    text,
    preheader: pre,
    facts: groups.flatMap((g) => g.rows),
    cta: button,
  };
}

/**
 * The app's origin for the button, from the request when there is one. A
 * sender with no request (a webhook's fire-and-forget, a cron) on a machine
 * where getAppOrigin cannot work it out gets FieldQuo's public host rather
 * than a throw — a notice must never be what fails a payment.
 */
export function noticeOrigin(request) {
  try {
    return getAppOrigin(request);
  } catch {
    return EMAIL_ASSET_ORIGIN;
  }
}

function originOf(origin, url) {
  for (const candidate of [origin, url]) {
    try {
      if (candidate) return new URL(candidate).origin;
    } catch {
      // try the next
    }
  }
  return EMAIL_ASSET_ORIGIN;
}

/**
 * Group the readers of one notice by what their copy will say — the language
 * and whether money is in it — so that one send per group goes to everybody
 * who would read the identical letter. A notice to three owners who all read
 * English is still one email to three people, as it was.
 *
 * @param readers [{ email, language, reader }]
 * @returns [{ language, seesMoney, reader, to: [email] }]
 */
export function groupReaders(readers) {
  const groups = new Map();
  for (const r of Array.isArray(readers) ? readers : []) {
    const email = String(r?.email || "").trim();
    if (!email) continue;
    const seesMoney = readerSeesMoney(r.reader);
    const key = `${r.language || "en"}|${seesMoney ? 1 : 0}`;
    if (!groups.has(key)) groups.set(key, { language: r.language || "en", seesMoney, reader: r.reader, to: [] });
    const g = groups.get(key);
    if (!g.to.includes(email)) g.to.push(email);
  }
  return [...groups.values()];
}
