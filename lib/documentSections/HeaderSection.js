// lib/documentSections/HeaderSection.js
//
// The masthead: brand rule, logo, and the document's identity block.
//
// ── What changed and why ────────────────────────────────────────────────────
//
// This was a centred logo above a centred company name. That's the layout of a
// letterhead, not a commercial document, and it spent the top fifth of page
// one telling the client something they already know — who sent it. What
// they're actually looking for at the top of a quote is: is this the right
// document, what's the reference, and how long do I have to decide.
//
// So: identity on the left, document facts on the right, and a brand-coloured
// rule across the very top that makes the page unmistakably theirs before a
// word is read. Every colour comes from Company.brandColor via documentTheme —
// nothing here is a fixed FieldQuo colour, because this is the company's
// document, not ours.

import { View, Text, Image } from "@react-pdf/renderer";
import { documentTheme, ruleColor, statusStyle } from "@/lib/documents/theme";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { documentIssueDate } from "@/lib/documents/issueDate";

export const meta = { type: "header", label: "Header" };

function docTitle(data) {
  if (data.invoiceNumber) return { word: "INVOICE", number: data.invoiceNumber };
  return { word: "QUOTE", number: data.quoteNumber || "" };
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderEmailHtml({ company = {}, data = {} }) {
  const t = documentTheme(company);
  const { word, number } = docTitle(data);

  // Table-based rather than flex: email clients still don't handle flexbox
  // reliably, and a masthead that collapses in Outlook is worse than one that
  // never tried to be clever.
  return `
    <div style="border-top:4px solid ${ruleColor(t)};padding-top:18px;margin-bottom:22px;">
      <table style="width:100%;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;">
        <tr>
          <td style="vertical-align:top;">
            ${
              company.logoUrl
                ? `<img src="${company.logoUrl}" alt="${escapeHtml(company.name)}" style="max-height:44px;display:block;margin-bottom:6px;" />`
                : `<div style="font-size:18px;font-weight:700;color:${t.accentText};margin-bottom:4px;">${escapeHtml(company.name || "")}</div>`
            }
            ${company.email ? `<div style="font-size:11px;color:${t.inkMuted};">${escapeHtml(company.email)}</div>` : ""}
            ${company.phone ? `<div style="font-size:11px;color:${t.inkMuted};">${escapeHtml(company.phone)}</div>` : ""}
          </td>
          <td style="vertical-align:top;text-align:right;">
            <div style="font-size:20px;font-weight:800;letter-spacing:2px;color:${t.accentText};">${word}</div>
            <div style="font-size:13px;font-weight:700;color:${t.ink};">${escapeHtml(number)}</div>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export function PdfSection({ company = {}, data = {}, language }) {
  const t = documentTheme(company);
  const { date } = documentFormatters(language);
  const { word, number } = docTitle(data);
  const status = statusStyle(data.status, t);

  return (
    <View>
      {/* The brand rule. First mark on the page, ahead of the logo — it reads
          as the document being ON their letterhead rather than having their
          logo pasted into a generic one. Two weights of the same hue rather
          than a gradient, which react-pdf can't do. */}
      <View style={{ flexDirection: "row", marginBottom: 16 }}>
        <View style={{ height: 4, flex: 2, backgroundColor: ruleColor(t) }} />
        <View style={{ height: 4, flex: 1, backgroundColor: t.accentSoft }} />
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          paddingBottom: 14,
          borderBottom: `1 solid ${t.accentRule}`,
          marginBottom: 16,
        }}
      >
        <View style={{ flex: 1, paddingRight: 16 }}>
          {company.logoUrl ? (
            <Image
              src={company.logoUrl}
              style={{
                height: 34,
                maxWidth: 170,
                objectFit: "contain",
                marginBottom: 6,
                // Without this a contained image centres itself in the flex
                // column, leaving the logo floating above left-aligned text.
                alignSelf: "flex-start",
              }}
            />
          ) : (
            <Text
              style={{
                fontSize: 15,
                fontFamily: "Helvetica-Bold",
                color: t.accentText,
                marginBottom: 4,
              }}
            >
              {company.name}
            </Text>
          )}

          {company.logoUrl && company.name && (
            <Text style={{ fontSize: 9, color: t.ink, marginBottom: 2 }}>
              {company.name}
            </Text>
          )}
          {company.email && (
            <Text style={{ fontSize: 8, color: t.inkMuted }}>
              {company.email}
            </Text>
          )}
          {company.phone && (
            <Text style={{ fontSize: 8, color: t.inkMuted }}>
              {company.phone}
            </Text>
          )}
          {company.website && (
            <Text style={{ fontSize: 8, color: t.inkMuted }}>
              {company.website}
            </Text>
          )}
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text
            style={{
              fontSize: 18,
              fontFamily: "Helvetica-Bold",
              letterSpacing: 2,
              color: t.accentText,
            }}
          >
            {word}
          </Text>
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Helvetica-Bold",
              color: t.ink,
              marginBottom: 3,
            }}
          >
            {number}
          </Text>

          {documentIssueDate(data) && (
            <Text style={{ fontSize: 8, color: t.inkMuted }}>
              {date(documentIssueDate(data))}
            </Text>
          )}
          {data.validUntil && (
            <Text style={{ fontSize: 8, color: t.inkMuted }}>
              Valid until {date(data.validUntil)}
            </Text>
          )}
          {data.dueDate && (
            <Text style={{ fontSize: 8, color: t.inkMuted }}>
              Due {date(data.dueDate)}
            </Text>
          )}

          {data.status && (
            <View
              style={{
                marginTop: 5,
                paddingVertical: 2,
                paddingHorizontal: 7,
                borderRadius: 8,
                backgroundColor: status.bg,
              }}
            >
              <Text
                style={{
                  fontSize: 7,
                  fontFamily: "Helvetica-Bold",
                  color: status.fg,
                  letterSpacing: 0.6,
                }}
              >
                {String(data.status).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
