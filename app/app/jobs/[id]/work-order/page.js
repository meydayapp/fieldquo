// app/app/jobs/[id]/work-order/page.js
//
// Server shell. Resolves the route param and hands it to the client component
// — the work order is ticked and photographed on a phone, so the body has to
// be a client component. Inside the app shell on purpose: see
// lib/workOrder/url.js for why there is no anonymous crew link.

import WorkOrderView from "./WorkOrderView";

export default async function WorkOrderPage({ params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  return <WorkOrderView jobId={id} />;
}
