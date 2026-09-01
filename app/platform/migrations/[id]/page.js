// app/platform/migrations/[id]/page.js
//
// Server shell — resolves the route param and hands it to the client
// component, which does the fetching and the actions. Same split as
// app/platform/companies/[id]/page.js.

import MigrationDetail from "./MigrationDetail";

export default async function PlatformMigrationDetailPage({ params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  return <MigrationDetail migrationId={id} />;
}
