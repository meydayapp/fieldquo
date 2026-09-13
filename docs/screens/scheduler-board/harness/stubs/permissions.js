// Harness stub: the owner's caller. hasLevel() short-circuits on the
// unrestricted roles, so every gate on the page opens as it would for an owner.
export function usePermissions() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("as") === "dispatcher") {
    return { role: "supervisor", permissions: { schedule: "edit_all" } };
  }
  if (params.get("as") === "worker") {
    return { role: "employee", permissions: { schedule: "view_own" } };
  }
  return { role: "owner" };
}
