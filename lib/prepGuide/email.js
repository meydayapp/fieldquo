// lib/prepGuide/email.js
//
// The covering email for the preparation guide. Same shell as the quote and
// invoice emails (documentEmailLayout.js) so it arrives as the third piece of
// the same stationery, in the client's language, from the company — never
// from FieldQuo.
//
// The email carries the first few checklist items inline, because a client
// on a phone in a driveway may never open the attachment, and the one line
// that matters most — move the car, empty the counters — should be readable
// in the preview pane. The rest, and everything else, is in the PDF.

import { documentTheme, fillPair, washPair } from "@/lib/documents/theme";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { documentEmailHtml, escapeHtml, EMAIL_FONT } from "@/lib/email/documentEmailLayout";
import { escapeAttr } from "@/lib/email/emailTheme";

/** How many checklist items the email shows before pointing at the PDF. */
export const INLINE_ITEMS = 4;

/**
 * @param data  buildPrepGuide()'s result
 * @returns {{ subject, html, text }}
 */
export function buildPrepGuideEmail(data) {
  const { company, copy, language } = data;
  const t = documentTheme(company);
  const fill = fillPair(t);
  const wash = washPair(t);
  const c = emailCopy(language);

  const subject = copy.subject(company.name || "", data.job.title, data.startDateText);
  const intro = copy.emailIntro(data.job.title, data.startDateText);

  // The first section's list inline; a multi-trade job says which trade.
  const first = data.sections[0];
  const inline = first ? first.guide.checklist.slice(0, INLINE_ITEMS) : [];
  const remaining = data.sections.reduce((n, s) => n + s.guide.checklist.length, 0) - inline.length;

  const items = inline
    .map((item) => {
      const [head, ...rest] = String(item).split(" — ");
      const detail = rest.join(" — ");
      return `<tr><td style="padding:0 0 8px;vertical-align:top;font-family:${EMAIL_FONT};font-size:14px;line-height:1.5;color:${wash.ink};">
              <span style="display:inline-block;width:10px;height:10px;border:1.5px solid ${wash.accent};border-radius:2px;margin:3px 8px 0 0;vertical-align:top;"></span>${
                detail
                  ? `<strong>${escapeHtml(head)}</strong> — ${escapeHtml(detail)}`
                  : escapeHtml(head)
              }
            </td></tr>`;
    })
    .join("");

  const docs = data.documents
    .map(
      (d) =>
        `<div style="padding:2px 0;"><a href="${escapeAttr(d.url)}" style="color:${t.accentText};text-decoration:underline;">${escapeHtml(d.title)}</a></div>`,
    )
    .join("");

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">${escapeHtml(c.greeting(data.clientFirstName))}</p>
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 20px;color:${t.inkMuted};">${escapeHtml(intro)}</p>
        ${
          inline.length
            ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${wash.bg}" style="background:${wash.bg};border-collapse:separate;border-radius:10px;margin:0 0 18px;">
          <tr><td style="padding:16px 18px 8px;">
            <div style="font-family:${EMAIL_FONT};font-size:11px;font-weight:700;letter-spacing:1.5px;color:${wash.accent};padding-bottom:10px;">${escapeHtml(
              (first?.label ? `${first.label} · ` : "") + copy.emailChecklistLead,
            ).toUpperCase()}</div>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${items}</table>
            ${
              remaining > 0
                ? `<div style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.5;color:${wash.muted};padding:2px 0 6px;">${escapeHtml(copy.emailMoreItems(remaining))}</div>`
                : ""
            }
          </td></tr>
        </table>`
            : ""
        }
        ${
          first?.guide.warning
            ? `<p style="font-family:${EMAIL_FONT};font-size:14px;line-height:1.6;margin:0 0 18px;color:${t.ink};"><strong>${escapeHtml(copy.importantLabel)}</strong> ${escapeHtml(first.guide.warning)}</p>`
            : ""
        }
        ${
          docs
            ? `<div style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;margin:0 0 18px;color:${t.inkMuted};"><div style="font-weight:700;color:${t.ink};padding-bottom:4px;">${escapeHtml(copy.emailDocs)}</div>${docs}</div>`
            : ""
        }
        <p style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;margin:0;color:${t.inkMuted};text-align:center;">${escapeHtml(copy.closing)}</p>`;

  const html = documentEmailHtml({
    company,
    theme: t,
    fill,
    label: copy.documentLabel,
    reference: data.startDateText,
    body,
    footerNote: escapeHtml(c.questions(company.phone)),
  });

  const text = [
    c.greeting(data.clientFirstName),
    "",
    intro,
    "",
    ...data.sections.flatMap((s) => [
      (s.label ? `${s.label} — ` : "") + copy.checklistHeading,
      ...s.guide.checklist.map((i) => `[ ] ${i}`),
      "",
      `${copy.importantLabel} ${s.guide.warning}`,
      "",
    ]),
    ...(data.documents.length ? [copy.emailDocs, ...data.documents.map((d) => `${d.title}: ${d.url}`), ""] : []),
    copy.closing,
    "",
    c.questions(company.phone),
    company.name || "",
  ].join("\n");

  return { subject, html, text };
}
