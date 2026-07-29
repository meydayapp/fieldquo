// app/app/help/page.js
//
// In-app knowledge base for contractors. Static content, so it's a thin
// wrapper over the shared HelpCenter with the "company" audience.
"use client";

import HelpCenter from "@/app/components/help/HelpCenter";

export default function HelpPage() {
  return (
    <HelpCenter
      audience="company"
      title="Help Centre"
      intro="Guides for getting the most out of FieldQuo — setup, quoting, instant quotes, payments and more."
    />
  );
}
