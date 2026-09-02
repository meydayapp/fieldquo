// app/sales/layout.js
//
// Shell for FieldQuo's sales portal — the third staff surface, after /app and
// /platform.
//
// Visually plain on purpose, and NOT the platform console's dark chrome: a rep
// and a superadmin are different people with different powers, and two dark
// consoles side by side is how somebody acts in the wrong one. Same reasoning
// app/platform/layout.js gives for looking unlike the tenant app.
//
// force-dynamic for the same reason /platform has it: every screen here reads
// live data behind a cookie check, so there is nothing to prerender, and
// prerendering would make the build depend on a reachable database.
export const dynamic = "force-dynamic";

import SalesShell from "./SalesShell";

export const metadata = {
  title: "FieldQuo Sales",
};

export default function SalesLayout({ children }) {
  return <SalesShell>{children}</SalesShell>;
}
