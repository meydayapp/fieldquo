// lib/documentSections/ScopeGroupsSection.js
//
// The work itself — the part of a quote the client actually reads.
//
// ── History worth keeping ───────────────────────────────────────────────────
//
// This file was once a byte-for-byte copy of ClientInfoSection.js, right down
// to `meta.type = "client_info"`. The registry maps `scope_groups` here, so
// every quote PDF printed the client's address twice and no priced work at
// all. Nothing caught it: the module exported the right shape, just the wrong
// content.
//
// ── Why it's a card per service rather than a table ─────────────────────────
//
// FieldQuo already supported multi-service quotes — a quote has scopeGroups,
// each pointing at a ServiceCategory, so "interior painting + flooring" has
// always worked as data. What it lacked was any way for the document to say
// so. Every group rendered as a bare label above a column of amounts, which
// meant a $14,000 kitchen and a $200 tap repair produced the same document at
// different scales.
//
// The difference between those isn't price, it's confidence. A client
// comparing three quotes picks the one that reads like the company has done
// the job before: what's included, in what order. So each group becomes a card
// carrying its own accent, its own total, and its own "what's included" —
// from lib/documents/serviceContent.js, which ships good defaults per trade
// and lets a company override them.
//
// The per-service accent is a thin left border and a wash, never a fill. The
// page's own accent — rules, totals, masthead — stays the company's brand
// colour throughout, so a three-trade quote still reads as one document from
// one business rather than three quotes stapled together.

import { View, Text } from "@react-pdf/renderer";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { documentTheme } from "@/lib/documents/theme";
import { resolveServiceContent } from "@/lib/documents/serviceContent";
import { tint } from "@/lib/brand/colour";

export const meta = { type: "scope_groups", label: "Line items" };

