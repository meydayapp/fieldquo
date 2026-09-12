// Harness stub for @/app/providers/PermissionProvider: full edit unless the
// URL says ?readonly=1, which draws the view-only member's screen.
const ro = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("readonly") === "1";
export function useHasLevel() { return !ro; }
export function useHasToggle() { return true; }
export function usePermissions() { return null; }
export function useSeesOnlyAssignedJobs() { return false; }
export function PermissionProvider({ children }) { return children; }
