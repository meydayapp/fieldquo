// app/app/settings/services/confirm/page.js
//
// "Confirm what you quote" (lib/setupSteps.js). The screen lives in
// ../ConfirmServices.js, because the home page's set-up dialog renders the
// same one. This page is the frame.
"use client";

import ConfirmServices from "../ConfirmServices";

export default function ConfirmServicesPage() {
  return <ConfirmServices />;
}
