// lib/documentSections/ProcessStepsSection.js
//
// "Here's what actually happens if you say yes."
//
// ── Why this earns its space on the page ────────────────────────────────────
//
// The most common reason a fairly-priced quote goes unanswered isn't the
// price. It's that the client has no idea what they're agreeing to: when
// someone turns up, how long they're in the house, whether they need to move
// out, what happens to the furniture. Silence on those points reads as risk,
// and risk loses to the competitor who spelled it out.
//
// The steps themselves are generic per trade, which is precisely the argument
// for shipping them: they're identical for every painter in the country, so
// making each new company write their own is asking them to do homework to
// reach a baseline everyone else already has.
//
// ── Why one set of steps, not one per service ───────────────────────────────
//
// A three-trade quote would otherwise carry fifteen numbered bubbles saying
// much the same thing, which reads as padding rather than thoroughness. So
// this shows the steps for the LARGEST group by value — the work the client is
// really deciding about — while each scope card keeps its own "what's
// included" inline, because that part genuinely differs.
//
// ── Nothing here states a term the company didn't agree to ──────────────────
//
// No warranty lengths, no day counts, no product brands. Those vary by company
// and by job, and a default that quietly asserts "5-year warranty" on someone's
// behalf isn't a nice touch, it's a contract term they never wrote. Specifics
// belong in Quote.processNotes, which the company fills in.

import { View, Text } from "@react-pdf/renderer";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { dominantProcessSteps } from "@/lib/documents/serviceContent";
import { processStepsHtml } from "@/lib/email/quoteSections";
import { SectionLabel } from "./ScopeGroupsSection";

export const meta = { type: "process_steps", label: "How the work runs" };

const num = (v) => Number(v ?? 0);

function stepsFor(data) {
  const groups = Array.isArray(data.scopeGroups) ? data.scopeGroups : [];
  return dominantProcessSteps(
    groups.map((g) => ({
      categoryKey: g.category?.key || null,
      override: g.companySettings || null,
      subtotal: num(g.subtotal),
    })),
  );
}

/**
 * The covering-email version.
 *
 * Delegates to lib/email/quoteSections.js so the quote email and this section
 * produce the same steps, timelines and process-notes panel from one piece of
 * markup. This file keeps the step RESOLUTION (which group dominates) because
 * that is document logic, not email logic.
 */
export function renderEmailHtml({ data = {}, company = {}, language }) {
  return processStepsHtml({ data, company, language, steps: stepsFor(data) });
}

export function PdfSection({ data = {}, company = {} }) {
  const t = documentTheme(company);
  const fill = fillPair(t);
  const steps = stepsFor(data);
  if (!steps.length) return null;

  return (
    <View style={{ marginTop: 14 }} wrap={false}>
      <SectionLabel theme={t}>How the work runs</SectionLabel>

      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <View key={i} style={{ flexDirection: "row" }}>
            {/* Number bubble plus the rule joining it to the next one. The
                connector is what turns five paragraphs into a sequence — the
                eye reads it as a timeline rather than a list of tips. */}
            <View style={{ width: 22, alignItems: "center" }}>
              <View
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: fill.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontSize: 7.5,
                    fontFamily: "Helvetica-Bold",
                    color: fill.fg,
                  }}
                >
                  {s.num}
                </Text>
              </View>
              {!last && (
                <View
                  style={{
                    width: 1,
                    flexGrow: 1,
                    minHeight: 14,
                    backgroundColor: t.accentRule,
                    marginTop: 2,
                  }}
                />
              )}
            </View>

            <View
              style={{
                flex: 1,
                paddingLeft: 6,
                paddingBottom: last ? 0 : 9,
              }}
            >
              {/* Title and duration on one line. The duration is what a
                  client actually scans a process for — "when do I get my
                  kitchen back" — so it sits beside the step rather than buried
                  in the sentence, and it is simply absent for a trade whose
                  content does not state one. */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  marginBottom: 1.5,
                }}
              >
                <Text
                  style={{
                    fontSize: 9,
                    fontFamily: "Helvetica-Bold",
                    color: t.ink,
                  }}
                >
                  {s.title}
                </Text>
                {s.timeline ? (
                  <Text style={{ fontSize: 7.5, color: t.inkFaint, marginLeft: 5 }}>
                    {s.timeline}
                  </Text>
                ) : null}
              </View>
              <Text
                style={{ fontSize: 8, color: t.inkMuted, lineHeight: 1.45 }}
              >
                {s.body}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Whatever the company wrote for THIS job — real dates, access
          arrangements, who to call. Placed after the generic steps so it reads
          as the specific case rather than contradicting them. */}
      {data.processNotes ? (
        <View
          style={{
            marginTop: 10,
            padding: 9,
            backgroundColor: t.accentWash,
            borderLeft: `3 solid ${t.accentFill}`,
            borderRadius: 3,
          }}
        >
          <Text style={{ fontSize: 8, color: t.ink, lineHeight: 1.5 }}>
            {data.processNotes}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
