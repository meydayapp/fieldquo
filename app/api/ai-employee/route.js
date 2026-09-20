// app/api/ai-employee/route.js
//
// The AI employees' own configuration.
//
//   GET  → every employee the company has hired (a default receptionist is
//          created on first read so the screen is never empty), the role
//          presets, the tools' risk table, the faces, the company's AI
//          allowance and what a conversation costs on the model the employee
//          runs on, whether the Meta channel is connected, whether the SMS
//          channel CAN work (does FieldQuo hold a system number), and the
//          web-chat embed snippet.
//   POST → hire one: { role }. One per role — the schema's unique.
//   PUT  → save one: { id, ...fields }. A mode change and an on/off change
//          each write an audit row naming who did it and what it was before.
//
// Owner/admin only, the same rung as the AI credit plan and the phone
// receptionist: this decides what gets said to customers in the company's
// name — and now what gets BOOKED in it — and it spends the company's AI
// allowance to do it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { isAiConfigured, AI_BEST_MODEL } from "@/lib/ai/provider";
import { checkAiQuota, typicalConversationCostCents, pricingFor } from "@/lib/ai/usage";
import { messagingConnection } from "@/lib/messaging/channels";
import { systemSmsNumber } from "@/lib/sms/systemNumber";
import { recordActivity } from "@/lib/activity/log";
import { getAppOrigin } from "@/lib/appUrl";
import {
  AI_EMPLOYEE_ROLES,
  AI_EMPLOYEE_TONES,
  AI_EMPLOYEE_VOICES,
  CLOSED_ROLE,
  roleFor,
  instructionsFingerprint,
} from "@/lib/aiEmployee/roles";
import { TOOL_RISK } from "@/lib/aiEmployee/tools";
import { MODES, MODE_SENTENCE_KEY, FLOOR_LIST_KEYS, modeOf } from "@/lib/aiEmployee/permission";
import { CHANNELS, channelConflicts } from "@/lib/aiEmployee/employees";
import { FACES, defaultFaceFor } from "@/lib/aiEmployee/faces";
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
 * The rows, creating a default receptionist on first read.
 *
 * Lazily rather than at signup: a company that never opens this screen should
 * not carry a row for a feature they have not used. Created DISABLED in `ask`
 * — the schema's defaults, restated nowhere.
 */
async function loadOrCreate(companyId, { mayCreate = true } = {}) {
  const rows = await db.aiEmployee.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } });
  if (rows.length) return rows;
  // An impersonating support session must never write, and "read the screen"
  // would otherwise create a row for a company that never opened it. They get
  // the same defaults the create would have used, unsaved.
  if (!mayCreate) {
    return [
      {
        id: null, companyId, role: "receptionist", name: "Assistant", displayName: null, avatarUrl: null,
        voice: null, enabled: false, mode: "ask", metaEnabled: true, webChatEnabled: false, smsEnabled: false,
        tone: null, greeting: null, instructions: null, escalationRules: null, handoffPhrase: null,
        businessHoursOnly: false, maxRepliesPerThread: 3, updatedAt: null, createdAt: null,
      },
    ];
  }
  const created = await db.aiEmployee.create({
    data: { companyId, role: "receptionist", avatarUrl: defaultFaceFor("receptionist") },
  });
  return [created];
}

/** What crosses to the browser. Shaped rather than spread, so a column added
 *  later is a deliberate exposure. */
