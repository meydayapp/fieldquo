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

export default async function PortalInvoicePage({ params, searchParams }) {
  const { token, id } = await params;
  // Next 16: searchParams is a Promise too. `?stage=<id>` arrives on a
  // payment-schedule stage's own email link (lib/paymentSchedule/run.js) so
  // this page can ask for that stage's amount instead of the invoice's full
  // remaining balance — see PortalInvoice.js.
  const { stage } = (await searchParams) || {};
  return <PortalInvoice token={token} invoiceId={id} stageId={stage || null} />;
}
