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
import { documentTheme, washPair } from "@/lib/documents/theme";
import {
  resolveServiceContent,
  dominantGlossary,
} from "@/lib/documents/serviceContent";
import { tint, accessiblePair } from "@/lib/brand/colour";
// The HTML half of this section lives in a file with no @react-pdf import, so
// an email can build a scope table without dragging a PDF engine in behind it.
// Same move preparedForBlock made out of ClientInfoSection.
import { scopeBreakdownHtml, toGroups } from "@/lib/email/quoteSections";

export const meta = { type: "scope_groups", label: "Line items" };

const num = (v) => Number(v ?? 0);

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

/**
 * The covering-email version of this section.
 *
 * `detail: false` — prices only, no "what's included". An INVOICE email is a
 * covering note for work already agreed; re-arguing the sale in it is noise.
 * The quote email wants the bullets and calls scopeBreakdownHtml directly with
 * the default, which is why the option lives on the shared builder rather than
 * here.
 */
export function renderEmailHtml({ data, company = {}, language }) {
  return scopeBreakdownHtml({ data, company, language, detail: false });
}

export function PdfSection({ data, company = {}, language }) {
  const labels = documentLabels(language);
  const { money } = documentFormatters(language, company?.currency);
  const theme = documentTheme(company);
  const groups = toGroups(data);
  if (!groups.length) return null;

  const glossary = dominantGlossary(groups);
  // Measured, not picked. The glossary sits on a washed panel, and ink chosen
  // for paper is not ink that survives a wash of a hostile brand colour —
  // washPair computes the pair, which is the whole point of theme.js.
  const wash = washPair(theme);

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
        // The takeoff decides WHICH scope paragraph — a refacing quote in
        // thermofoil describes a different job from one in painted MDF. It is
        // read here and nowhere else; nothing derived from it leaves this
        // component, which matters because a countertop takeoff carries
        // supplier cost and markup.
        const content = resolveServiceContent(
          g.categoryKey,
          g.override,
          g.takeoff,
        );
        const accent = content.accent;
        // The numbered badge is the one place this accent is a FILL under text.
        // These colours are chosen desaturated and mid-lightness so they sit
        // beside any brand, and mid-tones are precisely where no foreground
        // clears 4.5:1 — hardcoded white put the clay badge at 4.36. The fill
        // shifts, the card's border and wash keep the true colour, and
        // QuoteApproval.js computes the identical pair so the page and the
        // attachment stay the same document.
        const badge = accessiblePair(accent);

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
                      backgroundColor: badge.bg,
                      marginRight: 6,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 6,
                        fontFamily: "Helvetica-Bold",
                        color: badge.fg,
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
              {/* The scope paragraph, ABOVE the prices.
                  "Cabinet Refinishing" over a column of amounts is the line the
                  AI reviewer flags as one the client won't understand, and it
                  is right — a homeowner does not know whether that replaces the
                  doors. What's included answers a different question and answers
                  it after the numbers; this answers "what IS this" before them.
                  On paper, in theme.inkMuted, which theme.js already holds at
                  4.5:1 — no new colour pairing is introduced here. */}
              {content.description ? (
                <Text
                  style={{
                    fontSize: 8.5,
                    color: theme.inkMuted,
                    lineHeight: 1.45,
                    marginBottom: 7,
                    paddingBottom: 6,
                    borderBottom: `1 solid ${theme.borderSoft}`,
                  }}
                >
                  {content.description}
                </Text>
              ) : null}

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

              {/* What could change this price. Printed under what's included,
                  in the same card, because it is the same sentence continued:
                  here is what you are buying, and here is the part nobody can
                  see through a roof until it is open. */}
              {content.mayChange?.length > 0 && (
                <View
                  style={{
                    marginTop: 7,
                    paddingTop: 6,
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
                    {"WHAT COULD CHANGE THIS PRICE"}
                  </Text>
                  {content.mayChange.map((entry, i) => (
                    <View key={i} style={{ marginBottom: 2.5 }}>
                      <Text
                        style={{
                          fontSize: 8,
                          fontFamily: "Helvetica-Bold",
                          color: theme.ink,
                        }}
                      >
                        {entry.title}
                      </Text>
                      <Text
                        style={{
                          fontSize: 8,
                          color: theme.inkMuted,
                          lineHeight: 1.4,
                        }}
                      >
                        {entry.body}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        );
      })}

      {/* The vocabulary the quote above is written in, once, for the trade the
          client is actually deciding about. See dominantGlossary. */}
      {glossary.length > 0 && (
        <View
          style={{
            marginTop: 12,
            padding: 8,
            backgroundColor: wash.bg,
            borderRadius: 3,
          }}
          wrap={false}
        >
          <Text
            style={{
              fontSize: 6.5,
              fontFamily: "Helvetica-Bold",
              color: theme.inkFaint,
              letterSpacing: 0.7,
              marginBottom: 4,
            }}
          >
            {"THE TERMS ON THIS QUOTE, EXPLAINED"}
          </Text>
          {glossary.map((entry, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text
                style={{
                  fontSize: 8,
                  fontFamily: "Helvetica-Bold",
                  color: wash.ink,
                  width: 92,
                }}
              >
                {entry.term}
              </Text>
              <Text
                style={{
                  fontSize: 8,
                  color: wash.muted,
                  flex: 1,
                  lineHeight: 1.4,
                }}
              >
                {entry.body}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
