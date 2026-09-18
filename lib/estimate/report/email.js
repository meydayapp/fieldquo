// lib/estimate/report/email.js
//
// The emailed copy of the instant-estimate report: not a nudge to open the
// page, the report itself — the way QuickQuote's mail carries the two
// options and their starting-at figures in the body. The PDF rides along as
// the attachment and the page is linked, but a homeowner reading this in
// Gmail on a phone sees the price, the property and the three buttons
// without opening either.
//
// ── One model, one more rendering ───────────────────────────────────────────
//
// Every sentence, figure and URL here is `report`, the model from
// lib/estimate/report/model.js — the same object the page and the PDF are
// drawn from. This file lays it out and decides nothing: a gated trade's
// cards arrive with `startingAt: null` and print without a figure, exactly
// as the page shows them; a company with no calendar has no `book` and gets
// no button.
//
// ── Tables, because Outlook ─────────────────────────────────────────────────
//
// Same discipline as lib/sales/outreach/introEmail.js, whose table and button
// helpers are COPIED below rather than imported: that file is the sales
// portal's, edited by other hands for other reasons, and a document email
// must not change shape because a rep's pitch did. A button is a coloured
// cell with a link inside, never a styled <a>; the option cards are two
// cells of one row that Outlook keeps side by side at 600px and a phone
// stacks.
//
// ── Colours are measured ────────────────────────────────────────────────────
//
// Brand from documentTheme: fillPair on the buttons and the starting-at
// figure, washPair on the card tile, accentText for headings, inkMuted for
// the small print — the same pairs the page and the PDF use, all through
// lib/documents/theme.js, never the raw hex under text.
// estimateReportEmailPalette() exports every pair the markup puts text on
// so the check measures the real list, not a guess at it.
//
// Pure — hand it the model and the company, get { subject, html, text }.

import { documentTheme, fillPair, washPair, neutralPair, ruleColor } from "@/lib/documents/theme";
import { contrastRatio } from "@/lib/brand/colour";
import { escapeHtml, escapeAttr, safeUrl } from "@/lib/email/emailTheme";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * The palette, measured, and every foreground/background pair the email
 * puts text on — so the check is a loop over `pairs`, not a reading of the
 * markup.
 */
export function estimateReportEmailPalette(company = {}) {
  const theme = documentTheme(company);
  const fill = fillPair(theme);
  const wash = washPair(theme);
  const neutral = neutralPair(theme);
  return {
    theme,
    fill,
    wash,
    neutral,
    rule: ruleColor(theme),
    pairs: [
      { name: "body on paper", fg: theme.ink, bg: theme.paper },
      { name: "small print on paper", fg: theme.inkMuted, bg: theme.paper },
      { name: "headings on paper", fg: theme.accentText, bg: theme.paper },
      { name: "tile text and starting-at figure on fill", fg: fill.fg, bg: fill.bg },
      { name: "option tile label on wash", fg: wash.ink, bg: wash.bg },
      { name: "secondary button on wash", fg: wash.accent, bg: wash.bg },
      { name: "footer on neutral", fg: neutral.fg, bg: neutral.bg },
    ].map((p) => ({ ...p, ratio: contrastRatio(p.fg, p.bg) })),
  };
}

// ── Helpers (copied from lib/sales/outreach/introEmail.js — see header) ─────

function button({ href, label, bg, fg, border = null, bold = true, inline = false }) {
  const edge = border ? `border:1px solid ${border};` : "";
  const flow = inline ? "display:inline-block;margin:4px 5px;" : "";
  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${flow}">` +
    `<tr><td align="center" bgcolor="${bg}" style="background:${bg};${edge}border-radius:8px;">` +
    `<a href="${escapeAttr(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:15px;` +
    `font-weight:${bold ? 600 : 500};line-height:1.2;color:${fg};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>` +
    `</td></tr></table>`
  );
}

