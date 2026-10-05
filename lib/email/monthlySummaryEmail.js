// lib/email/monthlySummaryEmail.js
//
// FieldQuo → a company's owners and admins, on the 1st: last month, laid out.
//
// ══ What it replaced ══════════════════════════════════════════════════════
//
// `<p>${summaryText}</p>` — one paragraph a model wrote around a JSON blob,
// From: FieldQuo, with no plain-text part. The owner's September copy read:
// "Revenue and expenses were both 0 this month, so no margin is available…
// Marketing spend was about 362.63 (converted from USD 261.11 at 1.3888, rate
// 34 days old)." Three things wrong in one sentence: numbers from the wrong
// month (see lib/analytics/monthlySummaryData.js), money with no currency,
// and the exchange-rate plumbing printed at a contractor.
//
// ══ The family it belongs to ══════════════════════════════════════════════
//
// FieldQuo talking to its own customer about their account, like
// lib/email/onboardingNextStepsEmail.js and lib/email/billingEmail.js — so it
// is FieldQuo-branded (the white-label rule is for mail a HOMEOWNER reads)
// and uses that family's measured palette. The company's name is in the
// heading because the month is theirs.
//
// ══ Layout rules it keeps ═════════════════════════════════════════════════
//
//   • Tables and inline styles; 600px; tiles two-up that stack under 480px
//     where the client honours the <style> block, and still fit two-up on a
//     phone where it does not.
//   • A dark palette under prefers-color-scheme for the clients that ask
//     (Apple Mail, iOS, Outlook for Mac). Every pair — light AND dark — is in
//     MONTHLY_SUMMARY_PAIRS and measured at 4.5:1 by
//     scripts/check-monthly-summary.mjs; check:email-contrast scans the
//     literals too.
//   • Money is ALWAYS formatAppMoney(amount, company currency, reader
//     language) — never a bare number. "≈" leads a figure that includes spend
//     converted from another currency, and that is all the reader is told
//     about conversion: no rate, no source, no age. Those belong on the Spend
//     page and on /platform, not in an owner's inbox.
//   • An unavailable figure prints its REASON in words, never 0.
//   • A plain-text part that says the same things.
//
// ══ Where the words come from ═════════════════════════════════════════════
//
// app.monthlySummary.* in app/i18n/appMessages.js, all nine catalogue
// languages. Insight sentences are catalogue templates with {placeholders};
// the AI step (lib/ai/monthlyDigest.js) may hand back its OWN wording, but in
// the same placeholder form, and this file fills both through `formatValue`
// — so a model never prints a number, this file does.

import { escapeHtml, escapeAttr } from "@/lib/email/emailTheme";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { formatAppMoney } from "@/lib/format/money";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { formatCompanyDate, DEFAULT_DATE_FORMAT } from "@/lib/format/companyDate";
import { LEAD_SOURCE_LABEL_KEY, UNKNOWN_LEAD_SOURCE_KEY } from "@/lib/leads/sourceLabel";

// A prefix, ending in a dot: check:translations reads any quoted app-key-shaped literal as a key, and skips one that ends in "."
const NS = "app.monthlySummary.";

// ── Palette ─────────────────────────────────────────────────────────────────
// Light: the billing / next-steps family's measured values, plus a tile wash
// and the two direction colours. Dark: chosen for the same pairs and measured
// the same way. Nothing here is a brand colour — this is FieldQuo's mail.
const L = {
  page: "#f5f5f5",
  card: "#ffffff",
  tile: "#f6f7f9",
  ink: "#111827",
  muted: "#4b5563",
  faint: "#595f6b",
  rule: "#e5e7eb",
  up: "#166534",
  down: "#b91c1c",
  bar: "#111827",
  track: "#e5e7eb",
  head: "#111827",
  headInk: "#ffffff",
  headSub: "#d1d5db",
  btn: "#111827",
  btnInk: "#ffffff",
};
const D = {
  page: "#0b0d12",
  card: "#151922",
  tile: "#1d2230",
  ink: "#f3f4f6",
  muted: "#cbd5e1",
  rule: "#2d3443",
  up: "#86efac",
  down: "#fecaca",
  bar: "#e5e7eb",
  track: "#2d3443",
  btn: "#f3f4f6",
  btnInk: "#111827",
};

