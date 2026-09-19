export async function resolveSender(company = {}) {
  return { from: `${company.name} <quotes@send.example.com>`, replyTo: company.email || "owner@example.com" };
}
export async function ownerEmailFor() {
  return "owner@example.com";
}
