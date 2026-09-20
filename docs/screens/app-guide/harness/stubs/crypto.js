// Harness stub for node's `crypto`: lib/marketing/unsubscribe.js imports
// randomBytes at module scope for the server-side unsubscribe token, and a
// page module the guide bundles reaches it through lib/marketing — so the
// browser bundle failed to build at all, and every figure with it. Nothing a
// captured screen does mints a token; if one ever did, this throws rather
// than handing back bytes that are not random.
export function randomBytes() {
  throw new Error("harness: no crypto");
}
export function createHash() {
  throw new Error("harness: no crypto");
}
export function createHmac() {
  throw new Error("harness: no crypto");
}
export function timingSafeEqual() {
  throw new Error("harness: no crypto");
}
export default { randomBytes, createHash, createHmac, timingSafeEqual };
