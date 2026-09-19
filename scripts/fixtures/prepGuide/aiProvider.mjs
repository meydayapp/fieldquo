// The model vendor seam, for checks that only need "is AI configured?".
export function isAiConfigured() {
  return false;
}
export async function complete() {
  throw new Error("fixture: no model");
}
export async function runToolLoop() {
  throw new Error("fixture: no model");
}
