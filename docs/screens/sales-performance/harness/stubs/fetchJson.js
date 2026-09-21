// Harness stub of @/lib/fetchJson: the three pages' requests answered from
// fixtures/data.js — snapshots of what the REAL routes returned for the real
// database, written by dump.mjs (read-only). Nothing is invented: a route
// the fixture does not carry is a loud error, so a page that quietly
// depends on something unstubbed cannot render a wrong screen.
import { PLATFORM as platform, AGENCY as agency, QUALITY as quality, ME as me } from "../fixtures/data.js";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export async function fetchJson(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const u = new URL(url, "http://harness.local");
  await delay(20);
  const p = u.pathname;
  if (p === "/api/platform/sales/performance") return platform;
  if (p === "/api/sales/agency/performance") return agency;
  if (p === "/api/sales/agency/call-quality") return quality;
  if (p === "/api/sales/me") return me;
  if (p === "/api/platform/me") return { id: "adm1", email: "emilio@fieldquo.com", role: "superadmin", active: true, permissions: ["*"] };
  if (p === "/api/sales/language") return { language: "en", options: [] };
  throw new Error("harness: no fixture for " + method + " " + p);
}
export default fetchJson;
