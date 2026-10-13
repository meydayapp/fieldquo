// scripts/fixtures/clientBlockRender.mjs
//
// Renders the CLIENT BLOCK of a quote and an invoice on every surface that
// draws one, for a fixed set of clients — used by scripts/check-client-unit.mjs
// (bundled with esbuild: the surfaces are JSX).
//
// Only imports that existed BEFORE the department line was added
// (DocumentParties, ClientInfoSection, preparedForBlock via renderEmailHtml,
// quotePageClientFacts), so the same file bundled against the old tree
// produced scripts/fixtures/clientBlockBaseline.json — the md5s an
// individual's and a unit-less company's blocks must still match.
//
// Surfaces:
//   parties      DocumentParties — the staff quote page and both builders
//                (the invoice builder included)
//   pdfQuote     ClientInfoSection.PdfSection with a quote number
//   pdfInvoice   ClientInfoSection.PdfSection with an invoice number
//   email        ClientInfoSection.renderEmailHtml → preparedForBlock
//   facts        quotePageClientFacts — the object the /q page draws from
import { renderToStaticMarkup } from "react-dom/server";
import { DocumentParties } from "@/app/components/document/QuoteDocument";
import * as Info from "@/lib/documentSections/ClientInfoSection";
import { quotePageClientFacts } from "@/lib/quotes/gcSignup";

export const LONG_UNIT =
  "Science and Parliamentary Infrastructure Branch — Real Property Services, Parliamentary Precinct Branch, Long Term Vision and Plan Programme Delivery Directorate";

export const CLIENT_FIXTURES = {
  individual: { id: "c1", type: "individual", name: "Marie Tremblay", contactName: null, email: "marie@example.com", phone: "819-555-0101", address: "12 Rue Laval, Gatineau QC" },
  // A homeowner who was once saved as a company: the column survives the
  // switch (prisma/schema.prisma) and must never print.
  individualStaleUnit: { id: "c1b", type: "individual", name: "Marie Tremblay", contactName: null, email: "marie@example.com", phone: "819-555-0101", address: "12 Rue Laval, Gatineau QC", organizationUnit: "Old branch from when she was a company" },
  individualNoType: { id: "c1c", name: "Marie Tremblay", email: "marie@example.com", phone: "819-555-0101", address: "12 Rue Laval, Gatineau QC", organizationUnit: "No type at all" },
  companyNoUnit: { id: "c2", type: "company", name: "Northline Property Management", contactName: "Dana Ruiz", email: "ap@northline.example", phone: "613-555-0199", address: "200 Bank St, Ottawa ON" },
  companyBlankUnit: { id: "c2b", type: "company", name: "Northline Property Management", contactName: "Dana Ruiz", email: "ap@northline.example", phone: "613-555-0199", address: "200 Bank St, Ottawa ON", organizationUnit: "   \n  " },
  companyUnit: { id: "c3", type: "company", name: "Public Services and Procurement Canada", contactName: "Lisa Hampel", email: "lisa.hampel@pspc.example", phone: "819-555-0100", address: "11 Laurier St, Gatineau QC", organizationUnit: "Science and Parliamentary Infrastructure Branch" },
  companyLongUnit: { id: "c4", type: "company", name: "Public Services and Procurement Canada", contactName: "Lisa Hampel", email: "lisa.hampel@pspc.example", phone: "819-555-0100", address: "11 Laurier St, Gatineau QC", organizationUnit: LONG_UNIT },
  companyHostileUnit: { id: "c5", type: "company", name: "Acme", email: "a@acme.example", organizationUnit: `<img src=x onerror="alert(1)"> & "Branch"` },
};

// Hostile brand colours: contractors pick yellow, white, black and mid-grey.
export const BRANDS = ["#ffff00", "#ffffff", "#000000", "#808080", "#7f7f7f", "#00ff00", "#ff00ff", "#1e40af", "#f59e0b", "#e11d48"];

const strip = (el) => JSON.stringify(el, (k, v) => (k === "_owner" || k === "_store" ? undefined : v));

export function renderClientBlocks({ languages = ["en", "fr"], brand = "#1e40af" } = {}) {
  const out = {};
  for (const [name, client] of Object.entries(CLIENT_FIXTURES)) {
    out[name] = {};
    for (const language of languages) {
      const company = { name: "Acme Painting", brandColor: brand };
      const quoteData = { quoteNumber: "Q-2026-0042", client, createdAt: "2026-10-01T12:00:00Z", siteAddress: null };
      const invoiceData = { invoiceNumber: "INV-2026-0042", client, createdAt: "2026-10-01T12:00:00Z", dueDate: "2026-10-31T12:00:00Z" };
      out[name][language] = {
        parties: renderToStaticMarkup(
          <DocumentParties label={language === "fr" ? "PRÉPARÉ POUR" : "PREPARED FOR"} client={client} clientAddress={client.address || ""} facts={[]} />,
        ),
        pdfQuote: strip(Info.PdfSection({ data: quoteData, company, language })),
        pdfInvoice: strip(Info.PdfSection({ data: invoiceData, company, language })),
        email: Info.renderEmailHtml({ data: quoteData, company, language }),
        facts: JSON.stringify(quotePageClientFacts(client)),
      };
    }
  }
  return out;
}
