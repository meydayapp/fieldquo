// lib/callbacks/scope.js
//
// Which callback lists a member may see and work: every list in the company
// for an owner or admin, only the lists whose rule is assigned to them for
// anyone else. One function, used by the list read and the outcome write,
// so the two cannot disagree about whose list it is.

export function listScope(member) {
  if (member.role === "owner" || member.role === "admin") return { companyId: member.companyId };
  return { companyId: member.companyId, rule: { assigneeMemberId: member.id } };
}
