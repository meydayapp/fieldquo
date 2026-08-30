// app/app/marketing/designer/layout.js
//
// The feature gate for `marketing_designer`, covering the designer index and
// the campaign editor beneath it. Nested inside app/app/marketing/layout.js
// (which gates `marketing_campaigns`), so reaching this sub-tree needs both
// features available — deliberate, not an oversight: a design always belongs
// to a campaign (MarketingDesign.campaignId), so a company FieldQuo has
// withdrawn marketing entirely from has no campaign to attach a design to
// either.
//
// A layout rather than a check inside the page: the page is gated whether it
// is reached by the nav, a bookmark or a typed URL, and there is exactly one
// guard implementation to get right. See app/components/FeatureGate.js.
import FeatureGate from "@/app/components/FeatureGate";

export default function Layout({ children }) {
  return <FeatureGate feature="marketing_designer">{children}</FeatureGate>;
}