function para(inner, { size = 15, color, weight = 400, extra = "" } = {}) {
  return `<p style="margin:0;font-family:${FONT};font-size:${size}px;line-height:1.5;font-weight:${weight};color:${color};${extra}">${inner}</p>`;
}

function heading(label, c) {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 10px 0;">` +
    `<tr><td style="padding:0 0 5px 0;border-bottom:1px solid ${c.theme.accentRule};font-family:${FONT};font-size:11px;` +
    `letter-spacing:1.5px;font-weight:700;text-transform:uppercase;color:${c.theme.accentText};">${escapeHtml(label)}</td></tr></table>`
  );
}

function keyValueRows(rows, c) {
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    rows
      .map((r, i) => {
        const rule = i < rows.length - 1 ? `border-bottom:1px solid ${c.theme.borderSoft};` : "";
        return (
          `<tr>` +
          `<td style="padding:7px 8px 7px 0;font-family:${FONT};font-size:14px;color:${c.theme.inkMuted};${rule}">${escapeHtml(r.label)}</td>` +
          `<td align="right" style="padding:7px 0;font-family:${FONT};font-size:14px;font-weight:700;color:${c.theme.ink};${rule}">${escapeHtml(r.value)}</td>` +
          `</tr>`
        );
      })
      .join("") +
    `</table>`
  );
}

// One option card: a wash tile carrying the name (or the photograph, when a
// material ever has one), the tier line, and the starting-at figure on the
// fill. A card with no figure (a gated trade) ends at the name.
function optionCard(card, options, c, width) {
  const tile = card.imageUrl
    ? `<img src="${escapeAttr(safeUrl(card.imageUrl))}" alt="${escapeAttr(card.label || "")}" width="${width}" style="display:block;width:100%;height:auto;border-radius:10px 10px 0 0;">`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td align="center" bgcolor="${c.wash.bg}" style="background:${c.wash.bg};padding:26px 12px;border-radius:10px 10px 0 0;font-family:${FONT};font-size:15px;font-weight:700;color:${c.wash.ink};">${escapeHtml(card.label || options.startingAtLabel)}</td>` +
      `</tr></table>`;
  const tier = card.tier
    ? para(escapeHtml(card.tier) + (card.chosen ? ` &middot; ${escapeHtml(options.yourPickLabel)}` : ""), {
        size: 11,
        color: c.theme.accentText,
        weight: 700,
        extra: "letter-spacing:1.2px;text-transform:uppercase;",
      })
    : "";
  const figure = card.startingAt
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>` +
      `<td bgcolor="${c.fill.bg}" style="background:${c.fill.bg};padding:10px 12px;border-radius:8px;">` +
      `<div style="font-family:${FONT};font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:${c.fill.fg};">${escapeHtml(options.startingAtLabel)}</div>` +
      `<div style="font-family:${FONT};font-size:24px;line-height:1.2;font-weight:800;color:${c.fill.fg};">${escapeHtml(card.startingAt)}<span style="font-size:14px;">*</span></div>` +
      (card.unit ? `<div style="font-family:${FONT};font-size:11px;color:${c.fill.fg};">${escapeHtml(card.unit)}</div>` : "") +
      `</td></tr></table>`
    : "";
  return (
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${c.theme.border};border-radius:10px;border-collapse:separate;">` +
    `<tr><td style="padding:0;">${tile}</td></tr>` +
    `<tr><td style="padding:12px 12px 14px 12px;">` +
    tier +
    (card.label ? para(escapeHtml(card.label), { size: 15, color: c.theme.ink, weight: 700, extra: "margin-top:3px;" }) : "") +
    figure +
    `</td></tr></table>`
  );
}

const UPPER = "letter-spacing:1.5px;text-transform:uppercase;";

