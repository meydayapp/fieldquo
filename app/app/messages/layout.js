// app/app/messages/layout.js
//
// The feature gate for `page_messaging`, covering the inbox, the conversation
// pane and the monthly review beneath it.
//
// A layout rather than a check inside each page: the pages are gated whether
// they are reached by the nav, a bookmark or a typed URL, and there is exactly
// one guard implementation to get right. Same shape as
// app/app/crew-inbox/layout.js — see app/components/FeatureGate.js.
import FeatureGate from "@/app/components/FeatureGate";

export default function Layout({ children }) {
  return <FeatureGate feature="page_messaging">{children}</FeatureGate>;
}
