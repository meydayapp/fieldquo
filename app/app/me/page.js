"use client";

// app/app/me/page.js
//
// Home. A worker's (next up, hours today, shout-outs) or a manager's
// (today's coverage, the report tiles, dispatch, what needs review) —
// decided by the same rule that picks the tab set (lib/me/tabs.js), so the
// screen a person lands on matches the bar under their thumb.
import MeShell from "@/app/components/me/MeShell";
import WorkerHome from "@/app/components/me/WorkerHome";
import ManagerHome from "@/app/components/me/ManagerHome";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { meTabSetFor } from "@/lib/me/tabs";

export default function MeHomePage() {
  const caller = usePermissions();
  const manager = meTabSetFor(caller) === "manager";
  return <MeShell wide={manager}>{manager ? <ManagerHome /> : <WorkerHome />}</MeShell>;
}
