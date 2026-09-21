// app/app/settings/email-templates/page.js
//
// The manager lives in ./EmailTemplatesManager.js, because the home page's
// set-up dialog renders the same one. This page is the frame.
"use client";

import EmailTemplatesManager from "./EmailTemplatesManager";

export default function EmailTemplatesPage() {
  return <EmailTemplatesManager />;
}
