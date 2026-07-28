// app/admin/lib/pdf/renderDocumentPdf.js
import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { getSectionModule } from "@/lib/documentSections/registry";

// `language` is the language the DOCUMENT was written in — taken from
// Quote.language / Invoice.language, which are set once at creation and never
// change. It is not a viewer preference and must not be, because the PDF a
// client signed has to keep saying what it said when they signed it.
//
// Falls back to the company default, then English, so an older record with no
// language set still renders.
export async function renderDocumentPdfBuffer({
  sections,
  data,
  company,
  language,
}) {
  const lang = language || company?.defaultLanguage || "en";

  const ordered = [...sections].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0),
  );

  const doc = (
    <Document>
      <Page size="LETTER" style={{ padding: 40, fontFamily: "Helvetica" }}>
        {ordered.map((section, i) => {
          const mod = getSectionModule(section.type);
          const PdfSection = mod.PdfSection;
          return (
            <PdfSection
              key={i}
              data={data}
              company={company}
              section={section}
              language={lang}
            />
          );
        })}
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
