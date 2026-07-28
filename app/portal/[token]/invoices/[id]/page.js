// app/portal/[token]/invoices/[id]/page.js
//
// One invoice, in full, for the client. The portal index lists them; this is
// where someone goes to see what the $4,250 was actually for before paying.

export const dynamic = "force-dynamic";

import PortalInvoice from "./PortalInvoice";

export const metadata = {
  title: "Your invoice",
  robots: { index: false, follow: false },
};

export default async function PortalInvoicePage({ params }) {
  const { token, id } = await params;
  return <PortalInvoice token={token} invoiceId={id} />;
}
