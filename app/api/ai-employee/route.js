// app/api/ai-employee/route.js
//
// The AI employee's own configuration.
//
//   GET  → the employee (created lazily on first read), the role presets, the
//          company's AI allowance, and whether the channel it answers on is
//          actually connected.
//   PUT  → save. Recomputes instructionsFingerprint.
//
// Owner/admin only, the same rung as the AI credit plan and the phone
// receptionist: this decides what gets said to customers in the company's
// name, and it spends the company's AI allowance to do it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { isAiConfigured } from "@/lib/ai/provider";
import { checkAiQuota } from "@/lib/ai/usage";
import { messagingConnection } from "@/lib/messaging/channels";
import {
  AI_EMPLOYEE_ROLES,
  AI_EMPLOYEE_TONES,
  CLOSED_ROLE,
  roleFor,
  instructionsFingerprint,
} from "@/lib/aiEmployee/roles";
import { READABLE_EXTENSIONS, SOURCE_KINDS } from "@/lib/aiEmployee/sources";
import { withinBusinessHours } from "@/lib/aiEmployee/decide";

/** How long an instruction block may be. Long enough for a real policy, short
 *  enough that it cannot be used to push the role's own rules out of context. */
const MAX_INSTRUCTIONS = 4000;
const MAX_SHORT = 300;

async function admin(request, { allowSupportToLook = false } = {}) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { response };
  // A read-only support session is waved through on the READ, the same
  // carve-out app/api/settings/ai/credit/route.js makes on the same screen's
  // neighbour: non-negotiable #3 is that the platform console views everything
  // and edits nothing. Writes below do NOT pass this flag, so support can read
  // the setup and change none of it.
  if (allowSupportToLook && member.impersonation) return { member };
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return {
      response: NextResponse.json(
        { error: "Only an owner or admin can set up the AI employee." },
        { status: 403 },
      ),
    };
  }
  return { member };
}

/**
 * The row, created on first read.
 *
 * Lazily rather than at signup: a company that never opens this screen should
 * not carry a row for a feature they have not used. Created DISABLED with
 * autoReplyEnabled false — the schema's defaults, restated nowhere, so there is
 * one definition of what a new employee does (nothing).
 */
async function loadOrCreate(companyId, { mayCreate = true } = {}) {
  const existing = await db.aiEmployee.findUnique({ where: { companyId } });
  if (existing) return existing;
  // An impersonating support session must never write, and "read the screen"
  // would otherwise create a row for a company that never opened it — a
  // FieldQuo employee's look leaving a trace in a customer's data. They get
  // the same defaults the create would have used, unsaved.
  if (!mayCreate) {
    return {
      id: null, companyId, role: "receptionist", name: null, enabled: false,
      autoReplyEnabled: false, tone: null, greeting: null, instructions: null,
      escalationRules: null, handoffPhrase: null, businessHoursOnly: false,
      maxRepliesPerThread: 3, updatedAt: null,
    };
  }
  return db.aiEmployee.create({ data: { companyId } });
}

/** What crosses to the browser. No secrets here, but shaped rather than
 *  spread, so a column added later is a deliberate exposure. */
function publicEmployee(row) {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    enabled: row.enabled,
    autoReplyEnabled: row.autoReplyEnabled,
    tone: row.tone,
    greeting: row.greeting,
    instructions: row.instructions,
    escalationRules: row.escalationRules,
    handoffPhrase: row.handoffPhrase,
    businessHoursOnly: row.businessHoursOnly,
    maxRepliesPerThread: row.maxRepliesPerThread,
    updatedAt: row.updatedAt,
  };
}

export async function GET(request) {
  const { member, response } = await admin(request, { allowSupportToLook: true });
  if (response) return response;

  const employee = await loadOrCreate(member.companyId, { mayCreate: !member.impersonation });

  const [company, quota, connection] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: { businessHours: true, timezone: true },
    }),
    checkAiQuota(member.companyId),
    // The employee answers on the Page/Instagram inbox, and that channel is
    // waiting on Meta. The screen has to say so rather than offering an
    // auto-reply switch for a channel nothing can leave through — see the
    // feature registry's page_messaging entry.
    messagingConnection(member.companyId).catch(() => null),
  ]);

  return NextResponse.json({
    employee: publicEmployee(employee),
    roles: AI_EMPLOYEE_ROLES.map((key) => {
      const preset = roleFor(key);
      return {
        key,
        labelKey: preset.labelKey,
        blurbKey: preset.blurbKey,
        allowed: preset.allowed,
        forbidden: preset.forbidden,
      };
    }),
    tones: AI_EMPLOYEE_TONES,
    sourceKinds: SOURCE_KINDS,
    // Printed on the upload control, from the same list the server enforces —
    // so the screen can never advertise a format the server refuses.
    readableExtensions: READABLE_EXTENSIONS,
    ai: {
      configured: isAiConfigured(),
      allowed: quota.allowed,
      reason: quota.allowed ? null : quota.reason,
      remaining: quota.remaining,
      cap: quota.cap,
      nearLimit: quota.nearLimit,
    },
    // true | false | null. Null means the company has recorded no opening
    // hours, which is why the switch says what it would do rather than
    // implying a schedule nobody saved.
    businessHoursOpenNow: withinBusinessHours(company),
    hasBusinessHours: withinBusinessHours(company) !== null,
    channel: connection
      ? { connected: connection.connected, reason: connection.reason, mock: connection.mock }
      : { connected: false, reason: "not_connected", mock: false },
  });
}

const clean = (v, max) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

export async function PUT(request) {
  const { member, response } = await admin(request);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  await loadOrCreate(member.companyId);

  // Unknown role and tone values resolve to the closed preset and the first
  // tone rather than being written through. A settings screen is not the place
  // a role string gets invented, and roleFor() would silently fall back at
  // read time anyway — storing the fallback makes the row say what it does.
  const role = AI_EMPLOYEE_ROLES.includes(body.role) ? body.role : CLOSED_ROLE;
  const tone = AI_EMPLOYEE_TONES.includes(body.tone) ? body.tone : AI_EMPLOYEE_TONES[0];

  const cap = Number(body.maxRepliesPerThread);
  const data = {
    role,
    tone,
    name: clean(body.name, 60) || "Assistant",
    enabled: body.enabled === true,
    // ── Auto-send cannot be switched on by accident ────────────────────
    //
    // `=== true` rather than truthiness, and it is the same comparison
    // lib/aiEmployee/decide.js's sendMode makes at read time. Two independent
    // checks of the same rule, deliberately, for the same reason the
    // impersonation gate is enforced twice: this one is the only thing between
    // a JSON body and an agent that messages strangers unsupervised.
    autoReplyEnabled: body.autoReplyEnabled === true,
    greeting: clean(body.greeting, MAX_SHORT),
    instructions: clean(body.instructions, MAX_INSTRUCTIONS),
    escalationRules: clean(body.escalationRules, MAX_INSTRUCTIONS),
    handoffPhrase: clean(body.handoffPhrase, MAX_SHORT),
    businessHoursOnly: body.businessHoursOnly === true,
    // Clamped rather than rejected: 0 is a legitimate pause and 10 is already
    // more of one conversation than anybody wants an agent holding alone.
    maxRepliesPerThread: Number.isFinite(cap) ? Math.max(0, Math.min(10, Math.floor(cap))) : 3,
  };

  data.instructionsFingerprint = instructionsFingerprint(data);

  const saved = await db.aiEmployee.update({
    where: { companyId: member.companyId },
    data,
  });

  return NextResponse.json({ employee: publicEmployee(saved) });
}
