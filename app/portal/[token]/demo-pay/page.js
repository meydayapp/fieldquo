// app/portal/[token]/demo-pay/page.js
//
// Where a DEMO company's Pay button lands instead of Stripe Checkout. Only the
// portal pay route links here, and only for a company whose row says isDemo
// (app/api/portal/[token]/pay). See DemoPay.js for what it shows and why.

export const dynamic = "force-dynamic";

import DemoPay from "./DemoPay";
import { clientPageMetadata, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import { portalCompany } from "@/lib/whiteLabel/metadataLoaders";

const ROBOTS = { index: false, follow: false };

// The demo company's name and icon, exactly as a real company's portal —
// this screen exists to show a prospect what THEIR clients would see.
export async function generateMetadata({ params }) {
  const { token } = await params;
  const found = await portalCompany(token);
  return found
    ? clientPageMetadata(found.company, { robots: ROBOTS })
    : neutralClientMetadata({ title: "Your payment", robots: ROBOTS });
}

export default async function DemoPayPage({ params, searchParams }) {
  const { token } = await params;
  // Next 16: both are Promises. `invoice` and `stage` name the record only —
  // the figure is re-derived by the pay route, never read from here.
  // `request` likewise names the office's "different amount" request.
  const { invoice, stage, request } = (await searchParams) || {};
  return (
    <DemoPay
      token={token}
      invoiceId={invoice || null}
      stageId={stage || null}
      requestId={typeof request === "string" ? request : null}
    />
  );
}
