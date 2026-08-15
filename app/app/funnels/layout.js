// app/app/funnels/layout.js
//
// The feature gate for `funnels`, covering the funnel builder and its analytics
// and every route beneath this one.
//
// A layout rather than a check inside the page: the page is gated whether it is
// reached by the nav, a bookmark or a typed URL, and there is exactly one guard
// implementation to get right. See app/components/FeatureGate.js.
import FeatureGate from "@/app/components/FeatureGate";

export default function Layout({ children }) {
  return <FeatureGate feature="funnels">{children}</FeatureGate>;
}
