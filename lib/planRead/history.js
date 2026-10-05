// lib/planRead/history.js
//
// One history per drawing read. The chat's turns were always kept
// (PlanReadMessage, role "user" / "assistant", with what each one changed);
// the estimator's own edits — a measurement traced on a sheet, a price typed
// for a lift, a surface left out, a photo grouping split, the project renamed
// — were applied and forgotten: PATCH /api/plan-reads/[id] returned its list
// of changes to the browser and stored none of it. A read whose quantities a
// person had corrected could not say who corrected them, or when.
//
// They are now rows in the same table with role "edit": who (userId), when
// (createdAt), and what (changes, the same server-written sentences the chat
// stores). The same table on purpose — one ordered list is the timeline, and
// a second table would need a merge on every read of it.
//
// ══ What an edit row must never do ═════════════════════════════════════════
//
// Reach the model. The chat sends the last few turns as conversation history
// (lib/planRead/chat.js HISTORY_TURNS); an edit is not something either side
// SAID, and the model already sees its effect in the project model it is
// given. chatHistory() is the one filter, used by the messages route.

export const EDIT_ROLE = "edit";
const CHAT_ROLES = new Set(["user", "assistant"]);
const MAX_CHANGES = 40;

/** The PlanReadMessage row for one PATCH, or null when nothing changed. Pure. */
export function editLogEntry({ changes, companyId, planReadId, userId = null }) {
  const list = (Array.isArray(changes) ? changes : [])
    .map((c) => String(c || "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_CHANGES);
  if (!list.length || !companyId || !planReadId) return null;
  return {
    companyId,
    planReadId,
    role: EDIT_ROLE,
    // `text` is required on the row; the sentences ARE the text. The screen
    // renders `changes`, so the joined form is only for anything reading the
    // table directly.
    text: list.join(" · ").slice(0, 2000),
    changes: list,
    userId,
  };
}

/** The turns the chat model may see as conversation — never an edit row. Pure. */
export function chatHistory(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => CHAT_ROLES.has(m?.role))
    .map((m) => ({ role: m.role, text: m.text }));
}

/**
 * Names for the people in a read's history, from THIS company's members only
 * — a userId that is not a member of the company (a removed employee keeps
 * their rows) is shown without a name rather than looked up globally.
 *
 * @returns {Promise<Record<string, string>>} userId → display name
 */
export async function withAuthors(messages, { prisma, companyId }) {
  const ids = [...new Set((messages || []).map((m) => m?.userId).filter(Boolean))];
  if (!ids.length || !companyId) return {};
  const rows = await prisma.member.findMany({
    where: { companyId, userId: { in: ids } },
    select: { userId: true, user: { select: { name: true, email: true } } },
  });
  return Object.fromEntries(rows.map((r) => [r.userId, r.user?.name || r.user?.email || null]).filter(([, n]) => n));
}
