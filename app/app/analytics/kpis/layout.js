// app/app/analytics/kpis/layout.js
//
// The feature gate for `kpi_dashboard`, covering this page and anything added
// beneath it later.
//
// A layout rather than a check inside the page: the page is a client component
// (app/app/analytics/kpis/page.js) and cannot read the database itself, and a
// bookmarked URL must be stopped before it renders whether or not the visitor
// came through the sidebar. See app/components/FeatureGate.js.
import FeatureGate from "@/app/components/FeatureGate";

export default function Layout({ children }) {
  return <FeatureGate feature="kpi_dashboard">{children}</FeatureGate>;
}
