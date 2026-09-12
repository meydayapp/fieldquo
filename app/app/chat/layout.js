// app/app/chat/layout.js
//
// The feature gate for `team_chat`, covering the company's crew chat.
//
// A layout rather than a check inside the page: the page is gated whether it
// is reached by the nav, the mobile tab bar, a bookmark or the URL a push
// notification lands on, and there is exactly one guard implementation to
// get right. Same shape as app/app/crew-inbox/layout.js — see
// app/components/FeatureGate.js.
import FeatureGate from "@/app/components/FeatureGate";

export default function Layout({ children }) {
  return <FeatureGate feature="team_chat">{children}</FeatureGate>;
}
