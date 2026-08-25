// lib/email/quoteSections.js
//
// The substance of a quote email, as inline-styled tables.
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// The quote email used to be a greeting, a total and a button, on the argument
// that "the link is the point" — a second, worse copy of the quote gives the
// client a reason not to click through to the one with the approve button on
// it. That reasoning is sound and it lost to a real observation: contractors
// who moved to FieldQuo from their own hand-built systems were sending emails
// that ARGUED for the job — what's included, what happens on which day, who to
// ring — and a bare link reads as less effort than the competitor's letter
// sitting above it in the inbox.
//
// So the email carries the substance and the button stays unmistakably the
// primary action: it sits directly under the total, above everything here, and
// repeats at the end for the reader who scrolled.
//
// ── Why the builders are here and not in the PDF sections ───────────────────
//
// ScopeGroupsSection.js and ProcessStepsSection.js each exported a
// renderEmailHtml alongside their react-pdf component, which meant any email
// wanting a scope table had to import @react-pdf/renderer to get forty lines
// of HTML. Same reasoning that moved preparedForBlock into
// documentEmailLayout.js. Those two files now call these, so there is one
// implementation of "a scope group as HTML" rather than two that drift.
//
// ── Everything is table-based and inline-styled ─────────────────────────────
//
// Gmail strips <style>, Outlook renders through Word: no flexbox, no grid, no
// object-fit, no background-image. Images get explicit width attributes as
// well as CSS because Word ignores the CSS. Colours come from documents/theme,
// which MEASURES contrast rather than assuming a dark brand.

import { documentTheme, ruleColor, fillPair } from "@/lib/documents/theme";
import { accessiblePair, ensureContrast } from "@/lib/brand/colour";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { escapeHtml, EMAIL_FONT } from "@/lib/email/documentEmailLayout";
import { escapeAttr } from "@/lib/email/emailTheme";
import { telHref } from "@/lib/quotes/emailSections";

const num = (v) => Number(v ?? 0);
const itemText = (item) => item?.description || item?.name || item?.title || "";

/**
 * The small-caps heading over each block, with the brand tick beside it.
 *
 * The PDF's SectionLabel in HTML. ruleColor() rather than the raw accent: a
 * company whose brand is near-white would otherwise get an invisible tick, and
 * theme.js already solved that once.
 */
