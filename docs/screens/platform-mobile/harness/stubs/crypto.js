// Harness stub for node's `crypto`, for the same reason as stubs/db.js: the
// fixtures' pure dialTableRow imports lib/sales/performance.js, whose graph
// reaches lib/jobs/changeOrderAddendum.js (createHash, for an addendum's
// fingerprint). Nothing a /platform page renders calls it; if something
// starts to, the harness says so rather than hashing wrong.
export function createHash() {
  throw new Error("harness: node's crypto is server-only — something called createHash in the browser bundle");
}
export default { createHash };