function publicEmployee(row) {
  return {
    id: row.id,
    role: row.role,
    name: row.name,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
    voice: row.voice,
    enabled: row.enabled,
    mode: modeOf(row),
    metaEnabled: row.metaEnabled !== false,
    webChatEnabled: row.webChatEnabled === true,
    smsEnabled: row.smsEnabled === true,
    tone: row.tone,
    greeting: row.greeting,
    instructions: row.instructions,
    escalationRules: row.escalationRules,
    handoffPhrase: row.handoffPhrase,
    businessHoursOnly: row.businessHoursOnly,
    maxRepliesPerThread: row.maxRepliesPerThread,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function GET(request) {
  const { member, response } = await admin(request, { allowSupportToLook: true });
  if (response) return response;

  const employees = await loadOrCreate(member.companyId, { mayCreate: !member.impersonation });

  const [company, quota, connection, smsNumber] = await Promise.all([
    db.company.findUnique({
      where: { id: member.companyId },
      select: { businessHours: true, timezone: true, slug: true, bookingSlug: true },
    }),
    checkAiQuota(member.companyId),
    // The Meta inbox is waiting on Meta. The screen says so rather than
    // offering a switch for a channel nothing can leave through.
    messagingConnection(member.companyId).catch(() => null),
    // The SMS channel needs a number FieldQuo holds. Null means the channel
    // is greyed out with one sentence — never a switch that fails.
    systemSmsNumber().catch(() => null),
  ]);

  const slug = String(company?.bookingSlug || company?.slug || "").trim();
  const origin = getAppOrigin(request);

  return NextResponse.json({
    employees: employees.map(publicEmployee),
    roles: AI_EMPLOYEE_ROLES.map((key) => {
      const preset = roleFor(key);
      return {
        key,
        labelKey: preset.labelKey,
        blurbKey: preset.blurbKey,
        allowed: preset.allowed,
        forbidden: preset.forbidden,
        defaultFace: defaultFaceFor(key),
      };
    }),
    toolRisk: TOOL_RISK,
    modes: MODES.map((key) => ({ key, sentenceKey: MODE_SENTENCE_KEY[key] })),
    floorKeys: FLOOR_LIST_KEYS,
    channels: CHANNELS,
    faces: FACES,
    tones: AI_EMPLOYEE_TONES,
    voices: AI_EMPLOYEE_VOICES,
    sourceKinds: SOURCE_KINDS,
    readableExtensions: READABLE_EXTENSIONS,
    ai: {
      configured: isAiConfigured(),
      allowed: quota.allowed,
      reason: quota.allowed ? null : quota.reason,
      remaining: quota.remaining,
      cap: quota.cap,
      usedTokens: quota.usage?.tokens ?? null,
      nearLimit: quota.nearLimit,
      // The model the employee runs on, and what a conversation typically
      // costs on it — an estimate, and labelled as one on the screen. Null
      // cost means the price table has no row, which the check refuses.
      model: AI_BEST_MODEL,
      tier: "best",
      typicalConversationCents: typicalConversationCostCents(AI_BEST_MODEL),
      pricing: pricingFor(AI_BEST_MODEL),
    },
    businessHoursOpenNow: withinBusinessHours(company),
    hasBusinessHours: withinBusinessHours(company) !== null,
    channel: connection
      ? { connected: connection.connected, reason: connection.reason, mock: connection.mock }
      : { connected: false, reason: "not_connected", mock: false },
    sms: { available: Boolean(smsNumber), number: smsNumber || null },
    webChat: {
      slug: slug || null,
      // The snippet is an iframe of the embed page, positioned by the page
      // itself. No script, no cross-origin call: the widget talks to FieldQuo
      // from inside FieldQuo's own frame.
      snippet: slug
        ? `<iframe src="${origin}/embed/${encodeURIComponent(slug)}/chat" title="Chat" style="position:fixed;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 32px);border:0;z-index:2147483000;background:transparent" allow="clipboard-write"></iframe>`
        : null,
      embedUrl: slug ? `${origin}/embed/${encodeURIComponent(slug)}/chat` : null,
    },
  });
}

const clean = (v, max) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s.slice(0, max) : null;
};

/** A face is one of ours, or an https URL an upload produced. Never a data
 *  URI, never a foreign scheme. */
function cleanAvatar(v) {
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) return null;
  if (FACES.some((f) => f.url === s)) return s;
  return /^https:\/\/[^\s"'<>]{1,500}$/.test(s) ? s : null;
}

export async function POST(request) {
  const { member, response } = await admin(request);
  if (response) return response;
  const body = await request.json().catch(() => ({}));
  const role = AI_EMPLOYEE_ROLES.includes(body.role) ? body.role : null;
  if (!role) return NextResponse.json({ error: "Pick a role." }, { status: 400 });

  const existing = await db.aiEmployee.findFirst({ where: { companyId: member.companyId, role } });
  if (existing) {
    return NextResponse.json({ error: "You already have an employee in that role.", reason: "role_taken" }, { status: 409 });
  }
  const created = await db.aiEmployee.create({
    data: {
      companyId: member.companyId,
      role,
      avatarUrl: defaultFaceFor(role),
      // A second hire must not silently claim the Meta inbox from the first.
      metaEnabled: false,
    },
  });
  await recordActivity(member, {
    action: "ai_employee.hired",
    entityType: "settings",
    entityId: created.id,
    summary: `Hired an AI ${role}`,
    summaryKey: "app.activity.event.aiEmployee.hired",
    summaryParams: { role },
  });
  return NextResponse.json({ employee: publicEmployee(created) }, { status: 201 });
}

export async function PUT(request) {
  const { member, response } = await admin(request);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const rows = await loadOrCreate(member.companyId);

  // The row being saved — by id, under companyId. An id from another company
  // is not in `rows`, and "not found" is the answer.
  const current = body.id ? rows.find((r) => r.id === body.id) : rows[0];
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Unknown role and tone values resolve to the closed preset and the first
  // tone rather than being written through. The role may not move onto one
  // another employee already holds.
  const role = AI_EMPLOYEE_ROLES.includes(body.role) ? body.role : CLOSED_ROLE;
  if (role !== current.role && rows.some((r) => r.id !== current.id && r.role === role)) {
    return NextResponse.json({ error: "You already have an employee in that role.", reason: "role_taken" }, { status: 409 });
  }
  const tone = AI_EMPLOYEE_TONES.includes(body.tone) ? body.tone : AI_EMPLOYEE_TONES[0];
  const voice = AI_EMPLOYEE_VOICES.includes(body.voice) ? body.voice : null;
  const mode = MODES.includes(body.mode) ? body.mode : modeOf(current);

  const cap = Number(body.maxRepliesPerThread);
  const data = {
    role,
    tone,
    voice,
    name: clean(body.name, 60) || "Assistant",
    displayName: clean(body.displayName, 60),
    avatarUrl: cleanAvatar(body.avatarUrl),
    enabled: body.enabled === true,
    // ── The mode cannot move by accident ─────────────────────────────────
    //
    // Only a value from the closed list is written; anything else keeps the
    // current mode. lib/aiEmployee/permission.js reads it the same way at
    // reply time. Two independent checks of the same rule, deliberately.
    mode,
    // Mirrored for any reader of the old column. Nothing reads it.
    autoReplyEnabled: mode === "auto",
    metaEnabled: body.metaEnabled !== false,
    webChatEnabled: body.webChatEnabled === true,
    smsEnabled: body.smsEnabled === true,
    greeting: clean(body.greeting, MAX_SHORT),
    instructions: clean(body.instructions, MAX_INSTRUCTIONS),
    escalationRules: clean(body.escalationRules, MAX_INSTRUCTIONS),
    handoffPhrase: clean(body.handoffPhrase, MAX_SHORT),
    businessHoursOnly: body.businessHoursOnly === true,
    // Clamped rather than rejected: 0 is a legitimate pause and 10 is already
    // more of one conversation than anybody wants an agent holding alone.
    maxRepliesPerThread: Number.isFinite(cap) ? Math.max(0, Math.min(10, Math.floor(cap))) : 3,
  };

  // ── SMS needs a number FieldQuo holds ───────────────────────────────────
  if (data.smsEnabled && !(await systemSmsNumber().catch(() => null))) {
    return NextResponse.json(
      { error: "FieldQuo has no SMS number yet, so the text channel can't be switched on.", reason: "no_system_number" },
      { status: 409 },
    );
  }

  // ── One employee per channel ────────────────────────────────────────────
  const conflicts = channelConflicts(rows, { ...data, id: current.id });
  if (conflicts.length) {
    return NextResponse.json(
      {
        error: "Another employee already answers that channel. Switch it off there first.",
        reason: "channel_conflict",
        channels: conflicts,
      },
      { status: 409 },
    );
  }

  data.instructionsFingerprint = instructionsFingerprint(data);

  const saved = await db.aiEmployee.update({ where: { id: current.id }, data });

  // ── The audit rows: who changed the mode, who switched it on ────────────
  const before = modeOf(current);
  if (before !== mode) {
    await recordActivity(member, {
      action: "ai_employee.mode_changed",
      entityType: "settings",
      entityId: saved.id,
      summary: `AI employee mode changed: ${before} → ${mode} (${saved.role})`,
      summaryKey: "app.activity.event.aiEmployee.modeChanged",
      summaryParams: { from: before, to: mode, role: saved.role },
    });
  }
  if (current.enabled !== saved.enabled) {
    await recordActivity(member, {
      action: saved.enabled ? "ai_employee.enabled" : "ai_employee.disabled",
      entityType: "settings",
      entityId: saved.id,
      summary: saved.enabled ? `Switched the AI ${saved.role} on` : `Switched the AI ${saved.role} off`,
      summaryKey: saved.enabled ? "app.activity.event.aiEmployee.enabled" : "app.activity.event.aiEmployee.disabled",
      summaryParams: { role: saved.role },
    });
  }

  return NextResponse.json({ employee: publicEmployee(saved) });
}

/**
 * DELETE → fire one: { id }. The row and everything hanging off it —
 * proposals, replies — go with it (both relations cascade), the channels it
 * held fall back to the human inbox the moment the row is gone, and an
 * activity row says who fired whom. The last employee may be fired too: GET
 * recreates a switched-off receptionist on the next read, which is the same
 * empty state a company that never opened the page sees. The owner, 2026-09-20:
 * "I should be able to fire / delete them."
 */
export async function DELETE(request) {
  const { member, response } = await admin(request);
  if (response) return response;

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  if (!id) return NextResponse.json({ error: "Say which employee." }, { status: 400 });

  // Under companyId — an id from another company is "not found", never a
  // delete somewhere else.
  const current = await db.aiEmployee.findFirst({ where: { id, companyId: member.companyId } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.aiEmployee.delete({ where: { id: current.id } });
  await recordActivity(member, {
    action: "ai_employee.fired",
    entityType: "settings",
    entityId: current.id,
    summary: `Fired the AI ${current.role}${current.displayName ? ` (${current.displayName})` : ""}`,
    summaryKey: "app.activity.event.aiEmployee.fired",
    summaryParams: { role: current.role },
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: current.id });
}