const num = (v) => Number(v ?? 0);

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Quotes carry scopeGroups (work grouped by service); invoices carry a flat
// lineItems array. Both are the same thing to a client, so normalise here
// rather than making every caller pick a shape.
function toGroups(data) {
  if (Array.isArray(data.scopeGroups) && data.scopeGroups.length) {
    return data.scopeGroups.map((g) => ({
      label: g.label || g.category?.label || "",
      categoryKey: g.category?.key || null,
      // Present when the caller joined CompanyServiceCategory; absent means
      // "this company hasn't customised the wording, use the defaults".
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

const itemText = (item) => item.description || item.name || item.title || "";

/** Small-caps label with a brand tick. Shared by several sections. */
export function SectionLabel({ children, theme }) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}
    >
      <View
        style={{
          width: 3,
          height: 10,
          backgroundColor: theme.accent,
          marginRight: 5,
          borderRadius: 1,
        }}
      />
      <Text
        style={{
          fontSize: 7.5,
          fontFamily: "Helvetica-Bold",
          color: theme.accentText,
          letterSpacing: 1,
        }}
      >
        {String(children).toUpperCase()}
      </Text>
    </View>
  );
}

export function renderEmailHtml({ data, company = {}, language }) {
  const { money } = documentFormatters(language);
  const t = documentTheme(company);
  const groups = toGroups(data);
  if (!groups.length) return "";

  // The "what's included" lists are deliberately dropped in email. An email is
  // a nudge to open the real document, not a substitute for it, and six bullet
  // lists inline is what makes people stop reading.
  return `
    <div style="margin-top:16px;font-family:Helvetica,Arial,sans-serif;font-size:14px;">
      ${groups
        .map((g) => {
          const accent = resolveServiceContent(g.categoryKey, g.override).accent;
          return `
        <div style="border-left:3px solid ${accent};padding-left:12px;margin-bottom:16px;">
          ${
            g.label
              ? `<table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
                   <tr>
                     <td style="font-weight:700;color:${t.ink};">${escapeHtml(g.label)}</td>
                     <td style="text-align:right;font-weight:700;color:${t.ink};">${money(g.subtotal)}</td>
                   </tr>
                 </table>`
              : ""
          }
          <table style="width:100%;border-collapse:collapse;">
            ${g.items
              .map(
                (item) => `
              <tr>
                <td style="padding:3px 0;color:${t.inkMuted};font-size:13px;">
                  ${escapeHtml(itemText(item))}${
                    num(item.quantity) > 1
                      ? ` <span style="color:${t.inkFaint};">× ${item.quantity}</span>`
                      : ""
                  }
                </td>
                <td style="padding:3px 0;text-align:right;white-space:nowrap;color:${t.inkMuted};font-size:13px;">
                  ${money(item.amount)}
                </td>
              </tr>`,
              )
              .join("")}
          </table>
        </div>`;
        })
        .join("")}
    </div>
  `;
}

export function PdfSection({ data, company = {}, language }) {
  const labels = documentLabels(language);
  const { money } = documentFormatters(language);
  const theme = documentTheme(company);
  const groups = toGroups(data);
  if (!groups.length) return null;

  // One card is not a set of cards. A single-service quote gets the same
  // structure without the numbered badge — labelling one thing "01" is
  // bureaucracy.
  const multi = groups.length > 1;

  return (
    <View style={{ marginTop: 4 }}>
      <SectionLabel theme={theme}>
        {multi ? "Scope of work" : labels.description}
      </SectionLabel>

      {groups.map((g, gi) => {
        const content = resolveServiceContent(g.categoryKey, g.override);
        const accent = content.accent;

        return (
          // wrap={false} keeps a card off a page break. A scope card split
          // across two pages loses its header, and the client reads a column
          // of prices with no idea what they're for.
          <View
            key={gi}
            wrap={false}
            style={{
              marginBottom: 12,
              borderRadius: 5,
              border: `1 solid ${theme.border}`,
              borderLeftWidth: 3,
              borderLeftColor: accent,
              overflow: "hidden",
            }}
          >
            {/* Card head: what it is on the left, what it costs on the right.
                The per-group total matters more than it looks — on a
                multi-trade quote it's what lets a client say "drop the
                flooring" instead of "it's too expensive". */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                paddingVertical: 7,
                paddingHorizontal: 10,
                backgroundColor: tint(accent, 0.96, 0.1),
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", flex: 1 }}
              >
                {multi && (
                  <View
                    style={{
                      paddingVertical: 1.5,
                      paddingHorizontal: 5,
                      borderRadius: 6,
                      backgroundColor: accent,
                      marginRight: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 6,
                        fontFamily: "Helvetica-Bold",
                        color: "#ffffff",
                        letterSpacing: 0.5,
                      }}
                    >
                      {String(gi + 1).padStart(2, "0")}
                    </Text>
                  </View>
                )}
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Helvetica-Bold",
                    color: theme.ink,
                  }}
                >
                  {g.label || labels.description}
                </Text>
              </View>

              {g.subtotal > 0 && (
                <Text
                  style={{
                    fontSize: 10,
                    fontFamily: "Helvetica-Bold",
                    color: theme.ink,
                  }}
                >
                  {money(g.subtotal)}
                </Text>
              )}
            </View>

            <View style={{ paddingVertical: 8, paddingHorizontal: 10 }}>
              {g.items.map((item, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    marginBottom: 3,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 9,
                      color: theme.ink,
                      flex: 1,
                      paddingRight: 10,
                    }}
                  >
                    {itemText(item)}
                    {num(item.quantity) > 1 ? `   × ${item.quantity}` : ""}
                  </Text>
                  <Text style={{ fontSize: 9, color: theme.ink }}>
                    {money(item.amount)}
                  </Text>
                </View>
              ))}

              {content.included?.length > 0 && (
                <View
                  style={{
                    marginTop: 8,
                    paddingTop: 7,
                    borderTop: `1 solid ${theme.borderSoft}`,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 6.5,
                      fontFamily: "Helvetica-Bold",
                      color: theme.inkFaint,
                      letterSpacing: 0.7,
                      marginBottom: 3,
                    }}
                  >
                    {"WHAT'S INCLUDED"}
                  </Text>
                  {content.included.map((line, i) => (
                    <View
                      key={i}
                      style={{ flexDirection: "row", marginBottom: 1.5 }}
                    >
                      <Text style={{ fontSize: 8, color: accent, width: 8 }}>
                        •
                      </Text>
                      <Text
                        style={{
                          fontSize: 8,
                          color: theme.inkMuted,
                          flex: 1,
                          lineHeight: 1.4,
                        }}
                      >
                        {line}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