/** Every text/ground pair this email renders, light and dark. Measured by the check. */
export const MONTHLY_SUMMARY_PAIRS = [
  { name: "body ink on card", fg: L.ink, bg: L.card },
  { name: "muted on card", fg: L.muted, bg: L.card },
  { name: "ink on tile", fg: L.ink, bg: L.tile },
  { name: "muted on tile", fg: L.muted, bg: L.tile },
  { name: "up on tile", fg: L.up, bg: L.tile },
  { name: "down on tile", fg: L.down, bg: L.tile },
  { name: "up on card", fg: L.up, bg: L.card },
  { name: "down on card", fg: L.down, bg: L.card },
  { name: "footer on page", fg: L.faint, bg: L.page },
  { name: "heading on header bar", fg: L.headInk, bg: L.head },
  { name: "header sub-line on header bar", fg: L.headSub, bg: L.head },
  { name: "button label on button", fg: L.btnInk, bg: L.btn },
  { name: "dark: ink on card", fg: D.ink, bg: D.card },
  { name: "dark: muted on card", fg: D.muted, bg: D.card },
  { name: "dark: ink on tile", fg: D.ink, bg: D.tile },
  { name: "dark: muted on tile", fg: D.muted, bg: D.tile },
  { name: "dark: up on tile", fg: D.up, bg: D.tile },
  { name: "dark: down on tile", fg: D.down, bg: D.tile },
  { name: "dark: up on card", fg: D.up, bg: D.card },
  { name: "dark: down on card", fg: D.down, bg: D.card },
  { name: "dark: footer on page", fg: D.muted, bg: D.page },
  { name: "dark: button label on button", fg: D.btnInk, bg: D.btn },
];

/** The catalogue language the email is written in: a catalogue code, else English. */
export function summaryLanguage(language) {
  const base = String(language || "").toLowerCase().split(/[-_]/)[0];
  return Object.prototype.hasOwnProperty.call(APP_MESSAGES, base) ? base : "en";
}

function textFor(lang) {
  const dict = APP_MESSAGES[lang] || {};
  return (key) => dict[key] ?? APP_MESSAGES.en[key] ?? key;
}

/**
 * Split a template into literal and placeholder parts.
 * `{name}` with a value becomes a value part; an unknown placeholder stays
 * literal text so a missing value is visible, never silently dropped.
 */
function fillParts(template, rendered) {
  const parts = [];
  const re = /\{(\w+)\}/g;
  let last = 0;
  let m;
  const src = String(template ?? "");
  while ((m = re.exec(src))) {
    if (m.index > last) parts.push({ text: src.slice(last, m.index), value: false });
    if (Object.prototype.hasOwnProperty.call(rendered, m[1])) parts.push({ text: rendered[m[1]], value: true });
    else parts.push({ text: m[0], value: false });
    last = re.lastIndex;
  }
  if (last < src.length) parts.push({ text: src.slice(last), value: false });
  return parts;
}

/**
 * The one formatter for everything this email prints.
 *
 * Exported because lib/ai/monthlyDigest.js fills the model's placeholder
 * sentences through exactly this — the model chooses words, this chooses how
 * every number looks.
 */
export function summaryFormatter({ language = "en", currency = "CAD" } = {}) {
  const lang = summaryLanguage(language);
  const t = textFor(lang);
  const { locale } = documentFormatters(lang, currency);
  const intFmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const pctFmt = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const monthFmt = new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" });

  const money = (amount, approximate = false) => {
    // formatAppMoney prints a null as $0.00 — the exact failure this email
    // exists to avoid — so a null never reaches it.
    if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) return null;
    return `${approximate ? "≈ " : ""}${formatAppMoney(Number(amount), currency, lang)}`;
  };
  const counted = (noun, n) => {
    const entry = t(`${NS}n.${noun}`);
    return typeof entry === "function" ? entry({ value: n }) : `${intFmt.format(n)} ${entry}`;
  };
  const sourceLabel = (source) => {
    if (source === null || source === undefined || source === "") return t(`${NS}sources.noSource`);
    if (source === "meta_lead_ad") return t("app.leads.source.meta_lead_form");
    const base = String(source).startsWith("funnel:") ? "funnel" : String(source);
    return t(LEAD_SOURCE_LABEL_KEY[base] || UNKNOWN_LEAD_SOURCE_KEY);
  };

  const formatValue = (v) => {
    if (!v || typeof v !== "object") return "";
    switch (v.kind) {
      case "money":
        return money(v.amount, v.approximate) ?? t(`${NS}na.unavailable`);
      case "count":
        return counted(v.noun, Number(v.n) || 0);
      case "number":
        return intFmt.format(Number(v.n) || 0);
      case "pct":
        return pctFmt.format(Number(v.ratio) || 0);
      case "month":
        return monthFmt.format(new Date(v.date));
      case "source":
        return sourceLabel(v.source);
      default:
        return "";
    }
  };

  const renderValues = (values) => Object.fromEntries(Object.entries(values || {}).map(([k, v]) => [k, formatValue(v)]));

  /** A template filled: { text, html } — values bold in the HTML. */
  const fill = (template, values) => {
    const parts = fillParts(template, renderValues(values));
    return {
      text: parts.map((p) => p.text).join(""),
      html: parts.map((p) => (p.value ? `<strong>${escapeHtml(p.text)}</strong>` : escapeHtml(p.text))).join(""),
    };
  };

  return { lang, t, locale, money, counted, intFmt, pctFmt, monthFmt, sourceLabel, formatValue, renderValues, fill };
}

/** The catalogue template for an insight fact. */
export function insightTemplate(key, language = "en") {
  return textFor(summaryLanguage(language))(`${NS}insight.${key}`);
}

