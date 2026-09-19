// Records sends instead of mailing. Same exports lib/email/resend.js has
// that the guide's code reads.
export const sent = [];
export const state = { fail: false, skip: false };
export const SENDER_SELECT = { name: true, email: true, emailDomain: true, emailDomainStatus: true, emailFromLocal: true };
export function senderFor(company = {}) {
  return { from: `${company.name} <quotes@send.example.com>`, replyTo: company.email || undefined };
}
export async function sendEmail(payload) {
  sent.push(payload);
  if (state.fail) return { error: { message: "fixture refused" } };
  if (state.skip) return { skipped: true };
  return { id: `msg_${sent.length}` };
}
