// app/platform/companies/[id]/page.js
//
// Server shell — resolves the route param and hands it to the client
// component, which does the fetching and the actions.

import CompanyDetail from "./CompanyDetail";

export default async function PlatformCompanyDetailPage({ params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  return <CompanyDetail companyId={id} />;
}
