export const errors = [];
export async function recordError(payload) {
  errors.push(payload);
}
export function errorDetail(err, extra = {}) {
  return { ...extra, message: err?.message };
}
