// app/app/settings/availability/page.js
//
// The editor lives in ./AvailabilityEditor.js, because the home page's
// set-up dialog renders the same one. This page is the frame.
"use client";

import AvailabilityEditor from "./AvailabilityEditor";

export default function AvailabilityPage() {
  return <AvailabilityEditor />;
}
