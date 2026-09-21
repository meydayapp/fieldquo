// app/app/jobs/import/page.js
//
// The screen lives in ./PastJobsEntry.js, because the home page's set-up
// dialog renders the same one. This page is the frame.
"use client";

import PastJobsEntry from "./PastJobsEntry";

export default function PastJobsPage() {
  return <PastJobsEntry />;
}
