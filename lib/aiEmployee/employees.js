// lib/aiEmployee/employees.js
//
// Which of a company's employees answers this channel?
//
// ══ One row per role, one employee per channel ═════════════════════════════
//
// A company can hire more than one (prisma: AiEmployee is unique on
// (companyId, role)), each with its own on/off switch and its own three
// channel switches. The routing rule is deliberately dull: the ENABLED
// employee whose switch for this channel is on, oldest first. The settings
// route refuses a save that would put two employees on the same channel, so
// "oldest first" is a tie-break the data should never need — it exists so a
// disagreement in the rows produces one answer rather than two replies.
//
// ══ Off means off ══════════════════════════════════════════════════════════
//
// An employee with `enabled: false` is invisible here: no channel routes to
// it, no proposal is created for it, nothing is metered against it. The
// channel then behaves as it did before the employee existed — the message
// lands in the human inbox, and the web widget and SMS say a person will
// reply. That sentence is the switch's consequence and the settings screen
// prints it.

import { db } from "@/lib/db";

/** The three channels an employee can answer on. Closed. */
export const CHANNELS = Object.freeze(["meta", "web", "sms"]);

/** The AiEmployee column that switches each channel. */
export const CHANNEL_FLAG = Object.freeze({
  meta: "metaEnabled",
  web: "webChatEnabled",
  sms: "smsEnabled",
});

export function isChannel(value) {
  return CHANNELS.includes(value);
}

/**
 * The pure rule. Exported so the check can drive it without a database.
 *
 * @param rows     AiEmployee rows of ONE company (the caller scoped the read)
 * @param channel  one of CHANNELS
 * @returns the row, or null
 */
export function pickEmployee(rows, channel) {
  const flag = CHANNEL_FLAG[channel];
  if (!flag) return null;
  return (
    (rows || [])
      .filter((r) => r && r.enabled === true && r[flag] === true)
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))[0] || null
  );
}

/**
 * The employee that answers this channel for this company, or null.
 *
 * Read under companyId — always. There is no variant of this function that
 * takes a channel and finds the company; the caller has already resolved the
 * tenant (from a channel row, a booking slug, or a phone held by exactly one
 * company) and this only ever narrows within it.
 */
export async function employeeForChannel(companyId, channel, prisma = db) {
  if (!companyId || !isChannel(channel)) return null;
  const rows = await prisma.aiEmployee.findMany({
    where: { companyId, enabled: true },
    orderBy: { createdAt: "asc" },
  });
  return pickEmployee(rows, channel);
}

/**
 * Which channels two employees would both claim, if this save went through.
 * Pure; the settings route refuses on a non-empty answer.
 *
 * @param rows      the company's OTHER employees
 * @param candidate the row being saved (enabled + flags)
 */
export function channelConflicts(rows, candidate) {
  if (!candidate || candidate.enabled !== true) return [];
  return CHANNELS.filter((c) => {
    const flag = CHANNEL_FLAG[c];
    if (candidate[flag] !== true) return false;
    return (rows || []).some(
      (r) => r && r.id !== candidate.id && r.enabled === true && r[flag] === true,
    );
  });
}
