// lib/estimate/report/email.js
//
// The covering email for the instant-estimate report: the company's brand,
// a greeting, one line saying the report is attached, one button to open it
// online. The report itself is the PDF and the page — the email is a nudge to
// open them, not a third copy that could disagree with either.
//
// Same frame as lib/estimate/estimateEmail.js (the confirmation sent when the
// form was submitted): the button pair is the MEASURED fillPair, the logo
// band is the fill, nothing names FieldQuo. In the report's language.
//
// Pure — hand it the model, get { subject, html, text }.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { escapeHtml, safeUrl } from "@/lib/email/emailTheme";

export function buildEstimateReportEmail({ report, company = {} }) {
  const theme = documentTheme(company);
  const { bg: accent, fg: accentInk } = fillPair(theme);
  const companyName = company.name || "";
  const logo = company.logoUrl ? safeUrl(company.logoUrl) : null;
  const e = report.email;
  const url = safeUrl(report.notes.viewOnline || "");

  const contactLine = [company.phone, company.email]
    .filter(Boolean)
    .map((x) => escapeHtml(x))
    .join("  ·  ");

  const html = `
<div style="margin:0;padding:24px 12px;background:${theme.page};font-family:system-ui,-apple-system,Segoe UI,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:${theme.paper};border-radius:12px;overflow:hidden;border:1px solid ${theme.border};">
    <div style="background:${accent};padding:22px 28px;">
      ${
        logo
          ? `<img src="${logo}" alt="${escapeHtml(companyName)}" style="max-height:40px;max-width:180px;display:block;">`
          : `<div style="color:${accentInk};font-size:18px;font-weight:800;">${escapeHtml(companyName)}</div>`
      }
    </div>
    <div style="padding:28px;">
      <p style="margin:0 0 12px;font-size:15px;color:${theme.ink};">${escapeHtml(e.greeting)}</p>
      <p style="margin:0 0 6px;font-size:15px;line-height:1.6;color:${theme.ink};">${escapeHtml(e.body)}</p>
      <p style="margin:14px 0 0;font-size:13px;color:${theme.inkMuted};">${escapeHtml(report.title.text)}${
        report.title.preparedFor ? ` — ${escapeHtml(report.title.preparedFor)}` : ""
      }</p>
      ${
        url
          ? `<div style="text-align:center;margin:22px 0 0;">
        <a href="${url}" style="display:inline-block;background:${accent};color:${accentInk};text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;font-size:15px;">${escapeHtml(e.cta)}</a>
      </div>`
          : ""
      }
      <p style="margin:18px 0 0;font-size:13px;color:${theme.inkMuted};">${escapeHtml(report.notes.reportIdLabel)}: <strong style="color:${theme.ink};">${escapeHtml(report.notes.reportId || "")}</strong></p>
      <p style="margin:22px 0 0;font-size:14px;color:${theme.ink};">${escapeHtml(e.footer)}</p>
      ${contactLine ? `<p style="margin:16px 0 0;padding-top:16px;border-top:1px solid ${theme.border};font-size:13px;color:${theme.inkMuted};">${contactLine}</p>` : ""}
    </div>
  </div>
</div>`.trim();

  const text = [
    e.greeting,
    "",
    e.body,
    "",
    `${report.title.text}${report.title.preparedFor ? ` — ${report.title.preparedFor}` : ""}`,
    url ? `${e.cta}: ${url}` : null,
    `${report.notes.reportIdLabel}: ${report.notes.reportId || ""}`,
    "",
    e.footer,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return { subject: e.subject, html, text };
}