/** The deterministic sentence for each fact — the fallback, and the AI's brief. */
export function fallbackInsights(facts, fmt) {
  return (facts || []).map((f) => fmt.fill(fmt.t(`${NS}insight.${f.key}`), f.values));
}

/** Where each insight's link goes. Every path is a real /app page. */
const LINK_PATHS = {
  invoices: ["/app/invoices", "link.invoices"],
  leads: ["/app/leads", "link.leads"],
  quotes: ["/app/quotes", "link.quotes"],
  jobs: ["/app/jobs", "link.jobs"],
  messages: ["/app/messages", "link.messages"],
  spend: ["/app/marketing/spend", "link.spend"],
};

const iso = (d) => new Date(d).toISOString().slice(0, 10);
const noon = (d) => {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), 12));
};

/**
 * @param {object}   p
 * @param {object}   p.summary    buildMonthlySummary()'s output
 * @param {object}   p.company    { name, currency, dateFormat }
 * @param {string}   p.language   the reader's language (user, else company default)
 * @param {string}   p.origin     absolute app origin for every link
 * @param {Array<{text, html}>|null} [p.insights]  sentences already filled
 *                   (the AI's, through summaryFormatter.fill); null → the
 *                   catalogue's own sentences for summary.insights
 * @returns {{ subject, html, text, language, links: string[], insights: Array<{text, html}> }}
 */
