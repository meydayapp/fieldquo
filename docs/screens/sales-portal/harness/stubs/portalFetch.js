// window.fetch for the portal harness. Every /api/sales/* read the pages and
// the shell make is answered from ../fixtures.js; anything else is a loud
// error so a page that quietly depends on a route nobody stubbed cannot
// render a wrong screen. The real lib/fetchJson stays in the bundle — it
// only wraps fetch — so the pages run their shipped request code.
import {
  ME, BADGES, QUEUE, OUTREACH, LEADS, LEAD_COUNTS, THREADS, COMPANIES, EVENTS,
  NOTES, NOTES_ARCHIVED_COUNT, TICKETS, TICKET_COUNTS, EARNINGS, VOICEMAIL, DEMO,
} from "../fixtures.js";
import { PAYOUT_METHODS, ENGAGEMENTS } from "@/lib/sales/payoutDetails";
import { REP_LANGUAGE_OPTIONS } from "@/lib/sales/repLanguage";
import { STATUS_CHOICES, STATE_ORDER, REP_STATES, PAUSE_REASON_ORDER, PAUSE_REASONS } from "@/lib/sales/calls/agentState";
// Texts and Team are answered by the fixtures their own harnesses carry, so
// the rows here are the rows those frames show.
import { fetchJson as messagesFetch } from "../../../sales-messages/harness/stubs/fetchJson.js";
import { fetchJson as staffFetch } from "../../../team-chat/harness/staffFetch.js";
// The rep's own funnel card on Today (69a79204): built through the pure
// stage helpers the route uses, over a month of invented dials.
import { stageCounts, buildRepFunnel, monthKeyOf, shiftMonth } from "@/lib/sales/funnelStages";

// One lead opened in full — the shape of GET /api/sales/leads/[id]. Bright
// Current, not Easy Roofers: the link-a-signup box only shows on a lead
// that has NOT converted, and the caption asks for it.
function leadDetail(id) {
  const base = LEADS.find((l) => l.id === id);
  if (!base) return null;
  const lead = {
    ...base, timeZone: "America/Chicago", country: "US", province: "OK",
    notes: "Owner, two vans. Demo booked for Tuesday 3 pm; wants the invoice side shown too.",
    prospect: null, convertedAt: null, createdAt: "2026-09-08T14:12:00.000Z", updatedAt: "2026-09-12T13:20:00.000Z",
    threads: [{ id: "t1", subject: "A quicker way to quote roofing jobs", lastMessageAt: "2026-09-12T13:20:00.000Z", createdAt: "2026-09-09T15:40:00.000Z", messages: [
      { id: "m3", direction: "in", fromAddress: base.email, toAddress: ME.email, subject: "Re: A quicker way to quote roofing jobs", sentAt: "2026-09-12T13:20:00.000Z", body: "Thursday afternoon works — can you show the invoice side too?" },
    ] }],
  };
  return {
    lead, linkedCompany: null, optedOut: false, optedOutReason: null, optedOutReasonKey: null, optedOutReasonParams: null,
    // lib/sales/leadDial.js's leadDialView, written out: that module's
    // neighbours reach lib/db and a browser bundle cannot carry them.
    call: {
      phoneE164: "+14055550177",
      contact: { callable: true, code: "ok", title: "", text: "" },
      callingContext: { country: "US", province: "OK", timeZone: "America/Chicago", source: "lead", windowPolicy: null },
    },
    numbers: {
      stored: [{ id: "cn1", e164: "+14055550177", kind: "mobile", label: "Dave — mobile", canCall: true, canText: true, preferred: true, note: null, createdAt: "2026-09-08T14:12:00.000Z" }],
      voice: { choices: [{ id: "cn1", e164: "+14055550177", kind: "mobile", label: "Dave — mobile", preferred: true }], refused: false, reason: "ok" },
      text: { choices: [{ id: "cn1", e164: "+14055550177", kind: "mobile", label: "Dave — mobile", preferred: true }], refused: false, reason: "ok" },
    },
    outreach: OUTREACH,
    retry: null,
    serverNow: "2026-09-12T14:00:00.000Z",
  };
}

const lang = () => new URLSearchParams(window.location.search).get("lang") || "en";
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const state = {
  presence: { state: "available", forMs: 12 * 60000, stale: false, pauseReason: null },
  autodial: false,
};

