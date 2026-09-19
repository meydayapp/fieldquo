// The caller, for the routes: one owner of company co1 (or whatever the
// check sets). Exposes the same names as lib/apiMember.js.
export const state = { member: { id: "m1", userId: "u1", companyId: "co1", role: "owner" } };
export async function memberOrRefusal() {
  return { member: state.member };
}
export async function memberOrRefusalPlain() {
  return { member: state.member };
}
export function refusalBody(err) {
  return { error: err?.message || "refused" };
}
