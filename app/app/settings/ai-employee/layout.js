// app/app/settings/ai-employee/layout.js
//
// The feature gate for `ai_employee`. Same shape as
// app/app/messages/layout.js and app/app/crew-inbox/layout.js — a server
// layout rather than a check inside the page, because the page is a client
// component and a bookmarked URL has to be stopped before anything renders.
import FeatureGate from "@/app/components/FeatureGate";

export default function Layout({ children }) {
  return <FeatureGate feature="ai_employee">{children}</FeatureGate>;
}
