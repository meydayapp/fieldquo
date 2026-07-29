// app/platform/help/page.js
//
// Support runbook for FieldQuo staff — the same knowledge base, filtered to the
// "platform" audience (troubleshooting, how support access works). Gated by the
// platform-token middleware like every /platform page.
"use client";

import HelpCenter from "@/app/components/help/HelpCenter";

export default function PlatformHelpPage() {
  return (
    <HelpCenter
      audience="platform"
      title="Support Runbook"
      intro="Troubleshooting and how-to for supporting companies — the failure modes you'll actually field, and how to resolve them."
    />
  );
}