export function buildMonthlySummaryEmail({ summary, company, language = "en", origin, insights = null } = {}) {
  if (!summary?.period?.key) throw new Error("buildMonthlySummaryEmail: needs a summary from buildMonthlySummary()");
  const companyName = String(company?.name ?? "").trim();
  if (!companyName) throw new Error("buildMonthlySummaryEmail: the company's name is in the heading and cannot be empty");
  if (!origin || !/^https?:\/\//.test(String(origin))) throw new Error("buildMonthlySummaryEmail: needs an absolute origin for the links");
  const base = String(origin).replace(/\/+$/, "");
  const currency = company?.currency || "CAD";
  const dateFormat = company?.dateFormat || DEFAULT_DATE_FORMAT;
  const fmt = summaryFormatter({ language, currency });
  const { t, lang } = fmt;
  const k = (key) => t(`${NS}${key}`);
  const tiles = summary.tiles;
  const monthValue = { kind: "month", date: summary.period.start };

  // `{company}` is left as a literal by fill() (it is a name, not a value to
  // format or bold) and replaced here, escaped for the HTML.
  const heading = fmt.fill(k("heading"), { month: monthValue });
  const headingText = heading.text.replace("{company}", companyName);
  const headingHtml = heading.html.replace("{company}", escapeHtml(companyName));
  const subject = headingText;

  const lastDay = new Date(summary.period.end.getTime() - 86400000);
  const periodLine = `${formatCompanyDate(noon(summary.period.start), dateFormat)} – ${formatCompanyDate(noon(lastDay), dateFormat)}`;

  const headline = fmt.fill(k(`headline.${summary.headline.key}`), summary.headline.values);

  const sentences = Array.isArray(insights) && insights.length ? insights : fallbackInsights(summary.insights, fmt);

  // ── Links ───────────────────────────────────────────────────────────────
  const reportUrl = `${base}/app/analytics/kpis?from=${iso(summary.period.start)}&to=${iso(lastDay)}`;
  const contextual = [];
  for (const f of summary.insights || []) {
    const l = f.link && LINK_PATHS[f.link];
    if (!l || contextual.some((c) => c.key === f.link)) continue;
    // The money-owed panel already carries this link; twice is clutter.
    if (f.link === "invoices" && !summary.owed?.noInvoices) continue;
    contextual.push({ key: f.link, url: `${base}${l[0]}`, label: k(l[1]) });
    if (contextual.length === 2) break;
  }
  const invoicesUrl = `${base}${LINK_PATHS.invoices[0]}`;

  // ── Pieces ──────────────────────────────────────────────────────────────
  const naText = (m) => k(`na.${m.reason}`) === `${NS}na.${m.reason}` ? k("na.unavailable") : k(`na.${m.reason}`);

  /** The ▲/▼ line, coloured by whether the move is good news. */
  const delta = (m, goodWhen = "up") => {
    if (!m?.available || !m.change) return null;
    const c = m.change;
    if (c.direction === "flat") return { text: fmt.fill(k("delta.flat"), { month: { kind: "month", date: summary.prior.start } }).text, tone: "muted" };
    const tone = goodWhen === null ? "muted" : c.direction === goodWhen ? "up" : "down";
    if (c.fromNone) return { text: fmt.fill(k("delta.fromNone"), { month: { kind: "month", date: summary.prior.start } }).text, tone };
    if (c.pct === null) return null;
    const key = c.direction === "up" ? "delta.up" : "delta.down";
    return { text: fmt.fill(k(key), { pct: { kind: "pct", ratio: c.pct / 100 }, month: { kind: "month", date: summary.prior.start } }).text, tone };
  };

  const toneColor = (tone) => (tone === "up" ? L.up : tone === "down" ? L.down : L.muted);
  const toneClass = (tone) => (tone === "up" ? "fq-up" : tone === "down" ? "fq-down" : "fq-muted");

  const moneyOrNa = (m) => (m.available ? fmt.money(m.value, m.approximate) : null);
  const countOrNa = (m) => (m.available ? fmt.intFmt.format(m.value) : null);

  /** One figure: big value or its reason, then the delta, then sub-lines. */
  const figureHtml = ({ label, value, na, d, subs = [] }) => `
      <div class="fq-muted" style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${L.muted};margin:0 0 6px 0;">${escapeHtml(label)}</div>
      ${
        value !== null
          ? `<div class="fq-ink" style="font-size:22px;line-height:1.2;font-weight:700;color:${L.ink};">${escapeHtml(value)}</div>`
          : `<div class="fq-muted" style="font-size:14px;line-height:1.4;color:${L.muted};">${escapeHtml(na)}</div>`
      }
      ${d ? `<div class="${toneClass(d.tone)}" style="font-size:13px;line-height:1.4;font-weight:700;color:${toneColor(d.tone)};margin-top:4px;">${escapeHtml(d.text)}</div>` : ""}
      ${subs.map((s) => `<div class="fq-muted" style="font-size:13px;line-height:1.5;color:${L.muted};margin-top:6px;">${s}</div>`).join("")}`;

  const tileCell = (inner, { full = false } = {}) => `
    <td class="fq-col fq-tile" valign="top" ${full ? 'colspan="2"' : 'width="48%"'} style="background:${L.tile};border-radius:10px;padding:16px;${full ? "" : "width:48%;"}">${inner}</td>`;

  // Revenue: invoiced and collected side by side inside one tile.
  const revenueInner = `
      <div class="fq-muted" style="font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${L.muted};margin:0 0 10px 0;">${escapeHtml(k("tile.revenue"))}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
        <td valign="top" width="50%" style="width:50%;padding:0 8px 0 0;">${figureHtml({
          label: k("tile.invoiced"),
          value: moneyOrNa(tiles.invoiced),
          na: naText(tiles.invoiced),
          d: delta(tiles.invoiced),
        })}</td>
        <td valign="top" width="50%" style="width:50%;padding:0 0 0 8px;">${figureHtml({
          label: k("tile.collected"),
          value: moneyOrNa(tiles.collected),
          na: naText(tiles.collected),
          d: delta(tiles.collected),
        })}</td>
      </tr></table>`;

  const acceptedLine = tiles.quotesAccepted.available
    ? tiles.acceptance.available
      ? fmt.fill(k("tile.acceptedLine"), {
          accepted: { kind: "number", n: tiles.quotesAccepted.value },
          rate: { kind: "pct", ratio: tiles.acceptance.value },
        })
      : fmt.fill(k("tile.acceptedLineNoRate"), { accepted: { kind: "number", n: tiles.quotesAccepted.value } })
    : null;

  const cplLine = (() => {
    const m = tiles.costPerLead;
    if (!tiles.spend.available) return null;
    const label = escapeHtml(k("tile.cpl"));
    if (!m.available) return { html: `${label}: ${escapeHtml(naText(m))}`, text: `${k("tile.cpl")}: ${naText(m)}` };
    const d = delta(m, "down");
    const v = fmt.money(m.value, m.approximate);
    return {
      html: `${label}: <strong class="fq-ink" style="color:${L.ink};">${escapeHtml(v)}</strong>${d ? ` <span class="${toneClass(d.tone)}" style="color:${toneColor(d.tone)};font-weight:700;">${escapeHtml(d.text)}</span>` : ""}`,
      text: `${k("tile.cpl")}: ${v}${d ? ` (${d.text})` : ""}`,
    };
  })();
  const partialLine = tiles.spend.available && tiles.spend.partial ? k("note.spendPartial") : null;

  const tilesHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 12px;">
      <tr>${tileCell(revenueInner, { full: true })}</tr>
    </table>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0;">
      <tr>
        ${tileCell(figureHtml({ label: k("tile.leads"), value: countOrNa(tiles.leads), na: naText(tiles.leads), d: delta(tiles.leads) }))}
        <td class="fq-gap" width="4%" style="width:4%;min-width:12px;font-size:0;line-height:0;">&nbsp;</td>
        ${tileCell(figureHtml({
          label: k("tile.quotes"),
          value: countOrNa(tiles.quotesSent),
          na: naText(tiles.quotesSent),
          d: delta(tiles.quotesSent),
          subs: acceptedLine ? [acceptedLine.html] : [],
        }))}
      </tr>
      <tr><td colspan="3" style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
        ${tileCell(figureHtml({ label: k("tile.jobs"), value: countOrNa(tiles.jobs), na: naText(tiles.jobs), d: delta(tiles.jobs) }))}
        <td class="fq-gap" width="4%" style="width:4%;min-width:12px;font-size:0;line-height:0;">&nbsp;</td>
        ${tileCell(figureHtml({
          label: k("tile.spend"),
          value: moneyOrNa(tiles.spend),
          na: naText(tiles.spend),
          d: delta(tiles.spend, null),
          subs: [...(cplLine ? [cplLine.html] : []), ...(partialLine ? [escapeHtml(partialLine)] : [])],
        }))}
      </tr>
    </table>`;

  // ── Pipeline ────────────────────────────────────────────────────────────
  const FUNNEL_LABELS = { leads: "tile.leads", quotes: "tile.quotes", accepted: "funnel.accepted", jobs: "tile.jobs", paid: "funnel.paid" };
  const maxCount = Math.max(1, ...summary.funnel.map((s) => s.count));
  // A pipeline of five zeros says nothing the tiles have not; it is left out
  // rather than drawn as five empty tracks.
  const showFunnel = summary.funnel.some((s) => s.count > 0);
  const funnelHtml = showFunnel
    ? `
    ${sectionTitle(fmt.fill(k("funnel.title"), { month: monthValue }).text)}
    <p class="fq-muted" style="font-size:13px;line-height:1.6;color:${L.muted};margin:0 0 10px 0;">${escapeHtml(k("funnel.caption"))}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${summary.funnel
        .map((s) => {
          const pct = s.count > 0 ? Math.max(3, Math.round((s.count / maxCount) * 100)) : 0;
          return `<tr>
        <td class="fq-ink" style="padding:6px 8px 6px 0;font-size:14px;color:${L.ink};width:38%;">${escapeHtml(k(FUNNEL_LABELS[s.key]))}</td>
        <td style="padding:6px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;"><tr>
            <td class="fq-track" style="background:${L.track};border-radius:5px;height:10px;font-size:0;line-height:0;">${
              pct > 0
                ? `<table role="presentation" width="${pct}%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:${pct}%;"><tr><td class="fq-bar" style="background:${L.bar};border-radius:5px;height:10px;font-size:0;line-height:0;">&nbsp;</td></tr></table>`
                : "&nbsp;"
            }</td>
          </tr></table>
        </td>
        <td class="fq-ink" align="right" style="padding:6px 0 6px 10px;font-size:15px;font-weight:700;color:${L.ink};width:48px;">${escapeHtml(fmt.intFmt.format(s.count))}</td>
      </tr>`;
        })
        .join("")}
    </table>`
    : "";

  // ── Sources ─────────────────────────────────────────────────────────────
  const src = summary.sources || {};
  const th = (label, align = "left") =>
    `<td class="fq-muted fq-rule" align="${align}" style="padding:6px 4px;font-size:12px;font-weight:700;color:${L.muted};border-bottom:1px solid ${L.rule};">${escapeHtml(label)}</td>`;
  const td = (value, align = "left", bold = false) =>
    `<td class="fq-ink fq-rule" align="${align}" style="padding:8px 4px;font-size:14px;color:${L.ink};border-bottom:1px solid ${L.rule};${bold ? "font-weight:700;" : ""}">${escapeHtml(value)}</td>`;
  // Rows that READ the same are one row: two source words this version does
  // not know both print "A source this version doesn't know", and two lines
  // with the same label and different numbers look like a bug.
  const leadRows = [];
  for (const r of src.leads || []) {
    const label = fmt.sourceLabel(r.source);
    const held = leadRows.find((x) => x.label === label);
    if (held) {
      held.leads += r.leads;
      held.quoted += r.quoted;
      held.won += r.won;
    } else leadRows.push({ ...r, label });
  }
  leadRows.sort((a, b) => b.leads - a.leads || b.won - a.won);
  const leadTable = leadRows.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>${th(k("sources.source"))}${th(k("sources.leads"), "right")}${th(k("sources.quoted"), "right")}${th(k("sources.won"), "right")}</tr>
        ${leadRows
          .map((r) => `<tr>${td(r.label, "left", true)}${td(fmt.intFmt.format(r.leads), "right")}${td(fmt.intFmt.format(r.quoted), "right")}${td(fmt.intFmt.format(r.won), "right")}</tr>`)
          .join("")}
        ${src.other ? `<tr>${td(k("sources.other"), "left", true)}${td(fmt.intFmt.format(src.other.leads), "right")}${td(fmt.intFmt.format(src.other.quoted), "right")}${td(fmt.intFmt.format(src.other.won), "right")}</tr>` : ""}
      </table>`
    : "";
  const campaignCpl = (c) => (c.costPerLead !== null && c.costPerLead !== undefined ? fmt.money(c.costPerLead, c.approximate) : c.spend === null ? k("sources.noSpend") : k("sources.noLeads"));
  // Money received for the campaign's jobs (the rollup's `paid`); null is
  // "nothing invoiced yet", said in words — never $0.00.
  const campaignPaid = (c) => (c.paid !== null && c.paid !== undefined ? fmt.money(c.paid) : k("sources.notInvoiced"));
  const fillCount = (template, n) => String(template).replace("{count}", fmt.intFmt.format(n));
  const campaignTable = (src.campaigns || []).length
    ? `<p class="fq-ink" style="font-size:14px;font-weight:700;color:${L.ink};margin:18px 0 4px 0;">${escapeHtml(k("sources.campaigns"))}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <tr>${th(k("sources.campaign"))}${th(k("sources.leads"), "right")}${th(k("tile.cpl"), "right")}${th(k("sources.quotes"), "right")}${th(k("sources.paid"), "right")}</tr>
        ${src.campaigns
          .map(
            (c) => `<tr>
          <td class="fq-ink fq-rule" style="padding:8px 4px;font-size:14px;color:${L.ink};border-bottom:1px solid ${L.rule};font-weight:700;">${escapeHtml(c.name || k("sources.unnamedCampaign"))}${
            c.conversationLeads > 0
              ? `<div class="fq-muted" style="font-size:12px;font-weight:400;color:${L.muted};margin-top:2px;">${escapeHtml(fillCount(k("sources.fromMessages"), c.conversationLeads))}</div>`
              : ""
          }</td>${td(fmt.intFmt.format(c.leads), "right")}${td(campaignCpl(c), "right")}${td(fmt.intFmt.format(c.quotes), "right")}${td(campaignPaid(c), "right")}</tr>`,
          )
          .join("")}
      </table>
      <p class="fq-muted" style="font-size:12px;line-height:1.6;color:${L.muted};margin:6px 0 0 0;">${escapeHtml(k("sources.campaignNote"))}</p>`
    : "";
  // ── Google Ads: label/value pairs, on FieldQuo's own Google leads ────────
  // lib/analytics/monthlySummary.js `sources.googleAds`: cost per lead and per
  // won job divide Google spend by leads that arrived with a Google click id.
  // Google's own conversions are printed as Google's, never as leads.
  const g = src.googleAds || null;
  const googlePairs = g
    ? [
        [k("tile.spend"), g.spend !== null && g.spend !== undefined ? fmt.money(g.spend, g.approximate) : k("sources.noSpend")],
        [k("sources.googleLeads"), fmt.intFmt.format(g.leads)],
        [k("tile.cpl"), g.costPerLead !== null && g.costPerLead !== undefined ? fmt.money(g.costPerLead, g.approximate) : g.spend === null ? k("sources.noSpend") : k("sources.noLeads")],
        [k("sources.wonJobs"), fmt.intFmt.format(g.wonJobs)],
        [k("sources.costPerWonJob"), g.costPerWonJob !== null && g.costPerWonJob !== undefined ? fmt.money(g.costPerWonJob, g.approximate) : k("sources.noWonJob")],
        ...(g.googleConversions !== null && g.googleConversions !== undefined ? [[k("sources.googleConversions"), new Intl.NumberFormat(fmt.locale, { maximumFractionDigits: 2 }).format(g.googleConversions)]] : []),
      ]
    : [];
  const googleHtml = g
    ? `<p class="fq-ink" style="font-size:14px;font-weight:700;color:${L.ink};margin:18px 0 4px 0;">${escapeHtml(k("sources.googleAds"))}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${googlePairs.map(([label, value]) => `<tr>${td(label, "left", true)}${td(value, "right")}</tr>`).join("")}
      </table>
      <p class="fq-muted" style="font-size:12px;line-height:1.6;color:${L.muted};margin:6px 0 0 0;">${escapeHtml(k("sources.googleNote"))}</p>`
    : "";
  const conversationLines = (src.conversations || []).map((c) => ({
    label: fmt.sourceLabel(c.source),
    line: fmt.fill(k("sources.conversationsLine"), {
      conversations: { kind: "count", n: c.conversations, noun: "conversations" },
      won: { kind: "number", n: c.won },
    }),
  }));
  const conversationHtml = conversationLines.length
    ? `<p class="fq-ink" style="font-size:14px;font-weight:700;color:${L.ink};margin:18px 0 4px 0;">${escapeHtml(k("sources.conversations"))}</p>
      ${conversationLines
        .map((c) => `<p class="fq-ink" style="font-size:14px;line-height:1.6;color:${L.ink};margin:0;">${escapeHtml(c.label)}: ${c.line.html}</p>`)
        .join("")}`
    : "";
  const sourcesHtml = leadTable || campaignTable || googleHtml || conversationHtml ? `${sectionTitle(k("sources.title"))}${leadTable}${campaignTable}${googleHtml}${conversationHtml}` : "";

  // ── Money owed ──────────────────────────────────────────────────────────
  const owed = summary.owed || {};
  let owedLines = null;
  if (!owed.noInvoices) {
    if (owed.overdueCount > 0) {
      owedLines = [
        fmt.fill(k("owed.overdue"), {
          amount: { kind: "money", amount: owed.overdueTotal },
          invoices: { kind: "count", n: owed.overdueCount, noun: "invoices" },
        }),
        ...(owed.oldestDays ? [fmt.fill(k("owed.oldest"), { days: { kind: "count", n: owed.oldestDays, noun: "days" } })] : []),
      ];
    } else if (owed.count > 0) {
      owedLines = [fmt.fill(k("owed.notOverdue"), { amount: { kind: "money", amount: owed.total } })];
    } else {
      owedLines = [{ text: k("owed.none"), html: escapeHtml(k("owed.none")) }];
    }
  }
  const owedHtml = owedLines
    ? `${sectionTitle(k("owed.title"))}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;"><tr>
      <td class="fq-tile" style="background:${L.tile};border-radius:10px;padding:16px;">
        ${owedLines.map((l) => `<p class="fq-ink" style="font-size:15px;line-height:1.6;color:${L.ink};margin:0 0 4px 0;">${l.html}</p>`).join("")}
        <p style="margin:8px 0 0 0;"><a href="${escapeAttr(invoicesUrl)}" style="font-size:14px;font-weight:700;color:${L.ink};text-decoration:underline;"><span class="fq-link" style="color:${L.ink};">${escapeHtml(k("link.invoices"))}</span></a></p>
      </td>
    </tr></table>`
    : "";

  // ── Insights ────────────────────────────────────────────────────────────
  const insightsHtml = sentences.length
    ? `${sectionTitle(k("insights.title"))}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${sentences
        .map(
          (s, i) => `<tr>
        <td valign="top" style="width:34px;padding:10px 0 0 0;">
          <div class="fq-num" style="width:24px;height:24px;border-radius:12px;background:${L.btn};color:${L.btnInk};font-weight:700;font-size:13px;line-height:24px;text-align:center;">${i + 1}</div>
        </td>
        <td class="fq-ink fq-rule" valign="top" style="padding:10px 0 12px 6px;font-size:15px;line-height:1.6;color:${L.ink};border-bottom:1px solid ${L.rule};">${s.html}</td>
      </tr>`,
        )
        .join("")}
    </table>`
    : "";

  const ctaHtml = `
    <div style="text-align:center;margin:28px 0 0 0;">
      <a class="fq-btn" href="${escapeAttr(reportUrl)}" style="display:inline-block;padding:14px 30px;background:${L.btn};color:${L.btnInk};text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;"><span class="fq-btn-ink" style="color:${L.btnInk};">${escapeHtml(k("cta.report"))}</span></a>
    </div>
    ${
      contextual.length
        ? `<p style="text-align:center;margin:14px 0 0 0;font-size:14px;line-height:1.8;">${contextual
            .map((c) => `<a href="${escapeAttr(c.url)}" style="color:${L.ink};font-weight:700;text-decoration:underline;margin:0 10px;"><span class="fq-link" style="color:${L.ink};">${escapeHtml(c.label)}</span></a>`)
            .join(" ")}</p>`
        : ""
    }`;

  const footer = k("footer").replace("{company}", companyName);

  function sectionTitle(text) {
    return `<h2 class="fq-ink" style="font-size:17px;line-height:1.4;font-weight:700;color:${L.ink};margin:30px 0 10px 0;">${escapeHtml(text)}</h2>`;
  }

  const darkCss = `
    :root { color-scheme: light dark; supported-color-schemes: light dark; }
    @media only screen and (max-width: 480px) {
      .fq-col { display: block !important; width: 100% !important; box-sizing: border-box !important; }
      .fq-gap { display: block !important; width: 100% !important; height: 12px !important; }
      .fq-pad { padding: 24px 18px !important; }
    }
    @media (prefers-color-scheme: dark) {
      .fq-page { background: ${D.page} !important; }
      .fq-card { background: ${D.card} !important; }
      .fq-tile { background: ${D.tile} !important; }
      .fq-ink { color: ${D.ink} !important; }
      .fq-muted, .fq-faint { color: ${D.muted} !important; }
      .fq-up { color: ${D.up} !important; }
      .fq-down { color: ${D.down} !important; }
      .fq-rule { border-color: ${D.rule} !important; }
      .fq-track { background: ${D.track} !important; }
      .fq-bar { background: ${D.bar} !important; }
      .fq-btn, .fq-num { background: ${D.btn} !important; color: ${D.btnInk} !important; }
      .fq-btn-ink { color: ${D.btnInk} !important; }
      .fq-link { color: ${D.ink} !important; }
    }`;

  const html = `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${escapeHtml(subject)}</title>
    <style>${darkCss}
    </style>
  </head>
  <body class="fq-page" style="margin:0;padding:0;background:${L.page};font-family:Arial,Helvetica,sans-serif;color:${L.ink};-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(headline.text)}</div>
    <table role="presentation" class="fq-page" width="100%" cellpadding="0" cellspacing="0" style="background:${L.page};border-collapse:collapse;">
      <tr><td align="center" style="padding:20px 10px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;border-collapse:collapse;">
          <tr><td style="background:${L.head};color:${L.headInk};padding:28px 30px;border-radius:12px 12px 0 0;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${L.headSub};">FieldQuo · ${escapeHtml(k("eyebrow"))}</div>
            <h1 style="margin:8px 0 0 0;font-size:24px;line-height:1.3;font-weight:700;color:${L.headInk};">${headingHtml}</h1>
            <div style="margin-top:6px;font-size:13px;color:${L.headSub};">${escapeHtml(periodLine)}</div>
          </td></tr>
          <tr><td class="fq-card fq-pad" style="background:${L.card};padding:28px 30px 32px 30px;border-radius:0 0 12px 12px;">
            <p class="fq-ink" style="font-size:17px;line-height:1.6;color:${L.ink};margin:0 0 8px 0;">${headline.html}</p>
            ${tilesHtml}
            ${insightsHtml}
            ${funnelHtml}
            ${sourcesHtml}
            ${owedHtml}
            ${ctaHtml}
          </td></tr>
          <tr><td class="fq-faint" align="center" style="padding:18px 20px;color:${L.faint};font-size:12px;line-height:1.6;">${escapeHtml(footer)}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  // ── Plain text ──────────────────────────────────────────────────────────
  const line = (label, value, d) => `${label}: ${value}${d ? ` (${d.text})` : ""}`;
  const figureText = (label, m, value, goodWhen = "up") => line(label, value ?? naText(m), delta(m, goodWhen));
  const text = [
    headingText,
    periodLine,
    "",
    headline.text,
    "",
    `${k("tile.revenue")}`,
    `  ${figureText(k("tile.invoiced"), tiles.invoiced, moneyOrNa(tiles.invoiced))}`,
    `  ${figureText(k("tile.collected"), tiles.collected, moneyOrNa(tiles.collected))}`,
    figureText(k("tile.leads"), tiles.leads, countOrNa(tiles.leads)),
    figureText(k("tile.quotes"), tiles.quotesSent, countOrNa(tiles.quotesSent)) + (acceptedLine ? ` — ${acceptedLine.text}` : ""),
    figureText(k("tile.jobs"), tiles.jobs, countOrNa(tiles.jobs)),
    figureText(k("tile.spend"), tiles.spend, moneyOrNa(tiles.spend), null),
    ...(cplLine ? [`  ${cplLine.text}`] : []),
    ...(partialLine ? [`  ${partialLine}`] : []),
    ...(sentences.length ? ["", k("insights.title"), ...sentences.map((s, i) => `${i + 1}. ${s.text}`)] : []),
    ...(showFunnel
      ? ["", fmt.fill(k("funnel.title"), { month: monthValue }).text, ...summary.funnel.map((s) => `  ${k(FUNNEL_LABELS[s.key])}: ${fmt.intFmt.format(s.count)}`)]
      : []),
    ...(sourcesHtml
      ? [
          "",
          k("sources.title"),
          // "Label: n" pairs, the table's own column headings — never a count
          // glued to a noun, which no catalogue entry could decline correctly.
          ...leadRows.map((r) => `  ${r.label} — ${k("sources.leads")}: ${fmt.intFmt.format(r.leads)} · ${k("sources.quoted")}: ${fmt.intFmt.format(r.quoted)} · ${k("sources.won")}: ${fmt.intFmt.format(r.won)}`),
          ...(src.other ? [`  ${k("sources.other")} — ${k("sources.leads")}: ${fmt.intFmt.format(src.other.leads)} · ${k("sources.quoted")}: ${fmt.intFmt.format(src.other.quoted)} · ${k("sources.won")}: ${fmt.intFmt.format(src.other.won)}`] : []),
          ...((src.campaigns || []).length ? ["", k("sources.campaigns")] : []),
          ...(src.campaigns || []).map((c) => `  ${c.name || k("sources.unnamedCampaign")} — ${k("sources.leads")}: ${fmt.intFmt.format(c.leads)} · ${k("tile.cpl")}: ${campaignCpl(c)} · ${k("sources.quotes")}: ${fmt.intFmt.format(c.quotes)} · ${k("sources.jobs")}: ${fmt.intFmt.format(c.jobs)} · ${k("sources.paid")}: ${campaignPaid(c)}${c.conversationLeads > 0 ? ` (${fillCount(k("sources.fromMessages"), c.conversationLeads)})` : ""}`),
          ...((src.campaigns || []).length ? [`  ${k("sources.campaignNote")}`] : []),
          ...(g ? ["", k("sources.googleAds"), ...googlePairs.map(([label, value]) => `  ${label}: ${value}`), `  ${k("sources.googleNote")}`] : []),
          ...(conversationLines.length ? ["", k("sources.conversations")] : []),
          ...conversationLines.map((c) => `  ${c.label}: ${c.line.text}`),
        ]
      : []),
    ...(owedLines ? ["", k("owed.title"), ...owedLines.map((l) => `  ${l.text}`), `  ${k("link.invoices")}: ${invoicesUrl}`] : []),
    "",
    `${k("cta.report")}: ${reportUrl}`,
    ...contextual.map((c) => `${c.label}: ${c.url}`),
    "",
    "—",
    footer,
  ].join("\n");

  return {
    subject,
    html,
    text,
    language: lang,
    links: [reportUrl, ...contextual.map((c) => c.url), ...(owedLines ? [invoicesUrl] : [])],
    insights: sentences,
    headline: headline.text,
  };
}
