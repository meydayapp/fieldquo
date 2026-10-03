// app/portal/[token]/demo-pay/page.js
//
// Where a DEMO company's Pay button lands instead of Stripe Checkout. Only the
// portal pay route links here, and only for a company whose row says isDemo
// (app/api/portal/[token]/pay). See DemoPay.js for what it shows and why.

export const dynamic = "force-dynamic";

import DemoPay from "./DemoPay";

export const metadata = {
  title: "Your payment",
  robots: { index: false, follow: false },
};

export default async function DemoPayPage({ params, searchParams }) {
  const { token } = await params;
  // Next 16: both are Promises. `invoice` and `stage` name the record only —
  // the figure is re-derived by the pay route, never read from here.
  const { invoice, stage } = (await searchParams) || {};
  return <DemoPay token={token} invoiceId={invoice || null} stageId={stage || null} />;
}
