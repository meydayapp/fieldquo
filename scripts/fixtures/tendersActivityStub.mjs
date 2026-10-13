// scripts/fixtures/tendersActivityStub.mjs — recordActivity, recorded.
export const activity = [];
export async function recordActivity(member, event) {
  activity.push({ companyId: member?.companyId, ...event });
}
