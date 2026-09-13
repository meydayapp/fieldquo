// Harness stub: ?as=worker|manager|owner picks the caller, so both tab sets
// and both Homes render from the same bundle.
export function usePermissions() {
  const as = new URLSearchParams(window.location.search).get("as") || "worker";
  if (as === "owner") return { role: "owner" };
  if (as === "manager") return { role: "supervisor", permissions: { schedule: "edit_all", payroll: "view_all" } };
  return { role: "employee", permissions: { schedule: "view_own", payroll: "view_own" } };
}
export function useHasLevel() { return true; }
export function useHasToggle() { return true; }
export function useSeesOnlyAssignedJobs() { return false; }
export function PermissionProvider({ children }) { return children; }
