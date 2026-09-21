// app/app/settings/material-costs/page.js
//
// The editor lives in ./MaterialCostsEditor.js, because the home page's
// set-up dialog renders the same one. This page is the gate and the frame.
"use client";

import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasToggle } from "@/lib/permissions/enforce";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import MaterialCostsEditor from "./MaterialCostsEditor";

/**
 * The same gate Overhead carries, for the same reason.
 *
 * This screen's own subtitle says these numbers "drive the internal Cost /
 * Margin estimate on every quote — what you actually pay for materials and
 * labour, separate from the price you charge the client". That is the cost
 * basis in the page's own words, and jobCosting is the toggle that says
 * whether someone sees it.
 */
export default function MaterialCostsPage() {
  const caller = usePermissions();
  if (caller && !hasToggle(caller, "jobCosting")) {
    return <NoAccessPanel capability="jobCosting" />;
  }
  return <MaterialCostsEditor />;
}

