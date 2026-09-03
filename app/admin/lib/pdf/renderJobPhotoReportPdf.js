// app/admin/lib/pdf/renderJobPhotoReportPdf.js
//
// The job photo report PDF: dated, stage-grouped evidence of one job's work,
// built on the SAME @react-pdf pipeline as renderDocumentPdf.js rather than a
// second one. FieldQuo already has one PDF pipeline, one brand-theme module
// and one Cloudinary-archive pattern for quotes and invoices; this reuses all
// three instead of inventing a fourth renderer for a fourth document type.
//
// ── What this deliberately does NOT reuse ───────────────────────────────
//
// lib/documentSections/registry.js is for QUOTE and INVOICE documents, whose
// sections a company can reorder in the template editor at Settings →
// Templates. A photo report is not one of those documents — there is no
// "photo_report_pdf" template type, and registering one would put
// report-only sections into the picker for every quote and invoice, which is
// the wrong shape of change for what this is. So the masthead and body are
// composed directly, still through the same `documentTheme` (so the report
// carries the company's own brand, like every client-facing document) and the
// same `FooterSection` (so the contact-details footer is the identical
// component everywhere it appears, not a hand-copied twin that drifts).
//
// ── Data assembly lives elsewhere on purpose ────────────────────────────
//
// lib/jobs/photoReport.js does the grouping, dating and resizing with zero
// JSX in it, so that logic can be unit tested with plain node the way
// KitchenPlanSection.js splits `designFrom`/`wallsWithContent` out from its
// own rendering. This file is the thin, JSX-only remainder.
import { Document, Page, View, Text, Image, renderToBuffer } from "@react-pdf/renderer";
import { documentTheme, ruleColor } from "@/lib/documents/theme";
import { documentLabels, documentFormatters } from "@/lib/i18n/documentLabels";
import { PdfSection as FooterPdfSection } from "@/lib/documentSections/FooterSection";
import { buildPhotoReportData } from "@/lib/jobs/photoReport";
import { registerPdfFonts, PDF_FONT, PDF_FONT_BOLD } from "@/lib/documents/pdfFont";

/**
 * @param job      { title }
 * @param client   { name, address, city, province } or null/undefined
 * @param company  branding + contact fields, same shape every document uses
 * @param photos   this job's OWN JobPhoto rows, unfiltered (see
 *                 buildPhotoReportData for why this must not be pre-filtered
 *                 the way the public gallery is)
 * @param language resolved language for the fixed document labels — see
 *                 lib/i18n/resolveLanguage.js#resolveClientLanguage. There is
 *                 no persisted `language` on the report itself: unlike a
 *                 signed quote, nothing here is frozen at a moment in time —
 *                 it's regenerated fresh from the client's current language
 *                 preference every time it's downloaded.
 */
export async function renderJobPhotoReportPdfBuffer({
  job,
  client,
  company = {},
  photos,
  language,
}) {
  registerPdfFonts();

  const data = buildPhotoReportData({ job, client, photos });
  const t = documentTheme(company);
  const labels = documentLabels(language);
  const { date } = documentFormatters(language);

  const doc = (
    <Document>
      <Page size="LETTER" style={{ padding: 40, fontFamily: PDF_FONT }} wrap>
        {/* The brand rule, same two-weight treatment HeaderSection uses, so a
            photo report and a quote from the same company read as one family
            of documents rather than two different products. */}
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
                  alignSelf: "flex-start",
                }}
              />
            ) : (
              <Text
                style={{
                  fontSize: 15,
                  fontFamily: PDF_FONT_BOLD,
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
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={{
                fontSize: 18,
                fontFamily: PDF_FONT_BOLD,
                letterSpacing: 2,
                color: t.accentText,
              }}
            >
              {labels.photoReport.toUpperCase()}
            </Text>
            <Text
              style={{
                fontSize: 11,
                fontFamily: PDF_FONT_BOLD,
                color: t.ink,
                marginBottom: 3,
              }}
            >
              {data.jobTitle}
            </Text>
            <Text style={{ fontSize: 8, color: t.inkMuted }}>
              {date(data.generatedAt)}
            </Text>
          </View>
        </View>

        {(data.clientName || data.address) && (
          <View
            style={{
              backgroundColor: t.accentWash,
              borderRadius: 4,
              paddingVertical: 8,
              paddingHorizontal: 10,
              marginBottom: 16,
            }}
          >
            {data.clientName && (
              <Text
                style={{ fontSize: 10, fontFamily: PDF_FONT_BOLD, color: t.ink }}
              >
                {data.clientName}
              </Text>
            )}
            {data.address && (
              <Text style={{ fontSize: 8, color: t.inkMuted, marginTop: 2 }}>
                {data.address}
              </Text>
            )}
          </View>
        )}

        {/* A job with nothing filed yet must produce a document that SAYS so,
            not one that throws or renders a blank page. A photo report
            somebody downloaded and got nothing back from reads as the feature
            being broken, not as "no photos yet". */}
        {!data.hasPhotos ? (
          <Text style={{ fontSize: 9, color: t.inkMuted }}>
            {labels.noPhotosNote}
          </Text>
        ) : (
          data.groups.map((g) => (
            <View key={g.stage} style={{ marginBottom: 16 }}>
              <Text
                style={{
                  fontSize: 9,
                  fontFamily: PDF_FONT_BOLD,
                  color: t.ink,
                  marginBottom: 6,
                  letterSpacing: 0.6,
                }}
              >
                {g.label.toUpperCase()} ({g.photos.length})
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {g.photos.map((p, i) => (
                  // wrap={false} keeps one photo's image and its caption
                  // together across a page break — a date split from its
                  // photo is useless as a record.
                  <View key={i} style={{ width: 148 }} wrap={false}>
                    <Image
                      src={p.url}
                      style={{
                        width: 148,
                        height: 148,
                        objectFit: "cover",
                        borderRadius: 3,
                      }}
                    />
                    <Text style={{ fontSize: 7, color: t.inkMuted, marginTop: 2 }}>
                      {date(p.date)}
                    </Text>
                    {p.caption && (
                      <Text style={{ fontSize: 7, color: t.ink }}>{p.caption}</Text>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))
        )}

        <FooterPdfSection company={company} />
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
