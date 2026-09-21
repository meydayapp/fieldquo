// app/app/settings/services/page.js
//
// The editor itself lives in ./ServicesEditor.js, because the home page's
// set-up dialogs render the same one. This page is the frame.
"use client";

import ServicesEditor from "./ServicesEditor";

export default function ServiceSettingsPage() {
  return <ServicesEditor />;
}