export function sectionHeading(theme, text) {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 0 9px;">
          <tr>
            <td width="3" bgcolor="${ruleColor(theme)}" style="width:3px;background:${ruleColor(theme)};font-size:0;line-height:0;">&nbsp;</td>
            <td style="padding-left:6px;font-family:${EMAIL_FONT};font-size:11px;font-weight:700;letter-spacing:1px;color:${theme.accentText};">${escapeHtml(String(text).toUpperCase())}</td>
          </tr>
        </table>`;
}

/**
 * Quotes carry scopeGroups; invoices carry a flat lineItems array.
 *
 * Normalised here rather than in each caller. Lifted unchanged from
 * ScopeGroupsSection so both sides of the document keep grouping identically.
 */
export function toGroups(data = {}) {
  if (Array.isArray(data.scopeGroups) && data.scopeGroups.length) {
    return data.scopeGroups.map((g) => ({
      label: g.label || g.category?.label || "",
      categoryKey: g.category?.key || null,
      override: g.companySettings || null,
      items: Array.isArray(g.lineItems) ? g.lineItems : [],
      subtotal:
        g.subtotal !== undefined && g.subtotal !== null
          ? num(g.subtotal)
          : (Array.isArray(g.lineItems) ? g.lineItems : []).reduce(
              (s, li) => s + num(li.amount),
              0,
            ),
    }));
  }
  if (Array.isArray(data.lineItems) && data.lineItems.length) {
    return [
      {
        label: "",
        categoryKey: null,
        override: null,
        items: data.lineItems,
        subtotal: data.lineItems.reduce((s, li) => s + num(li.amount), 0),
      },
    ];
  }
  return [];
}

function bulletList(lines, { colour, ink }) {
  return lines
    .map(
      (line) => `
                <tr>
                  <td width="12" style="width:12px;vertical-align:top;padding:0 0 3px;font-family:${EMAIL_FONT};font-size:12px;line-height:1.5;color:${colour};">&bull;</td>
                  <td style="vertical-align:top;padding:0 0 3px;font-family:${EMAIL_FONT};font-size:12px;line-height:1.5;color:${ink};">${escapeHtml(line)}</td>
                </tr>`,
    )
    .join("");
}

/**
 * The scope breakdown: one card per service, its priced lines, and what's
 * included in it.
 *
 * @param detail  false reproduces the old email exactly — prices only, no
 *                "what's included". Kept because the invoice-side caller
 *                (renderEmailHtml on ScopeGroupsSection) is a covering note
 *                for a document already agreed, where the bullets are a
 *                re-argument for a sale that already happened.
 */
export function scopeBreakdownHtml({
  data = {},
  company = {},
  language = "en",
  detail = true,
}) {
  const t = documentTheme(company);
  const labels = documentLabels(language);
  const { money } = documentFormatters(language, company?.currency);
  const groups = toGroups(data);
  if (!groups.length) return "";

  const multi = groups.length > 1;

  const cards = groups
    .map((g, gi) => {
      const content = resolveServiceContent(g.categoryKey, g.override);
      const accent = content.accent;
      // The per-trade accents are chosen desaturated and mid-lightness so they
      // sit beside any brand colour — which is exactly the band where no fixed
      // foreground clears 4.5:1. accessiblePair measures; hardcoded white put
      // the clay badge at 4.36. Same call the PDF and the approval page make,
      // so all three render the same badge.
      const badge = accessiblePair(accent);
      // The bullet glyph is the trade accent on paper, which is a different
      // job from the same colour as a fill — see theme.js on accentText.
      const bulletInk = ensureContrast(accent, t.paper, 4.5);

      const head = `
              <tr>
                <td style="padding:0 0 6px;font-family:${EMAIL_FONT};">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="vertical-align:middle;">
                        ${
                          multi
                            ? `<span style="display:inline-block;background:${badge.bg};color:${badge.fg};font-size:9px;font-weight:700;letter-spacing:0.5px;padding:2px 5px;border-radius:6px;margin-right:6px;">${String(gi + 1).padStart(2, "0")}</span>`
                            : ""
                        }<span style="font-size:14px;font-weight:700;color:${t.ink};">${escapeHtml(g.label || labels.description)}</span>
                      </td>
                      ${
                        g.subtotal > 0
                          ? `<td align="right" style="vertical-align:middle;text-align:right;white-space:nowrap;font-size:14px;font-weight:700;color:${t.ink};">${money(g.subtotal)}</td>`
                          : ""
                      }
                    </tr>
                  </table>
                </td>
              </tr>`;

      const lines = g.items
        .map(
          (item) => `
                      <tr>
                        <td style="padding:3px 10px 3px 0;font-family:${EMAIL_FONT};font-size:13px;line-height:1.45;color:${t.inkMuted};">${escapeHtml(itemText(item))}${
                          num(item.quantity) > 1
                            ? ` <span style="color:${t.inkMuted};">&times; ${escapeHtml(item.quantity)}</span>`
                            : ""
                        }</td>
                        <td align="right" style="padding:3px 0;text-align:right;white-space:nowrap;font-family:${EMAIL_FONT};font-size:13px;color:${t.inkMuted};">${money(item.amount)}</td>
                      </tr>`,
        )
        .join("");

      const included =
        detail && content.included?.length
          ? `
              <tr>
                <td style="padding:9px 0 0;border-top:1px solid ${t.borderSoft};font-family:${EMAIL_FONT};">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.7px;color:${t.inkMuted};padding-bottom:4px;">${escapeHtml(labels.whatsIncluded.toUpperCase())}</div>
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                    ${bulletList(content.included, { colour: bulletInk, ink: t.inkMuted })}
                  </table>
                </td>
              </tr>`
          : "";

      // "What could change this price" rides in the same card as what's
      // included, because it is the same sentence continued: here is what you
      // are buying, and here is the part nobody can see through a roof until
      // it is open. Empty for every trade that declares none — no heading over
      // a blank box.
      const mayChange =
        detail && content.mayChange?.length
          ? `
              <tr>
                <td style="padding:9px 0 0;border-top:1px solid ${t.borderSoft};font-family:${EMAIL_FONT};">
                  <div style="font-size:10px;font-weight:700;letter-spacing:0.7px;color:${t.inkMuted};padding-bottom:4px;">${escapeHtml(labels.whatCouldChange.toUpperCase())}</div>
                  ${content.mayChange
                    .map(
                      (entry) => `
                  <div style="padding-bottom:5px;">
                    <div style="font-size:12px;font-weight:700;line-height:1.4;color:${t.ink};">${escapeHtml(entry.title)}</div>
                    <div style="font-size:12px;line-height:1.5;color:${t.inkMuted};">${escapeHtml(entry.body)}</div>
                  </div>`,
                    )
                    .join("")}
                </td>
              </tr>`
          : "";

      return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 14px;">
          <tr>
            <td width="3" bgcolor="${accent}" style="width:3px;background:${accent};font-size:0;line-height:0;">&nbsp;</td>
            <td style="padding:0 0 0 12px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                ${head}
                <tr>
                  <td style="padding:0 0 2px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                      ${lines}
                    </table>
                  </td>
                </tr>
                ${included}
                ${mayChange}
              </table>
            </td>
          </tr>
        </table>`;
    })
    .join("");

  return `
        <div style="margin:0 0 8px;">
${sectionHeading(t, multi ? labels.scopeOfWork : labels.description)}
${cards}
        </div>`;
}

