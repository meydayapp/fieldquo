// lib/documentSections/ScopeGroupsSection.js
//
// The line items — the part of a quote the client actually reads.
//
// This file was a byte-for-byte copy of ClientInfoSection.js, right down to
// `meta.type = "client_info"`. The registry maps the key `scope_groups` to
// this module, so every quote PDF rendered the client's name and address a
// second time and showed no priced work whatsoever. Nothing caught it because
// the module exported the right shape — just the wrong content.

import { View, Text } from "@react-pdf/renderer";
import {
  documentLabels,
  documentFormatters,
} from "@/lib/i18n/documentLabels";

export const meta = { type: "scope_groups", label: "Line items" };

// Quotes carry scopeGroups (work grouped by service); invoices carry a flat
// lineItems array. Both render as the same thing to a client, so normalise
// here rather than making every caller pick a shape.
function toGroups(data) {
  if (Array.isArray(data.scopeGroups) && data.scopeGroups.length) {
    return data.scopeGroups.map((g) => ({
      label: g.label || g.category?.label || "",
      items: Array.isArray(g.lineItems) ? g.lineItems : [],
    }));
  }
  if (Array.isArray(data.lineItems) && data.lineItems.length) {
    return [{ label: "", items: data.lineItems }];
  }
  return [];
}

function itemText(item) {
  return item.description || item.name || "";
}

export function renderEmailHtml({ data, language }) {
  const { money } = documentFormatters(language);
  const groups = toGroups(data);
  if (groups.length === 0) return "";

  return `
    <div style="margin-top:16px;font-family:sans-serif;font-size:14px;">
      ${groups
        .map(
          (g) => `
        ${g.label ? `<div style="font-weight:700;margin:12px 0 6px;">${g.label}</div>` : ""}
        <table style="width:100%;border-collapse:collapse;">
          ${g.items
            .map(
              (item) => `
            <tr>
              <td style="padding:3px 0;color:#333;">
                ${itemText(item)}${Number(item.quantity) > 1 ? ` <span style="color:#888;">× ${item.quantity}</span>` : ""}
              </td>
              <td style="padding:3px 0;text-align:right;white-space:nowrap;">${money(item.amount)}</td>
            </tr>
          `,
            )
            .join("")}
        </table>
      `,
        )
        .join("")}
    </div>
  `;
}

export function PdfSection({ data, language }) {
  const t = documentLabels(language);
  const { money } = documentFormatters(language);
  const groups = toGroups(data);
  if (groups.length === 0) return null;

  return (
    <View style={{ marginTop: 12 }}>
      {/* Column headers once at the top, not per group — repeating them makes
          a three-service quote look like three separate documents. */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          borderBottom: "1 solid #ddd",
          paddingBottom: 3,
          marginBottom: 6,
        }}
      >
        <Text style={{ fontSize: 8, color: "#888" }}>{t.description}</Text>
        <Text style={{ fontSize: 8, color: "#888" }}>{t.amount}</Text>
      </View>

      {groups.map((g, gi) => (
        <View key={gi} style={{ marginBottom: 10 }} wrap={false}>
          {g.label && (
            <Text
              style={{
                fontSize: 10,
                fontFamily: "Helvetica-Bold",
                marginBottom: 3,
              }}
            >
              {g.label}
            </Text>
          )}

          {g.items.map((item, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 2,
              }}
            >
              <Text
                style={{ fontSize: 9, color: "#333", flex: 1, paddingRight: 8 }}
              >
                {itemText(item)}
                {Number(item.quantity) > 1 ? `  × ${item.quantity}` : ""}
              </Text>
              <Text style={{ fontSize: 9, color: "#333" }}>
                {money(item.amount)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
