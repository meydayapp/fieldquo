// app/app/subcontractors/[id]/page.js
//
// Server shell. Resolves the route param and hands it to the client component
// that does the fetching — same split as app/app/jobs/[id]/page.js.

import SubcontractorDetail from "./SubcontractorDetail";

export default async function SubcontractorPage({ params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  return <SubcontractorDetail id={id} />;
}