function answer(p, u, method, body) {
  if (p === "/api/sales/me") return ME;
  if (p === "/api/sales/badges") return BADGES;
  if (p === "/api/sales/tour") return { step: 0, dismissed: true, completed: false };
  if (p === "/api/sales/auth/logout") return { ok: true };
  if (p === "/api/sales/queue") return QUEUE;
  if (p === "/api/sales/leads") return { leads: LEADS, counts: LEAD_COUNTS, outreach: OUTREACH };
  // No link texted from this lead yet: the progress panel draws nothing on a
  // 404, which is the state the lead detail is captured in.
  if (/^\/api\/sales\/leads\/[^/]+\/signup-progress$/.test(p)) return json({ error: "Not found" }, 404);
  if (/^\/api\/sales\/leads\/[^/]+$/.test(p)) { const d = leadDetail(p.split("/").pop()); return d || json({ error: "Not found." }, 404); }
  if (p === "/api/sales/threads") return { threads: THREADS, outreach: OUTREACH };
  if (/^\/api\/sales\/threads\/[^/]+$/.test(p)) {
    const base = THREADS.find((t) => t.id === p.split("/").pop());
    if (!base) return json({ error: "Not found." }, 404);
    const lead = LEADS.find((l) => l.id === base.leadId);
    return {
      thread: { ...base, createdAt: "2026-09-09T15:40:00.000Z", lead: { id: lead.id, businessName: lead.businessName, contactName: lead.contactName, email: lead.email, phone: lead.phone, status: lead.status },
        messages: [
          { id: "m1", direction: "out", fromAddress: ME.email, toAddress: lead.email, subject: "A quicker way to quote roofing jobs", sentAt: "2026-09-09T15:40:00.000Z", body: "Hi Dave — Daniel from FieldQuo. You mentioned on the phone that quotes take you an evening each; here is the two-minute version we talked about. Would Thursday work for a quick walkthrough?" },
          { id: "m2", direction: "in", fromAddress: lead.email, toAddress: ME.email, subject: "Re: A quicker way to quote roofing jobs", sentAt: "2026-09-11T22:05:00.000Z", body: "Thursday could work. What time?" },
          { id: "m3", direction: "in", fromAddress: lead.email, toAddress: ME.email, subject: "Re: A quicker way to quote roofing jobs", sentAt: "2026-09-12T13:20:00.000Z", body: "Thursday afternoon works — can you show the invoice side too?" },
        ] },
      optedOut: false, optedOutReason: null, optedOutReasonKey: null, optedOutReasonParams: null, outreach: OUTREACH,
    };
  }
  if (p === "/api/sales/auth/invite" && method === "GET") return { name: "Daniel Roy", email: "daniel@fieldquo.com" };
  if (p === "/api/sales/auth/login" && method === "POST") return { success: true };
  // The first-text panel on a lead: can send, one textable number, one text already sent.
  if (p === "/api/sales/sms")
    return {
      lead: { id: "l2", businessName: "Bright Current Electrical", phone: "+14055550177", timeZone: "America/Chicago" },
      sms: { canSend: true, blockers: [], to: "(405) 555-0177", from: "(405) 555-0999", timeZone: "America/Chicago", timeZoneSource: "lead",
        body: "Hi Dave, Daniel from FieldQuo. Here is the signup link we talked about: https://fieldquo.com/signup?sales=danielboves — first month free. Reply STOP to opt out." },
      contact: { to: "+14055550177", choices: [{ id: "cn1", e164: "+14055550177", kind: "mobile", label: "Dave — mobile", preferred: true }], refused: [] },
      messages: [{ id: "sm1", toE164: "+14055550177", body: "Hi Dave, Daniel from FieldQuo. Did the booking link land in your inbox OK?", sentAt: "2026-09-09T16:02:00.000Z" }],
    };
  if (p === "/api/sales/funnel") {
    const monthKey = monthKeyOf(new Date());
    const [y, mo] = monthKey.split("-").map(Number);
    const at = (day, hour = 14) => new Date(Date.UTC(y, mo - 1, Math.min(day, 28), hour)).toISOString();
    const mix = ["no_answer", "no_answer", "voicemail", "gatekeeper", "reached_not_interested", "reached_interested", "callback", "agreed_link_sent", "no_answer", "busy"];
    const attempts = Array.from({ length: 410 }, (_, i) => ({ salesRepId: ME.id, direction: "out", dialledAt: at(1 + (i % 26), 13 + (i % 6)), disposition: mix[i % mix.length], leadId: mix[i % mix.length] === "agreed_link_sent" ? `lead_${i}` : null, prospectId: `p_${i}`, toE164: `+1405555${String(1000 + i).slice(-4)}` }));
    const companies = Array.from({ length: 8 }, (_, i) => ({ id: `fc_${i}`, stripeChargesEnabled: i < 4, isDemo: false }));
    const subscriptions = companies.slice(0, 6).map((c, i) => ({ companyId: c.id, billingStartedAt: i < 3 ? at(4 + i) : null, createdAt: at(2 + i), status: i < 3 ? "active" : "trialing", canceledAt: null, refundedAt: null, refundedAmountCents: 0, disputeStatus: null }));
    const attributions = companies.map((c, i) => ({ salesRepId: ME.id, companyId: c.id, capturedAt: at(2 + i) }));
    const counts = stageCounts({ attempts, linkSends: [{ salesRepId: ME.id, leadId: "lead_x", sentAt: at(9) }], attributions, companies, subscriptions, retainedCompanyIds: ["fc_0"], monthKey });
    const months = [];
    for (let i = 0; i < 6; i += 1) months.push(shiftMonth(monthKey, -i));
    return { monthKey, currentMonth: monthKey, months, funnel: buildRepFunnel({ rep: { id: ME.id, name: ME.name, code: ME.code, active: true, startedAt: "2026-06-01T14:00:00.000Z", acceptedAt: "2026-06-01T14:00:00.000Z", invitedAt: "2026-05-28T14:00:00.000Z" }, counts, monthKey, references: null }), generatedAt: new Date().toISOString() };
  }
  if (p === "/api/sales/companies") return { companies: COMPANIES, checkInError: null };
  if (p === "/api/sales/events") return { events: EVENTS };
  if (p === "/api/sales/notes") {
    const archived = u.searchParams.get("archived") === "1";
    return { notes: archived ? [] : NOTES, archivedCount: NOTES_ARCHIVED_COUNT };
  }
  if (p.startsWith("/api/sales/notes/")) {
    const id = p.split("/").pop();
    const note = NOTES.find((n) => n.id === id);
    return note ? { note } : json({ error: "No such note." }, 404);
  }
  if (p === "/api/sales/support") {
    const status = u.searchParams.get("status");
    return { tickets: status ? TICKETS.filter((t) => t.status === status) : TICKETS, counts: TICKET_COUNTS };
  }
  if (p === "/api/sales/earnings") return EARNINGS;
  if (p === "/api/sales/payout")
    return {
      payoutMethod: "interac", payoutHandle: "daniel.roy@outlook.com", engagement: "freelancer", accruesPaidLeave: false,
      confirmedAt: "2026-08-03T15:00:00.000Z", confirmedDaysAgo: 40, ready: true, problems: [], adminProblems: [],
      methods: PAYOUT_METHODS, engagements: ENGAGEMENTS,
    };
  if (p === "/api/sales/language") return { language: lang(), options: REP_LANGUAGE_OPTIONS };
  if (p === "/api/sales/sells-in") return { sellsIn: ["en", "fr"], options: REP_LANGUAGE_OPTIONS };
  if (p === "/api/sales/push-subscription") return { configured: true, publicKey: "BHarnessKey", live: 0 };
  if (p === "/api/sales/voicemail") return VOICEMAIL;
  if (p === "/api/sales/demo") return DEMO;
  // The shell's presence picker and the incoming-call dock.
  if (p === "/api/sales/calls" && method === "GET")
    return {
      rep: { id: ME.id, name: ME.name }, store: { ready: true, missing: [] }, dialMode: { mode: "progressive" },
      dial: { ready: true, blockedBy: null }, dispositions: [],
      states: STATE_ORDER.map((code) => ({ code, ...REP_STATES[code] })),
      pauseReasons: PAUSE_REASON_ORDER.map((code) => PAUSE_REASONS[code]),
      statusChoices: STATUS_CHOICES, autodial: state.autodial, presence: state.presence, pendingAttempt: null, today: null,
      serverNow: new Date().toISOString(),
    };
  if (p === "/api/sales/calls/token") return { token: "tok", expiresInSeconds: 600 };
  if (p === "/api/sales/calls/state") {
    if (method === "POST" && body?.state) state.presence = { ...state.presence, state: body.state, pauseReason: body.pauseReason || null, forMs: 0 };
    return { presence: state.presence, store: { ready: true }, choices: STATUS_CHOICES, autodial: state.autodial };
  }
  return null;
}