export function buildEstimateReportEmail({ report, company = {} }) {
  const c = estimateReportEmailPalette(company);
  const t = c.theme;
  const companyName = company.name || report.header.companyName || "";
  const logo = report.header.logoUrl ? safeUrl(report.header.logoUrl) : null;
  const e = report.email;
  const o = report.options;
  const q = report.questions;
  const m = report.measurement;
  const p = report.property;
  const n = report.notes;
  const reportUrl = safeUrl(n.viewOnline || "");
  const mapUrl = p.map?.imageUrl ? safeUrl(p.map.imageUrl) : "";

  // ── Header: brand rule, logo, the contact tiles ──────────────────────────
  const tiles = [report.header.call, report.header.email, report.header.website].filter(Boolean);
  const tilesHtml = tiles.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;border-collapse:separate;border-spacing:6px 0;margin-left:-6px;"><tr>` +
      tiles
        .map(
          (tile) =>
            `<td width="${Math.floor(100 / tiles.length)}%" align="center" bgcolor="${c.fill.bg}" style="background:${c.fill.bg};padding:9px 6px;border-radius:8px;">` +
            `<a href="${escapeAttr(safeUrl(tile.href))}" style="text-decoration:none;color:${c.fill.fg};font-family:${FONT};">` +
            `<span style="display:block;font-size:10px;font-weight:700;${UPPER}">${escapeHtml(tile.label)}</span>` +
            `<span style="display:block;font-size:12px;margin-top:2px;word-break:break-all;">${escapeHtml(tile.text || tile.href.replace(/^https?:\/\//, "").replace(/\/$/, ""))}</span>` +
            `</a></td>`,
        )
        .join("") +
      `</tr></table>`
    : "";

  // ── Options: the cards in one row, half width each ───────────────────────
  const cardsHtml = o.cards.length
    ? heading(o.title, c) +
      para(escapeHtml(o.intro), { size: 14, color: t.inkMuted, extra: "margin-bottom:12px;" }) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
      o.cards
        .map(
          (card, i) =>
            `<td width="${o.cards.length > 1 ? "50%" : "100%"}" valign="top" style="padding:0 ${i < o.cards.length - 1 ? "6px" : "0"} 0 ${i > 0 ? "6px" : "0"};">` +
            optionCard(card, o, c, o.cards.length > 1 ? 270 : 552) +
            `</td>`,
        )
        .join("") +
      `</tr></table>`
    : "";

  // ── The three buttons ────────────────────────────────────────────────────
  //
  // Book is the primary when there is a calendar; otherwise the call back
  // is. Every button has a real target or is not drawn — the model already
  // dropped `book` for a company that cannot take a visit and `website` for
  // one with no honest site.
  const secondary = { bg: c.wash.bg, fg: c.wash.accent, border: t.accentRule };
  const primary = { bg: c.fill.bg, fg: c.fill.fg };
  const buttons = [
    q.book && button({ href: q.book.href, label: q.book.label, ...primary, inline: true }),
    reportUrl && button({ href: `${reportUrl}#callback`, label: q.callback.label, ...(q.book ? secondary : primary), inline: true }),
    q.website && button({ href: q.website.href, label: q.website.label, ...secondary, inline: true }),
  ].filter(Boolean);
  const buttonsHtml = buttons.length
    ? heading(q.title, c) +
      para(escapeHtml(q.body), { size: 14, color: t.inkMuted, extra: "margin-bottom:10px;" }) +
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">${buttons.join("")}</td></tr></table>`
    : "";

  // ── Measurement summary ──────────────────────────────────────────────────
  const measurementHtml = m.rows.length
    ? heading(m.title, c) + keyValueRows(m.rows, c) + para(`** ${escapeHtml(m.verifyNote)}`, { size: 12, color: t.inkMuted, extra: "margin-top:8px;" })
    : "";

  // ── Property, and the map still linked to the online report ─────────────
  const mapHtml = mapUrl
    ? para(escapeHtml(p.map.title), { size: 11, color: t.accentText, weight: 700, extra: `margin-top:14px;${UPPER}` }) +
      `<a href="${escapeAttr(reportUrl || mapUrl)}" style="display:block;margin-top:8px;">` +
      `<img src="${escapeAttr(mapUrl)}" alt="${escapeAttr(p.map.title)}" width="552" style="display:block;width:100%;height:auto;border-radius:10px;border:1px solid ${t.border};"></a>` +
      para(escapeHtml(p.map.caption), { size: 12, color: t.inkMuted, extra: "margin-top:6px;" })
    : "";
  const propertyHtml = heading(p.title, c) + (p.rows.length ? keyValueRows(p.rows, c) : "") + mapHtml;

  // ── Notes: what happens next, disclaimers, report ID ─────────────────────
  const stepsHtml =
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:6px;">` +
    n.nextSteps
      .map(
        (step, i) =>
          `<tr>` +
          `<td valign="top" width="30" style="padding:0 8px 8px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${c.fill.bg}" width="22" height="22" style="background:${c.fill.bg};border-radius:11px;font-family:${FONT};font-size:12px;font-weight:700;color:${c.fill.fg};">${i + 1}</td></tr></table></td>` +
          `<td valign="top" style="padding:0 0 8px 0;font-family:${FONT};font-size:14px;line-height:1.5;color:${t.ink};">${escapeHtml(step)}</td>` +
          `</tr>`,
      )
      .join("") +
    `</table>`;
  const notesHtml =
    heading(n.title, c) +
    para(escapeHtml(n.emailed), { size: 14, color: t.ink }) +
    para(escapeHtml(n.nextTitle), { size: 11, color: t.accentText, weight: 700, extra: `margin-top:14px;${UPPER}` }) +
    stepsHtml +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;border-top:1px solid ${t.border};"><tr><td style="padding-top:8px;">` +
    n.disclaimers.map((d) => para(escapeHtml(d), { size: 11, color: t.inkMuted, extra: "margin-bottom:4px;" })).join("") +
    `</td></tr></table>` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:10px;"><tr>` +
    `<td style="font-family:${FONT};font-size:12px;color:${t.inkMuted};">${escapeHtml(n.reportIdLabel)}: <strong style="color:${t.ink};">${escapeHtml(n.reportId || "")}</strong></td>` +
    (reportUrl
      ? `<td align="right" style="font-family:${FONT};font-size:12px;"><a href="${escapeAttr(reportUrl)}" style="color:${t.accentText};font-weight:600;">${escapeHtml(n.viewOnlineLabel)}</a></td>`
      : "") +
    `</tr></table>`;

  const contactLine = [companyName, company.email, company.phone].filter(Boolean).map((x) => escapeHtml(x)).join(" &middot; ");

  const html =
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(e.subject)}</title></head>` +
    `<body style="margin:0;padding:0;background:${t.page};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${t.page}" style="background:${t.page};">` +
    `<tr><td align="center" style="padding:20px 12px;">` +
    `<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:${t.paper};border:1px solid ${t.border};border-radius:12px;border-collapse:separate;overflow:hidden;">` +
    // Brand rule.
    `<tr><td style="padding:0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="66%" height="5" bgcolor="${c.rule}" style="background:${c.rule};font-size:0;line-height:0;">&nbsp;</td>` +
    `<td width="34%" height="5" bgcolor="${t.accentSoft}" style="background:${t.accentSoft};font-size:0;line-height:0;">&nbsp;</td>` +
    `</tr></table></td></tr>` +
    // Masthead.
    `<tr><td style="padding:22px 24px 0 24px;">` +
    (logo
      ? `<img src="${escapeAttr(logo)}" alt="${escapeAttr(companyName)}" style="max-height:44px;max-width:180px;display:block;">` +
        para(escapeHtml(companyName), { size: 13, color: t.ink, extra: "margin-top:4px;" })
      : para(escapeHtml(companyName), { size: 20, color: t.accentText, weight: 800 })) +
    tilesHtml +
    `</td></tr>` +
    // Title block.
    `<tr><td style="padding:22px 24px 0 24px;">` +
    para(escapeHtml(e.greeting), { size: 15, color: t.ink, extra: "margin-bottom:10px;" }) +
    `<h1 style="margin:0;font-family:${FONT};font-size:24px;line-height:1.2;font-weight:800;color:${t.ink};">${escapeHtml(report.title.text)}</h1>` +
    (report.title.preparedFor
      ? para(`<span style="font-size:11px;font-weight:700;${UPPER}color:${t.accentText};">${escapeHtml(report.title.preparedForLabel)}</span>&nbsp; ${escapeHtml(report.title.preparedFor)}`, { size: 14, color: t.inkMuted, extra: "margin-top:10px;" })
      : "") +
    para(escapeHtml([report.title.preparedBy, report.title.date].filter(Boolean).join(" · ")), { size: 12, color: t.inkMuted, extra: "margin-top:3px;" }) +
    `</td></tr>` +
    // Body.
    `<tr><td style="padding:0 24px 18px 24px;">` +
    cardsHtml +
    buttonsHtml +
    measurementHtml +
    propertyHtml +
    notesHtml +
    para(escapeHtml(e.body), { size: 13, color: t.inkMuted, extra: "margin-top:18px;" }) +
    `</td></tr>` +
    // Footer.
    `<tr><td bgcolor="${c.neutral.bg}" style="background:${c.neutral.bg};padding:14px 24px;font-family:${FONT};font-size:12px;line-height:1.6;color:${c.neutral.fg};text-align:center;">` +
    escapeHtml(e.footer) +
    (contactLine ? `<br>${contactLine}` : "") +
    `</td></tr>` +
    `</table>` +
    `<!--[if mso]></td></tr></table><![endif]-->` +
    `</td></tr></table></body></html>`;

  // ── The plain-text alternative: the same figures, the same URLs ──────────
  const lines = [
    e.greeting,
    "",
    report.title.text,
    report.title.preparedFor ? `${report.title.preparedForLabel}: ${report.title.preparedFor}` : null,
    [report.title.preparedBy, report.title.date].filter(Boolean).join(" · "),
    "",
  ];
  if (o.cards.length) {
    lines.push(o.title.toUpperCase(), o.intro);
    for (const card of o.cards) {
      lines.push(
        `- ${[card.tier, card.label].filter(Boolean).join(": ")}${card.chosen ? ` (${o.yourPickLabel})` : ""}${
          card.startingAt ? ` — ${o.startingAtLabel} ${card.startingAt}*${card.unit ? ` ${card.unit}` : ""}` : ""
        }`,
      );
    }
    lines.push("");
  }
  lines.push(q.title.toUpperCase(), q.body);
  if (q.book) lines.push(`${q.book.label}: ${q.book.href}`);
  if (reportUrl) lines.push(`${q.callback.label}: ${reportUrl}#callback`);
  if (q.website) lines.push(`${q.website.label}: ${q.website.href}`);
  lines.push("");
  if (m.rows.length) {
    lines.push(m.title.toUpperCase(), ...m.rows.map((r) => `${r.label}: ${r.value}`), `** ${m.verifyNote}`, "");
  }
  lines.push(p.title.toUpperCase(), ...p.rows.map((r) => `${r.label}: ${r.value}`));
  if (mapUrl) lines.push(`${p.map.title}: ${mapUrl}`, p.map.caption);
  lines.push("", n.title.toUpperCase(), n.emailed, "", n.nextTitle.toUpperCase(), ...n.nextSteps.map((s, i) => `${i + 1}. ${s}`), "", ...n.disclaimers, "");
  lines.push(`${n.reportIdLabel}: ${n.reportId || ""}`);
  if (reportUrl) lines.push(`${n.viewOnlineLabel}: ${reportUrl}`);
  lines.push("", e.body, "", e.footer, [companyName, company.email, company.phone].filter(Boolean).join(" · "));

  return { subject: e.subject, html, text: lines.filter((l) => l !== null).join("\n") };
}
