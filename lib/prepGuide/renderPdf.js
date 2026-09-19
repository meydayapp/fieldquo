// lib/prepGuide/renderPdf.js
//
// The preparation guide as a PDF: the company's letterhead, the checklist
// with tick boxes, the one warning that matters, what happens on the day,
// the process steps the quote already promised, after-care, the company's
// own note, and the technical documents as links.
//
// Built from the same primitives as the quote and invoice PDFs — the brand
// rule across the top from HeaderSection, SectionLabel from
// ScopeGroupsSection, the theme from lib/documents/theme.js — so a homeowner
// holding the quote and the guide sees one piece of stationery. Every colour
// pairing is one theme.js has measured: ink on paper, fill.fg on fill.bg for
// the step bubbles, inkOnWash on accentWash for the warning box.
//
// ── The warning box is the brand wash, not amber ────────────────────────────
//
// TrueFinish's original uses a fixed amber (#fffbeb / #92400e). Here the
// company's brand colour is the only colour on the page, so the box is the
// brand wash with the ink theme.js measured against it, and the word
// "Important:" in bold does the work the colour did. A fixed amber next to a
// red or a green brand reads as somebody else's stationery.

import { Document, Page, Text, View, Image, Link, renderToBuffer } from "@react-pdf/renderer";
import { documentTheme, fillPair, ruleColor, washPair } from "@/lib/documents/theme";
import { registerPdfFonts, PDF_FONT, PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { SectionLabel } from "@/lib/documentSections/ScopeGroupsSection";
import { taxIdLine } from "@/lib/documents/taxId";
import { formatBytes } from "@/lib/jobs/documents";

const BODY = 9.5;
const LINE = 1.45;

function Paragraph({ children, theme, muted, style }) {
  return (
    <Text
      style={{
        fontSize: BODY,
        lineHeight: LINE,
        color: muted ? theme.inkMuted : theme.ink,
        marginBottom: 6,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** "Heading — detail" prints the heading bold, the way TrueFinish's does. */
function ChecklistItem({ text, theme }) {
  const [head, ...rest] = String(text).split(" — ");
  const detail = rest.join(" — ");
  return (
    <View style={{ flexDirection: "row", marginBottom: 5 }} wrap={false}>
      <View
        style={{
          width: 9,
          height: 9,
          borderWidth: 0.8,
          borderColor: ruleColor(theme),
          borderRadius: 1.5,
          marginTop: 2,
          marginRight: 7,
        }}
      />
      <Text style={{ flex: 1, fontSize: BODY, lineHeight: LINE, color: theme.ink }}>
        {detail ? (
          <>
            <Text style={{ fontFamily: PDF_FONT_BOLD }}>{head}</Text>
            {" — "}
            {detail}
          </>
        ) : (
          head
        )}
      </Text>
    </View>
  );
}

function Steps({ steps, theme }) {
  const fill = fillPair(theme);
  return (
    <View>
      {steps.map((s, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 5 }} wrap={false}>
          <View style={{ width: 22, alignItems: "center" }}>
            <View
              style={{
                width: 15,
                height: 15,
                borderRadius: 7.5,
                backgroundColor: fill.bg,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 7, fontFamily: PDF_FONT_BOLD, color: fill.fg }}>{s.num}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: BODY, fontFamily: PDF_FONT_BOLD, color: theme.ink }}>
              {s.title}
              {s.timeline ? <Text style={{ fontFamily: PDF_FONT, color: theme.inkMuted }}>{`  ·  ${s.timeline}`}</Text> : null}
            </Text>
            {s.body ? (
              <Text style={{ fontSize: BODY - 0.5, lineHeight: LINE, color: theme.inkMuted }}>{s.body}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function Section({ section, data, theme, showLabel }) {
  const { copy, company } = data;
  const g = section.guide;
  const wash = washPair(theme);
  return (
    <View style={{ marginTop: 14 }}>
      {showLabel && section.label ? (
        <Text
          style={{
            fontSize: 12,
            fontFamily: PDF_FONT_BOLD,
            color: theme.ink,
            marginBottom: 8,
            paddingBottom: 4,
            borderBottom: `1 solid ${theme.accentRule}`,
          }}
        >
          {section.label}
        </Text>
      ) : null}

      <SectionLabel theme={theme}>{copy.checklistHeading}</SectionLabel>
      <Paragraph theme={theme} muted>
        {copy.checklistLead(data.startDateText)}
      </Paragraph>
      {g.checklist.map((item, i) => (
        <ChecklistItem key={i} text={item} theme={theme} />
      ))}

      {g.warning ? (
        <View
          style={{
            backgroundColor: wash.bg,
            borderLeft: `3 solid ${ruleColor(theme)}`,
            padding: 8,
            marginTop: 6,
            marginBottom: 8,
            borderRadius: 2,
          }}
          wrap={false}
        >
          <Text style={{ fontSize: BODY, lineHeight: LINE, color: wash.ink }}>
            <Text style={{ fontFamily: PDF_FONT_BOLD }}>{copy.importantLabel} </Text>
            {g.warning}
          </Text>
        </View>
      ) : null}

      {g.dayOf.length ? (
        <View style={{ marginTop: 4 }}>
          <SectionLabel theme={theme}>{copy.dayOfHeading}</SectionLabel>
          {g.dayOf.map((p, i) => (
            <Paragraph key={i} theme={theme}>
              {p}
            </Paragraph>
          ))}
        </View>
      ) : null}

      {section.steps?.length ? (
        <View style={{ marginTop: 4 }}>
          <SectionLabel theme={theme}>{copy.processHeading}</SectionLabel>
          <Steps steps={section.steps} theme={theme} />
        </View>
      ) : null}

      {g.notes ? (
        <View style={{ marginTop: 4 }}>
          <SectionLabel theme={theme}>{copy.notesHeading(company.name || "")}</SectionLabel>
          <Paragraph theme={theme}>{g.notes}</Paragraph>
        </View>
      ) : null}

      {g.afterCare ? (
        <View style={{ marginTop: 4 }}>
          <SectionLabel theme={theme}>{copy.afterHeading}</SectionLabel>
          <Paragraph theme={theme}>{g.afterCare}</Paragraph>
        </View>
      ) : null}
    </View>
  );
}

export function PrepGuideDocument({ data }) {
  const t = documentTheme(data.company);
  const { company, copy } = data;
  const footer = [company.name, company.email, company.phone, company.website, taxIdLine(company)]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Document title={`${copy.title} — ${data.job.title}`} author={company.name || ""}>
      <Page size="LETTER" style={{ padding: 40, paddingBottom: 56, fontFamily: PDF_FONT }}>
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
            marginBottom: 14,
          }}
        >
          <View style={{ flex: 1, paddingRight: 16 }}>
            {company.logoUrl ? (
              <Image
                src={company.logoUrl}
                style={{ height: 34, maxWidth: 170, objectFit: "contain", marginBottom: 6, alignSelf: "flex-start" }}
              />
            ) : (
              <Text style={{ fontSize: 16, fontFamily: PDF_FONT_BOLD, color: t.accentText, marginBottom: 4 }}>
                {company.name || ""}
              </Text>
            )}
            {company.logoUrl && company.name ? (
              <Text style={{ fontSize: 9, color: t.ink, marginBottom: 2 }}>{company.name}</Text>
            ) : null}
            {company.email ? <Text style={{ fontSize: 8, color: t.inkMuted }}>{company.email}</Text> : null}
            {company.phone ? <Text style={{ fontSize: 8, color: t.inkMuted }}>{company.phone}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end", maxWidth: 240 }}>
            <Text style={{ fontSize: 14, fontFamily: PDF_FONT_BOLD, color: t.accentText, textAlign: "right" }}>
              {copy.title}
            </Text>
            <Text style={{ fontSize: 9, color: t.inkMuted, textAlign: "right", marginTop: 2 }}>{copy.subtitle}</Text>
            <Text style={{ fontSize: 9, fontFamily: PDF_FONT_BOLD, color: t.ink, textAlign: "right", marginTop: 6 }}>
              {data.job.title}
            </Text>
          </View>
        </View>

        <Text style={{ fontSize: 11, fontFamily: PDF_FONT_BOLD, color: t.ink, marginBottom: 3 }}>
          {copy.thankYou(data.client?.name || data.clientFirstName || "", company.name || "")}
        </Text>
        {data.startDateText ? (
          <Text style={{ fontSize: 10.5, color: t.accentText, fontFamily: PDF_FONT_BOLD, marginBottom: 8 }}>
            {copy.scheduled(data.startDateText)}
          </Text>
        ) : null}
        <Paragraph theme={t} muted>
          {copy.intro}
        </Paragraph>

        {data.sections.map((s, i) => (
          <Section key={i} section={s} data={data} theme={t} showLabel={data.sections.length > 1 || Boolean(s.label)} />
        ))}

        {data.documents.length ? (
          <View style={{ marginTop: 14 }}>
            <SectionLabel theme={t}>{copy.documentsHeading}</SectionLabel>
            <Paragraph theme={t} muted>
              {copy.documentsLead}
            </Paragraph>
            {data.documents.map((d) => (
              <View key={d.id} style={{ flexDirection: "row", marginBottom: 3 }} wrap={false}>
                <Text style={{ fontSize: BODY, color: t.inkMuted, marginRight: 6 }}>•</Text>
                <Link src={d.url} style={{ fontSize: BODY, color: t.accentText, textDecoration: "underline" }}>
                  {d.title}
                </Link>
                {formatBytes(d.sizeBytes) ? (
                  <Text style={{ fontSize: BODY - 1, color: t.inkMuted, marginLeft: 6 }}>{formatBytes(d.sizeBytes)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: 16, padding: 10, backgroundColor: washPair(t).bg, borderRadius: 3 }} wrap={false}>
          <Text style={{ fontSize: BODY, lineHeight: LINE, color: washPair(t).ink, textAlign: "center" }}>
            {copy.closing}
          </Text>
        </View>

        <View
          fixed
          style={{
            position: "absolute",
            left: 40,
            right: 40,
            bottom: 24,
            borderTop: `1 solid ${t.border}`,
            paddingTop: 6,
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 7.5, color: t.inkMuted }}>{footer}</Text>
        </View>
      </Page>
    </Document>
  );
}

/** The PDF bytes. `data` is buildPrepGuide()'s result. */
export async function renderPrepGuidePdf(data) {
  registerPdfFonts();
  return renderToBuffer(<PrepGuideDocument data={data} />);
}
