// app/app/tenders/layout.js
//
// The feature gate for `tenders`, covering the list, the new form and every
// tender's page. Hidden by default (lib/features/registry.js): a company
// FieldQuo has not turned it on for gets an ordinary 404 here, the same as
// any unknown path, and /api/tenders answers the same way.
import FeatureGate from "@/app/components/FeatureGate";

export default function Layout({ children }) {
  return <FeatureGate feature="tenders">{children}</FeatureGate>;
}
