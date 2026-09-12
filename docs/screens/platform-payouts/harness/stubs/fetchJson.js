// Harness stub of @/lib/fetchJson: answers the real pages' requests from
// fixtures.js. A mark-paid POST mutates the fixture so the screenshot after
// the click shows the real component on a real answer.
import { REPS, BATCHES, SNAPSHOT, TABLE, ME, LANG_OPTIONS } from "../fixtures.js";
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const role = () => new URLSearchParams(window.location.search).get("role") || "superadmin";
export async function fetchJson(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const u = new URL(url, "http://harness.local");
  await delay(30);
  const p = u.pathname;
  if (p === "/api/platform/me") return { id: "adm1", email: "emilio@fieldquo.com", role: role(), active: true, permissions: role() === "superadmin" ? ["*"] : [] };
  if (p === "/api/platform/sales/reps") return { reps: REPS, salesNumber: { e164: "+14385550100", state: "assigned" }, numberCapabilities: [], plans: [{ id: "plan1", name: "Standard", active: true, activationCents: 2000, firstPaymentCents: 4000, retentionCents: 6500, retentionDays: 60 }] };
  if (p === "/api/platform/sales/payouts") {
    const period = u.searchParams.get("period") || "week";
    return { snapshot: { ...SNAPSHOT, cycle: { ...SNAPSHOT.cycle, period } }, table: TABLE[period], batches: BATCHES, canMarkPaid: role() === "superadmin" };
  }
  const rep = /^\/api\/platform\/sales\/reps\/([^/]+)\/payouts$/.exec(p);
  if (rep) return { rep: REPS.find((r) => r.id === rep[1]), batches: BATCHES.filter((b) => b.salesRepId === rep[1]), accruingCents: rep[1] === "repana" ? 2000 : 0, canMarkPaid: role() === "superadmin" };
  const paid = /^\/api\/platform\/sales\/payouts\/([^/]+)\/paid$/.exec(p);
  if (paid && method === "POST") {
    const b = BATCHES.find((x) => x.id === paid[1]);
    const body = options.body;
    const file = body.get("proof");
    const ref = String(body.get("paymentReference") || "").trim();
    if (!file && !ref && !b.proofUrl && !b.paymentReference) throw new Error("Attach the receipt or transfer screenshot, or enter the payment reference — the rep needs one of the two to see what was sent.");
    Object.assign(b, { status: "paid", paidAt: b.paidAt || new Date().toISOString(), hasProof: true, paidVia: String(body.get("paidVia") || b.paidVia || "").trim() || null, paymentReference: ref || b.paymentReference, paymentNote: String(body.get("paymentNote") || "").trim() || b.paymentNote, proofUrl: file ? "https://res.cloudinary.com/fieldquo/image/upload/fieldquo/platform/payouts/" + b.id + "/receipt.png" : b.proofUrl, proofFilename: file ? file.name : b.proofFilename });
    return { batch: b, cents: b.cents, driftedFromClose: false, notified: true };
  }
  if (p === "/api/sales/me") return ME;
  if (p === "/api/sales/language") return { language: "en", options: LANG_OPTIONS };
  if (p === "/api/sales/sells-in") return { sellsIn: ["fr", "en"], options: LANG_OPTIONS };
  if (p === "/api/sales/push-subscription") return { configured: false, publicKey: null, live: 0 };
  if (p.startsWith("/api/platform/sales/reps/") && p.endsWith("/queue")) return { presence: null, held: 12, untouched: 4, dialled: 8, openLeads: 2, targets: [] };
  throw new Error("harness: no fixture for " + method + " " + p);
}
export default fetchJson;