/**
 * "Here's what actually happens if you say yes" — the numbered steps, with
 * whatever timeline the trade actually publishes beside each one.
 *
 * A step without a timeline prints without one. serviceContent.js only carries
 * durations where a real contractor published them, and inventing "2–3 days"
 * for the other sixty trades would be committing a company to a date in
 * writing on their behalf.
 */
export function processStepsHtml({ data = {}, company = {}, language = "en", steps }) {
  const t = documentTheme(company);
  const labels = documentLabels(language);
  const list = Array.isArray(steps) ? steps : [];
  if (!list.length) return "";

  // fillPair, NOT accentFill/accentOn. accentOn is readableForeground(), a
  // luminance threshold, and a threshold is what theme.js exists to replace:
  // measured across the brands contractors actually pick, mid grey put the
  // step number at 4.43:1 — under the bar, on a filled circle, in every
  // email that company sends. fillPair moves the FILL in small steps until
  // the pair measures, which is also what the PDF's version of this block
  // already did.
  const bubble = fillPair(t);

  const rows = list
    .map(
      (s) => `
          <tr>
            <td width="26" style="width:26px;vertical-align:top;padding:0 0 12px;">
              <div style="width:22px;height:22px;line-height:22px;border-radius:11px;background:${bubble.bg};color:${bubble.fg};text-align:center;font-family:${EMAIL_FONT};font-size:11px;font-weight:700;">${s.num}</div>
            </td>
            <td style="vertical-align:top;padding:0 0 12px 8px;font-family:${EMAIL_FONT};">
              <div style="font-size:13px;font-weight:700;color:${t.ink};">${escapeHtml(s.title)}${
                s.timeline
                  ? `<span style="font-weight:400;font-size:11px;color:${t.inkMuted};"> &middot; ${escapeHtml(s.timeline)}</span>`
                  : ""
              }</div>
              <div style="font-size:12px;line-height:1.5;color:${t.inkMuted};">${escapeHtml(s.body)}</div>
            </td>
          </tr>`,
    )
    .join("");

  // The company's own "what happens next" — timelines, access, payment
  // schedule — sits under the generic steps because it is the specific that
  // overrides them.
  const notes = data.processNotes
    ? `
        <div style="margin-top:2px;padding:10px 12px;background:${t.accentWash};border-left:3px solid ${ruleColor(t)};font-family:${EMAIL_FONT};font-size:12px;line-height:1.55;color:${t.inkOnWash};white-space:pre-wrap;">${escapeHtml(data.processNotes)}</div>`
    : "";

  return `
        <div style="margin:18px 0 0;">
${sectionHeading(t, labels.howTheWorkRuns)}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
            ${rows}
          </table>
${notes}
        </div>`;
}

