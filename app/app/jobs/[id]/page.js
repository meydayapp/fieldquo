// app/app/jobs/[id]/page.js
//
// Server shell. Resolves the route param and hands it to the client component
// that does the fetching — the page needs interactivity (status changes,
// checklist state) so the body has to be a client component.

import JobDetail from "./JobDetail";

export default async function JobPage({ params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  return <JobDetail jobId={id} />;
}
