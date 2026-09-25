// docs/screens/app-guide/harness/fixtures/ai-team.js
//
// The fixture company's AI team — GET /api/ai-employee and its proposals —
// split out of routes-settings-b.js (2026-09-25) so the /signup side panel
// can draw the REAL TeamFlow (app/components/aiEmployee/TeamFlow.js) from
// it without importing routes-settings-b, which carries the checklist and
// instant-estimate seed libraries (~140 KB gzipped). Moved, not changed:
// routes-settings-b.js imports both names back.
import { COMPANY, day, iso } from "./company.js";
import { SOURCE_KINDS, READABLE_EXTENSIONS } from "@/lib/aiEmployee/sources";

const SLUG = COMPANY.bookingSlug || COMPANY.slug;
const AI_EMPLOYEE_TONES = ["professional", "warm", "brief"];

// ── The AI employees (inbox) ────────────────────────────────────────────────
//
// The GET /api/ai-employee payload as the route shapes it today: a TEAM
// (one row per role), the role table with what the company may switch off,
// the modes and the floor, and the flow view's intents and this week's
// routing counts. Three employees, so the front desk has a decision to draw
// and the hand-off arrow has a number on it.
const AI_TOOL_RISK = { look_up_service_prices: "reversible", create_instant_quote: "reversible", send_instant_quote_link: "reversible", book_callback: "reversible", check_availability: "reversible", book_appointment: "commits", hand_off_to_human: "reversible", hand_off_to_employee: "reversible" };
const AI_ALL_TOOLS = Object.keys(AI_TOOL_RISK);
const AI_ROLE_ALLOWED = {
  closer: AI_ALL_TOOLS,
  receptionist: ["book_callback", "check_availability", "book_appointment", "hand_off_to_human", "hand_off_to_employee"],
  troubleshooter: ["book_callback", "hand_off_to_human", "hand_off_to_employee"],
  custom: ["book_callback", "hand_off_to_human", "hand_off_to_employee"],
};
const aiRole = (key, defaultFace) => ({
  key,
  labelKey: `app.aiEmployee.role.${key}`,
  blurbKey: `app.aiEmployee.role.${key}.blurb`,
  allowed: AI_ROLE_ALLOWED[key],
  forbidden: AI_ALL_TOOLS.filter((t) => !AI_ROLE_ALLOWED[key].includes(t)),
  switchable: AI_ROLE_ALLOWED[key].filter((t) => t !== "hand_off_to_human" && t !== "hand_off_to_employee"),
  defaultFace,
});
const aiEmployee = (over) => ({
  voice: "friendly",
  greeting: null,
  instructions: null,
  escalationRules: null,
  handoffPhrase: null,
  businessHoursOnly: false,
  maxRepliesPerThread: 3,
  metaEnabled: false,
  webChatEnabled: false,
  smsEnabled: false,
  disabledTools: [],
  intents: [],
  createdAt: iso(day(-40)),
  updatedAt: iso(day(-3)),
  ...over,
});
export const AI_EMPLOYEE = {
  employees: [
    aiEmployee({
      id: "aie_camille", role: "receptionist", name: "Camille", displayName: "Camille", avatarUrl: "/ai-employees/receptionist-f.jpg",
      enabled: true, mode: "accept_edits", tone: "warm", metaEnabled: true, webChatEnabled: true,
      greeting: "Bonjour ! Camille ici, de chez Érable Design. Je peux répondre à vos questions ou organiser un rappel.",
      instructions: "Residential kitchens, bathrooms and built-ins only. Lead time on a full kitchen is about 8 weeks. Never quote a price — offer the instant estimate link or a callback from Samuel.",
      escalationRules: "Hand off anything about a warranty claim, a complaint, or a job already in progress.",
      handoffPhrase: "Je transmets ça à l'équipe — quelqu'un vous revient aujourd'hui.",
      businessHoursOnly: true,
    }),
    aiEmployee({
      id: "aie_lea", role: "closer", name: "Léa", displayName: "Léa", avatarUrl: "/ai-employees/closer-m.jpg",
      enabled: true, mode: "ask", tone: "professional", intents: ["price"], disabledTools: ["create_instant_quote"],
      createdAt: iso(day(-20)),
    }),
    aiEmployee({
      id: "aie_marc", role: "troubleshooter", name: "Marc", displayName: "Marc", avatarUrl: null,
      enabled: false, mode: "ask", tone: "brief", createdAt: iso(day(-9)),
    }),
  ],
  roles: [
    aiRole("closer", "/ai-employees/closer-m.jpg"),
    aiRole("receptionist", "/ai-employees/receptionist-f.jpg"),
    aiRole("troubleshooter", null),
    aiRole("custom", null),
  ],
  toolRisk: AI_TOOL_RISK,
  modes: [
    { key: "ask", sentenceKey: "app.aiEmployee.mode.ask.sentence" },
    { key: "accept_edits", sentenceKey: "app.aiEmployee.mode.accept_edits.sentence" },
    { key: "auto", sentenceKey: "app.aiEmployee.mode.auto.sentence" },
  ],
  floorKeys: ["app.aiEmployee.floor.spend", "app.aiEmployee.floor.delete", "app.aiEmployee.floor.move", "app.aiEmployee.floor.contract", "app.aiEmployee.floor.settings"],
  channels: ["meta", "web", "sms"],
  faces: [
    { key: "closer-m", url: "/ai-employees/closer-m.jpg", forRole: "closer" },
    { key: "receptionist-f", url: "/ai-employees/receptionist-f.jpg", forRole: "receptionist" },
    { key: "dispatcher-m", url: "/ai-employees/dispatcher-m.jpg", forRole: null },
    { key: "marketer-f", url: "/ai-employees/marketer-f.jpg", forRole: null },
  ],
  tones: AI_EMPLOYEE_TONES,
  voices: ["formal", "friendly", "brief"],
  sourceKinds: SOURCE_KINDS,
  readableExtensions: READABLE_EXTENSIONS,
  flow: {
    intents: ["book", "price", "problem", "other"],
    roleForIntent: { book: "receptionist", price: "closer", problem: "troubleshooter" },
    counts: {
      since: iso(day(-7)),
      byIntent: { book: 9, price: 6, problem: 2, other: 4 },
      byChannel: { meta: 12, web: 9, sms: 0 },
      assignedTo: { aie_camille: 15, aie_lea: 6 },
      handOffs: { "aie_camille>aie_lea": 3 },
      toHuman: { aie_camille: 2, aie_lea: 1 },
      escalated: 0,
      resumed: 1,
      burstMerged: 4,
    },
  },
  ai: {
    configured: true, allowed: true, reason: null, remaining: 412, cap: 600, usedTokens: 188000, nearLimit: false,
    model: "gpt-5.5", tier: "best", typicalConversationCents: 4,
    pricing: { inputPerMillionCents: 250, outputPerMillionCents: 1000 },
  },
  businessHoursOpenNow: true,
  hasBusinessHours: true,
  channel: { connected: true, reason: null, mock: false },
  sms: { available: false, number: null },
  webChat: {
    slug: SLUG,
    snippet: `<iframe src="https://app.fieldquo.com/embed/${SLUG}/chat" title="Chat" style="position:fixed;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 32px);border:0;z-index:2147483000;background:transparent" allow="clipboard-write"></iframe>`,
    embedUrl: `https://app.fieldquo.com/embed/${SLUG}/chat`,
  },
};
export const AI_PROPOSALS = {
  proposals: [
    { id: "pr_1", employeeId: "aie_lea", threadId: "th_nguyen", channel: "meta", tool: "book_appointment", args: { slot_id: `slot_${day(2, 14, 0).getTime()}`, name: "Thi Nguyen", phone: "+1 819 555 0142", address: "14 rue des Érables, Gatineau" }, argsHash: "fixture", risk: "commits", excerpt: "Est-ce que jeudi 14 h fonctionne pour la visite ?", status: "pending", expiresAt: iso(day(2, 14, 0)), stale: false, decidedAt: null, result: null, failureReason: null, createdAt: iso(day(0, 9, 12)) },
  ],
};