/**
 * Past clients who have agreed to take a call.
 *
 * Returns "" for an empty list. That is the SAFE half of the rule, not the
 * whole rule: a caller that reaches here with an empty included section has
 * already been stopped by lib/quotes/emailSections.js, and this returning ""
 * is what keeps a *removed* section from leaving a gap.
 *
 * The number is printed exactly as it was typed and dialled from a derived
 * `tel:` — see telHref for why reformatting someone's phone number on a
 * client-facing surface is not a tidy-up.
 */
export function referencesHtml({ items = [], company = {}, language = "en" }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "";

  const t = documentTheme(company);
  const labels = documentLabels(language);
  const c = emailCopy(language);
  // A phone number is a link on a wash, so it is measured against the wash and
  // not against paper. accentText is derived for paper and drops below the bar
  // on a tinted surface — the exact failure theme.js documents.
  const linkInk = ensureContrast(t.accent, t.accentWash, 4.5);

  const rows = list
    .map((r) => {
      const href = telHref(r.phone);
      const phone = escapeHtml(r.phone);
      return `
            <tr>
              <td style="padding:0 0 8px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid ${t.border};border-radius:6px;">
                  <tr>
                    <td style="padding:10px 14px;font-family:${EMAIL_FONT};">
                      <div style="font-size:14px;font-weight:700;color:${t.ink};">${escapeHtml(r.name)}</div>
                      ${
                        href
                          ? `<a href="${escapeAttr(href)}" style="font-size:13px;font-weight:700;color:${t.accentText};text-decoration:none;">${phone}</a>`
                          : `<span style="font-size:13px;font-weight:700;color:${t.inkMuted};">${phone}</span>`
                      }
                      ${r.note ? `<div style="font-size:12px;line-height:1.5;color:${t.inkMuted};padding-top:2px;">${escapeHtml(r.note)}</div>` : ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>`;
    })
    .join("");

  return `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:18px 0 0;">
          <tr>
            <td width="4" bgcolor="${ruleColor(t)}" style="width:4px;background:${ruleColor(t)};font-size:0;line-height:0;">&nbsp;</td>
            <td bgcolor="${t.accentWash}" style="background:${t.accentWash};padding:14px 16px;font-family:${EMAIL_FONT};">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${linkInk};padding-bottom:5px;">${escapeHtml(labels.references.toUpperCase())}</div>
              <div style="font-size:13px;line-height:1.6;color:${t.inkMutedOnWash};padding-bottom:11px;">${escapeHtml(c.referencesIntro())}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
                ${rows}
              </table>
            </td>
          </tr>
        </table>`;
}

/**
 * Before/after photo pairs, two columns per row.
 *
 * `width` attributes as well as CSS widths: Outlook's Word renderer ignores
 * the style and stretches an image to its natural size otherwise, which turns
 * a 3000px phone photo into a horizontally scrolling email. No object-fit and
 * no fixed height — Word supports neither, and a squashed photo is worse than
 * one that keeps its own proportions.
 *
 * The BEFORE/AFTER captions are text, not a graphic. A remote image is what an
 * email client blocks first, and a blocked pair with no label is two grey
 * boxes in an unexplained order.
 */