// Texts and Team: the other harnesses' fetchJson-level stubs, wrapped back
// into a Response so the shipped lib/fetchJson in this bundle can unwrap it.
async function delegated(p, url, options) {
  const stub = p.startsWith("/api/sales/messages") ? messagesFetch : p.startsWith("/api/staff/") ? staffFetch : null;
  if (!stub) return null;
  try {
    let body = options.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch {} }
    return json(await stub(url, { ...options, body }));
  } catch (err) {
    return json({ error: String(err?.message || err) }, 400);
  }
}

const realFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
  const u = new URL(String(url), "http://harness.local");
  if (!u.pathname.startsWith("/api/")) return realFetch(url, options);
  const method = (options.method || "GET").toUpperCase();
  let body = null;
  try { body = options.body ? JSON.parse(options.body) : null; } catch {}
  (window.__harnessCalls ||= []).push({ url: u.pathname + u.search, method, body });
  await new Promise((r) => setTimeout(r, 20));
  const handed = await delegated(u.pathname, String(url), options);
  if (handed) return handed;
  const out = answer(u.pathname, u, method, body);
  if (out instanceof Response) return out;
  if (out === null) {
    (window.__harnessUnanswered ||= []).push(method + " " + u.pathname);
    return json({ error: "Harness has no answer for " + method + " " + u.pathname }, 500);
  }
  return json(out);
};
