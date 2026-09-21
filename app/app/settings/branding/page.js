// app/app/settings/branding/page.js
//
// The form itself lives in app/components/settings/BrandingForm.js, because
// the home page's set-up dialog renders the same one. This page is the frame.
"use client";

import BrandingForm from "@/app/components/settings/BrandingForm";

export default function BrandingPage() {
  return <BrandingForm />;
}
