// app/app/tenders/[id]/page.js
//
// Server shell. Resolves the route param and hands it to the client
// component that does the fetching — the split app/app/subcontractors/[id]
// uses. The `tenders` feature gate is the layout one level up.

import TenderDetail from "./TenderDetail";

export default async function TenderPage({ params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  return <TenderDetail id={id} />;
}
