// app/portal/[token]/invoices/[id]/page.js
//
// One invoice, in full, for the client. The portal index lists them; this is
// where someone goes to see what the $4,250 was actually for before paying.

export const dynamic = "force-dynamic";

import PortalInvoice from "./PortalInvoice";
import { documentLabels } from "@/lib/i18n/documentLabels";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { clientPageMetadata, documentTitle, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import { portalInvoiceMeta } from "@/lib/whiteLabel/metadataLoaders";

const ROBOTS = { index: false, follow: false };

// "Invoice INV-0042 · Northline Painting" in the tab, the company's logo as
// the icon. The label is in the invoice's own language; the number only for
// an issued invoice of this client (see portalInvoiceMeta), and never in the
// share title a forwarded link's preview shows.
export async function generateMetadata({ params }) {
  const { token, id } = await params;
  const found = await portalInvoiceMeta(token, id);
  if (!found) return neutralClientMetadata({ title: "Your invoice", robots: ROBOTS });
  const { company, client, invoice } = found;
  const label = documentLabels(resolveClientLanguage({ document: invoice, client, company })).invoice;
  return clientPageMetadata(company, {
    title: documentTitle(label, invoice?.invoiceNumber, company.name),
    shareTitle: documentTitle(label, null, company.name),
    robots: ROBOTS,
  });
}

export default async function PortalInvoicePage({ params, searchParams }) {
  const { token, id } = await params;
  // Next 16: searchParams is a Promise too. `?stage=<id>` arrives on a
  // payment-schedule stage's own email link (lib/paymentSchedule/run.js) so
  // this page can ask for that stage's amount instead of the invoice's full
  // remaining balance — see PortalInvoice.js.
  const { stage } = (await searchParams) || {};
  return <PortalInvoice token={token} invoiceId={id} stageId={stage || null} />;
}