export function beforeAfterHtml({ items = [], company = {}, language = "en" }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return "";

  const t = documentTheme(company);
  const labels = documentLabels(language);
  const c = emailCopy(language);

  const cell = (url, tag, alt, padding) => `
                <td width="50%" style="width:50%;padding:${padding};vertical-align:top;">
                  <img src="${escapeAttr(url)}" alt="${escapeAttr(alt)}" width="248" style="width:100%;max-width:248px;height:auto;display:block;border:0;outline:none;text-decoration:none;border-radius:6px;" />
                  <div style="font-family:${EMAIL_FONT};font-size:10px;font-weight:700;letter-spacing:1px;color:${t.inkMuted};padding-top:4px;">${escapeHtml(String(tag).toUpperCase())}</div>
                </td>`;

  const rows = list
    .map(
      (p) => `
            <tr>
${cell(p.beforeUrl, labels.before, `${labels.before}${p.caption ? ` — ${p.caption}` : ""}`, "0 4px 4px 0")}
${cell(p.afterUrl, labels.after, `${labels.after}${p.caption ? ` — ${p.caption}` : ""}`, "0 0 4px 4px")}
            </tr>
            ${
              p.caption
                ? `<tr><td colspan="2" style="padding:0 0 14px;font-family:${EMAIL_FONT};font-size:12px;line-height:1.5;color:${t.inkMuted};">${escapeHtml(p.caption)}</td></tr>`
                : `<tr><td colspan="2" style="font-size:0;line-height:0;padding:0 0 12px;">&nbsp;</td></tr>`
            }`,
    )
    .join("");

  return `
        <div style="margin:18px 0 0;">
${sectionHeading(t, labels.beforeAfter)}
          <div style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;color:${t.inkMuted};padding-bottom:10px;">${escapeHtml(c.beforeAfterIntro())}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;">
            ${rows}
          </table>
        </div>`;
}

/**
 * The plain-text twin of the sections above.
 *
 * Not decoration. Some corporate filters score HTML-only mail as spam, and a
 * quote in the junk folder is the same outcome as a quote never sent — so the
 * text part has to carry the same argument, not a stub pointing at the link.
 */
export function quoteSectionsText({
  data = {},
  company = {},
  language = "en",
  steps = [],
  references = [],
  beforeAfter = [],
}) {
  const labels = documentLabels(language);
  const c = emailCopy(language);
  const { money } = documentFormatters(language, company?.currency);
  const groups = toGroups(data);
  const out = [];

  if (groups.length) {
    out.push(labels.scopeOfWork.toUpperCase(), "");
    for (const g of groups) {
      const content = resolveServiceContent(g.categoryKey, g.override);
      out.push(
        `${g.label || labels.description}${g.subtotal > 0 ? ` — ${money(g.subtotal)}` : ""}`,
      );
      for (const item of g.items) {
        out.push(
          `  ${itemText(item)}${num(item.quantity) > 1 ? ` x${item.quantity}` : ""}  ${money(item.amount)}`,
        );
      }
      if (content.included?.length) {
        out.push(`  ${labels.whatsIncluded}:`);
        for (const line of content.included) out.push(`   - ${line}`);
      }
      if (content.mayChange?.length) {
        out.push(`  ${labels.whatCouldChange}:`);
        for (const entry of content.mayChange)
          out.push(`   - ${entry.title}: ${entry.body}`);
      }
      out.push("");
    }
  }

  if (steps.length) {
    out.push(labels.howTheWorkRuns.toUpperCase(), "");
    for (const s of steps) {
      out.push(`${s.num}. ${s.title}${s.timeline ? ` (${s.timeline})` : ""}`);
      out.push(`   ${s.body}`);
    }
    if (data.processNotes) out.push("", data.processNotes);
    out.push("");
  }

  if (references.length) {
    out.push(labels.references.toUpperCase(), "", c.referencesIntro(), "");
    for (const r of references) {
      out.push(`  ${r.name} — ${r.phone}${r.note ? ` (${r.note})` : ""}`);
    }
    out.push("");
  }

  if (beforeAfter.length) {
    out.push(labels.beforeAfter.toUpperCase(), "", c.beforeAfterIntro(), "");
    for (const p of beforeAfter) {
      if (p.caption) out.push(`  ${p.caption}`);
      out.push(`  ${labels.before}: ${p.beforeUrl}`);
      out.push(`  ${labels.after}: ${p.afterUrl}`);
    }
    out.push("");
  }

  return out.join("\n");
}
