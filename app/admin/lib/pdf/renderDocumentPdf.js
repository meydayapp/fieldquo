// app/admin/lib/pdf/renderDocumentPdf.js
import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { getSectionModule } from "@/lib/documentSections/registry";

export async function renderDocumentPdfBuffer({ sections, data, company }) {
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
            />
          );
        })}
      </Page>
    </Document>
  );

  return renderToBuffer(doc);
}
