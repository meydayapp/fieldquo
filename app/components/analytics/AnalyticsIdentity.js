// app/components/analytics/AnalyticsIdentity.js
//
// Tells HeyCatch who is using /app. Renders nothing.
//
// Mounted once in app/app/layout.js with a payload the SERVER built through
// identityPayload() (lib/heycatch/gate.js): the internal user id plus
// companyId, role and plan tier — no email, no name, no phone, and null for a
// support session or a demo sandbox, in which case this does nothing at all.
// The reasons are written beside identityPayload.
//
// One effect, keyed on the four values, so a re-render never re-sends: the
// SDK drops person-property updates past sixty a minute, and a call per
// render is exactly what its guide warns against.
"use client";

import { useEffect } from "react";
import { withAnalytics } from "@/lib/heycatch/client";

export default function AnalyticsIdentity({ identity = null }) {
  const id = identity?.id || null;
  const companyId = identity?.properties?.companyId || null;
  const role = identity?.properties?.role || null;
  const plan = identity?.properties?.plan || null;

  useEffect(() => {
    if (!id) return;
    withAnalytics((analytics) => analytics.setIdentity(id, { companyId, role, plan }));
  }, [id, companyId, role, plan]);

  return null;
}
