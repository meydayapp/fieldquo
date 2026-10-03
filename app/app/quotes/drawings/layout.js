// app/app/quotes/drawings/layout.js
//
// The feature gate for the drawing read ("Start from drawings"), which is the
// deep read's own family — `ai_vision` in lib/features/registry.js. A layout,
// so the page is gated however it is reached: the builder's link, a lead's,
// a bookmark. See app/components/FeatureGate.js.
import FeatureGate from "@/app/components/FeatureGate";

export default function Layout({ children }) {
  return <FeatureGate feature="ai_vision">{children}</FeatureGate>;
}
