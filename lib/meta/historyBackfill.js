// lib/meta/historyBackfill.js
//
// Facebook and Instagram HISTORY: every lead-form submission Meta still holds,
// and every Messenger / Instagram conversation the Conversations API returns —
// walked backwards, in chunks, resumably, without waking anybody up.
//
// ══ What the owner saw (2026-10-03) ════════════════════════════════════════
//
// "The leads doesn't seem to fetch all the leads from Facebook, only the new
//  ones that were created during the test… same thing for the messages in FB
//  and Instagram, only new conversations not older ones."
//
// Both were true, for three separate reasons, each fixed where it lives:
//
//   1. LEAD FORMS. The cron (lib/meta/leadsFetch.js's pollForm) read ONE page
//      of a form's leads and moved its cursor to the newest — so anything past
//      the first hundred in the first window was skipped for good, and a form
//      switched on after its leads came in only ever saw what arrived next.
//      Here: page through /<form>/leads for the ninety days Meta keeps,
//      every page, idempotent on the leadgen id.
//   2. CONVERSATIONS. lib/messaging/pageImport.js pulls conversations updated
//      since the company SIGNED UP (capped at thirty days) — the owner's own
//      earlier decision, so a new contractor's inbox did not fill with last
//      year's threads — and only each one's newest fifty messages. Here: as
//      far back as the API returns, every page, with each conversation's
//      older messages paged too (GET /<conversation>/messages).
//   3. ATTACHMENTS. See lib/meta/client.js's ATTACHMENT_SUBFIELDS and
//      lib/messaging/mediaFetch.js's maxBytesFor.
//
// The two earlier decisions are kept, not overruled: history older than the
// inbox's floor is stored and readable but arrives RESOLVED, with no unread
// badge and no waiting clock (lib/messaging/ingest.js's `history`), so the
// inbox a contractor works from still starts where it did.
//
// ══ History wakes nobody ═══════════════════════════════════════════════════
//
//   - Every message is stamped `imported` — the ingest keeps the AI employee
//     (and so the Closer), the staff push and live lead capture off it.
//   - A lead made from history is stamped importedAt and createScoredLead
//     sends no "new lead" alert for it. History is "older than a day"
//     (HISTORY_SILENT_AFTER_MS): a form somebody filled in this morning that
//     nobody has rung is NOT history, and is announced like any other.
//   - Each conversation is reviewed ONCE, when its history is in
//     (captureLeadFromConversation with imported: true) — not once per
//     message. The model reads only conversations whose customer last wrote
//     within HISTORY_AI_DAYS, at most HISTORY_AI_PER_RUN per run, metered to
//     the company's AI credit like every other read; older ones get the free,
//     records-only review. See the cost note in docs/ROADMAP.md.
//
// ══ Resumable, rate-limited, idempotent ════════════════════════════════════
//
// One MetaHistoryBackfill row per channel / per form holds Meta's `after`
// cursor between chunks. A chunk stops at a page budget or a wall-clock
// deadline and saves the cursor; the next cron tick (or "Fetch older") picks
// up there. A rate-limit answer parks the row until Meta's retry-after. A
// lease (the row's lastRunAt while status is "running") stops two runners
// walking one row at once. And none of that is what prevents duplicates:
// every write underneath is keyed on Meta's own message id or leadgen id, so
// a re-run, an overlap with the webhook or a second press writes nothing new.
import { db } from "@/lib/db";
import {
  listPageConversations,
  listConversationMessages,
  listFormLeads,
  nextConversationCursor,
  isTooMuchDataError,
  isUnknownFieldError,
} from "./client";
import { getPageConnection } from "./pageConnection";
import { resolveLeadsCredential, resolveAttribution, classifyLeadsFailure } from "./leadsFetch";
import { importMetaLead } from "./leadsImport";
import { listChannels, decryptedChannelToken, recordChannelError } from "@/lib/messaging/channels";
import {
  pageImportState,
  defaultImportSince,
  graphConversationToEvents,
  graphTime,
  PAGE_SHAPES,
} from "@/lib/messaging/pageImport";
import { ingestEvent } from "@/lib/messaging/ingest";
import { captureLeadFromConversation, HISTORY_SILENT_AFTER_MS } from "@/lib/leads/conversationLead";

/** Meta keeps lead-form submissions for ninety days; asking further is asking for nothing. */
export const LEAD_HISTORY_DAYS = 90;
/** Older messages fetched per conversation, at most — a two-year thread's opening is in here. */
export const MAX_MESSAGES_PER_CONVERSATION = 500;
/** Graph pages per row per chunk. */
export const PAGES_PER_CHUNK = 20;
/** The model reads history only this recent (customer's last message). */
export const HISTORY_AI_DAYS = 90;
/** …and at most this many conversations per run. */
export const HISTORY_AI_PER_RUN = 25;
/** A "running" row whose runner went quiet this long ago may be taken over. */
export const LEASE_MS = 3 * 60 * 1000;
/** Consecutive unexplained failures before a row stops retrying on its own. */
export const MAX_CONSECUTIVE_ERRORS = 3;

export const BACKFILL_KINDS = Object.freeze(["messenger", "instagram", "lead_form"]);
export const KIND_FOR_PLATFORM = Object.freeze({ facebook: "messenger", instagram: "instagram" });
const DAY = 24 * 60 * 60 * 1000;

const emptyCounts = () => ({
  conversations: 0,
  messages: 0,
  created: 0,
  attachments: 0,
  leads: 0,
  linked: 0,
  duplicates: 0,
  skipped: 0,
  truncated: 0,
  reviewed: 0,
  errors: 0,
  consecutiveErrors: 0,
});

const counts = (row) => ({ ...emptyCounts(), ...(row?.counts && typeof row.counts === "object" ? row.counts : {}) });

/**
 * A row's next state after Meta refused a page. Pure.
 *
 * rate_limited  parked until Meta's retry-after (default five minutes).
 * auth_error    stops: a dead token is fixed by reconnecting, not retrying.
 * leads_access  stops for the same reason (Leads Access Manager).
 * anything else retried by the next run, until MAX_CONSECUTIVE_ERRORS in a
 *               row, then stops with the reason on the card.
 */
export function stateAfterRefusal(row, res, now = new Date()) {
  const c = counts(row);
  const kind = res?.kind || "unknown_error";
  const message = String(res?.message || kind).slice(0, 300);
  if (kind === "rate_limited") {
    const secs = Number.isFinite(Number(res?.retryAfterSeconds)) && Number(res.retryAfterSeconds) > 0 ? Number(res.retryAfterSeconds) : 300;
    return { status: "rate_limited", retryAfter: new Date(now.getTime() + secs * 1000), lastErrorKind: kind, lastError: message, counts: c };
  }
  if (kind === "auth_error" || kind === "leads_access" || kind === "not_found") {
    return { status: "error", retryAfter: null, lastErrorKind: kind, lastError: message, counts: { ...c, errors: c.errors + 1 } };
  }
  const consecutive = c.consecutiveErrors + 1;
  return {
    status: consecutive >= MAX_CONSECUTIVE_ERRORS ? "error" : "queued",
    retryAfter: null,
    lastErrorKind: kind,
    lastError: message,
    counts: { ...c, errors: c.errors + 1, consecutiveErrors: consecutive },
  };
}

/** Is this row free to run now? Pure. */
export function rowRunnable(row, now = new Date()) {
  if (!row) return false;
  if (row.status === "done" || row.status === "error") return false;
  if (row.status === "rate_limited") return !row.retryAfter || new Date(row.retryAfter) <= now;
  if (row.status === "running") return !row.lastRunAt || now.getTime() - new Date(row.lastRunAt).getTime() > LEASE_MS;
  return row.status === "queued";
}

/** The older-than-a-day line a backfilled lead is silent behind. Pure. */
export function isHistoryLead(createdTime, now = new Date()) {
  const t = graphTime(createdTime);
  return t !== null && now.getTime() - t.getTime() > HISTORY_SILENT_AFTER_MS;
}

/**
 * Take the row for this run — one UPDATE that only succeeds when nobody else
 * holds it, so two cron ticks (or a tick and a button) never walk one row.
 */
async function claim(row, now) {
  const stale = new Date(now.getTime() - LEASE_MS);
  const res = await db.metaHistoryBackfill.updateMany({
    where: {
      id: row.id,
      OR: [
        { status: { in: ["queued", "rate_limited"] } },
        { status: "running", lastRunAt: { lt: stale } },
        { status: "running", lastRunAt: null },
      ],
    },
    data: { status: "running", lastRunAt: now },
  });
  return Boolean(res?.count);
}

async function save(row, data) {
  return db.metaHistoryBackfill.update({ where: { id: row.id }, data });
}

/**
 * Create (or restart) the rows for a company. "Fetch older" passes
 * restart: true, which sends a finished or stopped walk back to the top —
 * re-walking is free of duplicates, and Meta may now return what it would not.
 *
 * @param scope "messages" | "leads" | "all"
 */
export async function ensureBackfills({ companyId, scope = "all", requestedById = null, restart = false, now = new Date() }) {
  const company = await db.company.findUnique({ where: { id: companyId }, select: { isDemo: true } }).catch(() => null);
  if (!company || company.isDemo) return { kind: company?.isDemo ? "demo" : "not_connected", rows: [] };

  const wanted = [];
  if (scope === "messages" || scope === "all") {
    const state = await pageImportState(companyId);
    if (state.available) {
      const channels = (await listChannels(companyId)).filter((c) => state.platforms.includes(c.platform));
      for (const c of channels) wanted.push({ kind: KIND_FOR_PLATFORM[c.platform], scopeId: c.id, floorAt: null });
    }
  }
  if (scope === "leads" || scope === "all") {
    const forms = await db.metaLeadForm.findMany({ where: { companyId, active: true }, select: { id: true } });
    for (const f of forms) wanted.push({ kind: "lead_form", scopeId: f.id, floorAt: new Date(now.getTime() - LEAD_HISTORY_DAYS * DAY) });
  }
  if (!wanted.length) return { kind: "nothing_to_fetch", rows: [] };

  const rows = [];
  for (const w of wanted) {
    const existing = await db.metaHistoryBackfill.findFirst({ where: { companyId, kind: w.kind, scopeId: w.scopeId } });
    if (!existing) {
      rows.push(
        await db.metaHistoryBackfill.create({
          data: { companyId, kind: w.kind, scopeId: w.scopeId, status: "queued", floorAt: w.floorAt, counts: emptyCounts(), requestedById, startedAt: now },
        }),
      );
      continue;
    }
    // A walk in progress is left exactly where it is: a second press must
    // not throw its cursor away.
    const inProgress = existing.status === "running" || existing.status === "queued" || existing.status === "rate_limited";
    if (restart && !inProgress) {
      rows.push(
        await save(existing, {
          status: "queued",
          cursor: null,
          floorAt: w.floorAt,
          counts: emptyCounts(),
          lastErrorKind: null,
          lastError: null,
          retryAfter: null,
          finishedAt: null,
          requestedById,
          startedAt: now,
        }),
      );
    } else {
      rows.push(existing);
    }
  }
  return { kind: "ok", rows };
}

/**
 * One chunk of one conversation walk.
 *
 * @param deps  { fetchConversations, fetchMessages, ingest, capture } — the
 *              Graph calls, the ingest and the lead review, injectable so the
 *              check can run the whole walk against an in-memory Graph.
 */
export async function runConversationChunk({ row, now = new Date(), deadline = Date.now() + 45000, aiBudget = { left: HISTORY_AI_PER_RUN }, deps = {} }) {
  const {
    fetchConversations = listPageConversations,
    fetchMessages = listConversationMessages,
    ingest = ingestEvent,
    capture = captureLeadFromConversation,
  } = deps;
  const companyId = row.companyId;
  const channel = await db.messagingChannel.findFirst({ where: { id: row.scopeId, companyId } });
  const connection = await getPageConnection(companyId);
  if (!channel || channel.disconnectedAt || !connection) {
    return save(row, { status: "error", lastErrorKind: "not_connected", lastError: "The Page or account is no longer connected.", finishedAt: now });
  }
  let pageToken = null;
  try {
    pageToken = decryptedChannelToken(channel);
  } catch {
    pageToken = null;
  }
  if (!pageToken) return save(row, { status: "error", lastErrorKind: "auth_error", lastError: "The stored Page token can't be read.", finishedAt: now });

  const historyBefore = await defaultImportSince({ companyId, now });
  const businessIds = new Set([connection.pageId, connection.instagramUserId].filter(Boolean));
  const c = counts(row);
  let cursor = row.cursor || null;
  let oldest = row.oldestSeenAt ? new Date(row.oldestSeenAt) : null;
  let shape = 0;
  let bare = false;
  let pages = 0;

  while (pages < PAGES_PER_CHUNK && Date.now() < deadline) {
    const res = await fetchConversations({
      pageAccessToken: pageToken,
      pageId: connection.pageId,
      platform: channel.platform,
      after: cursor,
      limit: PAGE_SHAPES[shape].limit,
      messagesLimit: PAGE_SHAPES[shape].messagesLimit,
      bareAttachments: bare,
    });
    if (isUnknownFieldError(res) && !bare) { bare = true; continue; }
    if (isTooMuchDataError(res) && shape + 1 < PAGE_SHAPES.length) { shape += 1; continue; }
    if (!res?.ok) {
      if (res?.kind === "auth_error") {
        await recordChannelError({ channelId: channel.id, status: "needs_reauth", error: `history: ${res.message || "auth_error"}` }).catch(() => null);
      }
      return save(row, { ...stateAfterRefusal({ ...row, counts: c }, res, now), cursor, oldestSeenAt: oldest, lastRunAt: now });
    }
    pages += 1;
    c.consecutiveErrors = 0;

    for (const conversation of Array.isArray(res.data?.data) ? res.data.data : []) {
      // The nested page is the newest messages; older ones are paged here.
      const older = [];
      let after = nextConversationCursor(conversation?.messages);
      let nested = Array.isArray(conversation?.messages?.data) ? conversation.messages.data.length : 0;
      while (after && nested + older.length < MAX_MESSAGES_PER_CONVERSATION && Date.now() < deadline) {
        const page = await fetchMessages({ pageAccessToken: pageToken, conversationId: conversation.id, after, bareAttachments: bare });
        if (!page?.ok) {
          // Meta stopped handing over older messages for this conversation
          // (or refused). What came is kept; the gap is counted, not hidden.
          c.truncated += 1;
          if (page?.kind === "rate_limited") {
            return save(row, { ...stateAfterRefusal({ ...row, counts: c }, page, now), cursor, oldestSeenAt: oldest, lastRunAt: now });
          }
          break;
        }
        older.push(...(Array.isArray(page.data?.data) ? page.data.data : []));
        after = nextConversationCursor(page.data);
      }
      if (after && nested + older.length >= MAX_MESSAGES_PER_CONVERSATION) c.truncated += 1;

      const { events, skipped } = graphConversationToEvents({
        platform: channel.platform,
        pageExternalId: channel.externalId,
        businessIds,
        conversation,
        olderMessages: older,
        historyBefore,
      });
      c.skipped += skipped;
      if (!events.length) continue;
      c.conversations += 1;

      let threadId = null;
      for (const event of events) {
        c.messages += 1;
        if (Array.isArray(event.attachments)) c.attachments += event.attachments.length;
        if (event.sentAt && (!oldest || event.sentAt < oldest)) oldest = event.sentAt;
        const out = await ingest(event).catch((err) => ({ handled: false, reason: `error:${err?.message || "unknown"}` }));
        if (out?.handled) {
          threadId = out.threadId || threadId;
          if (out.created) c.created += 1;
        } else {
          c.skipped += 1;
          if (String(out?.reason || "").startsWith("error:")) c.errors += 1;
        }
      }

      // ONE review per conversation, now that its history is in. Silent;
      // the model only for a recent one, and only while the run's budget lasts.
      const lastInbound = [...events].reverse().find((e) => e.direction === "in");
      if (threadId && lastInbound) {
        const recent = lastInbound.sentAt && now.getTime() - lastInbound.sentAt.getTime() <= HISTORY_AI_DAYS * DAY;
        const allowAi = Boolean(recent && aiBudget.left > 0);
        const r = await Promise.resolve(capture({ companyId, threadId, imported: true, allowAi, now })).catch(() => null);
        if (r?.aiRan) aiBudget.left -= 1;
        if (r) c.reviewed += 1;
        if (r?.created) c.leads += 1;
      }
    }

    cursor = nextConversationCursor(res.data);
    await save(row, { cursor, counts: c, oldestSeenAt: oldest, lastRunAt: new Date() });
    if (!cursor) {
      return save(row, { status: "done", cursor: null, counts: c, oldestSeenAt: oldest, finishedAt: now, lastErrorKind: null, lastError: null, retryAfter: null });
    }
  }
  // Out of pages or time for this chunk — the cursor is saved; queued for the next.
  return save(row, { status: "queued", cursor, counts: c, oldestSeenAt: oldest, lastRunAt: new Date() });
}

/**
 * One chunk of one lead-form walk: ninety days of /<form>/leads, every page.
 */
export async function runLeadFormChunk({ row, now = new Date(), deadline = Date.now() + 45000, deps = {} }) {
  const { fetchLeads = listFormLeads, importLead = importMetaLead, attribute = resolveAttribution, credentialFor = resolveLeadsCredential } = deps;
  const companyId = row.companyId;
  const form = await db.metaLeadForm.findFirst({ where: { id: row.scopeId, companyId } });
  if (!form) return save(row, { status: "error", lastErrorKind: "not_found", lastError: "That lead form is no longer known.", finishedAt: now });
  const credential = await credentialFor(companyId);
  if (!credential?.ok) {
    return save(row, { status: "error", lastErrorKind: credential?.reason || "no_page_connection", lastError: credential?.reason || "no_page_connection", finishedAt: now });
  }
  if (String(form.pageId) !== String(credential.pageId)) {
    return save(row, { status: "error", lastErrorKind: "page_mismatch", lastError: `Form is on page ${form.pageId}; the connected Page is ${credential.pageId}.`, finishedAt: now });
  }

  const floor = row.floorAt ? new Date(row.floorAt) : new Date(now.getTime() - LEAD_HISTORY_DAYS * DAY);
  const c = counts(row);
  let cursor = row.cursor || null;
  let oldest = row.oldestSeenAt ? new Date(row.oldestSeenAt) : null;
  let newest = null;
  let pages = 0;

  while (pages < PAGES_PER_CHUNK && Date.now() < deadline) {
    const res = classifyLeadsFailure(
      await fetchLeads({ pageAccessToken: credential.pageToken, formId: form.formId, sinceUnixSeconds: Math.floor(floor.getTime() / 1000), after: cursor, limit: 100 }),
    );
    if (!res?.ok) return save(row, { ...stateAfterRefusal({ ...row, counts: c }, res, now), cursor, oldestSeenAt: oldest, lastRunAt: now });
    pages += 1;
    c.consecutiveErrors = 0;

    for (const lead of Array.isArray(res.data?.data) ? res.data.data : []) {
      const t = graphTime(lead?.created_time);
      if (t && (!oldest || t < oldest)) oldest = t;
      if (t && (!newest || t > newest)) newest = t;
      const attribution = await Promise.resolve(attribute({ accessToken: credential.attributionToken, adId: lead?.ad_id })).catch(() => null);
      let result;
      try {
        result = await importLead({
          companyId,
          lead,
          formId: lead?.form_id || form.formId,
          attribution,
          path: "backfill",
          // Silent only when it is genuinely history — see isHistoryLead.
          importedAt: isHistoryLead(lead?.created_time, now) ? now : null,
        });
      } catch (err) {
        c.errors += 1;
        continue;
      }
      if (result?.status === "created") { c.leads += 1; c.created += 1; }
      else if (result?.status === "linked") c.linked += 1;
      else if (result?.status === "duplicate") c.duplicates += 1;
      else c.skipped += 1;
    }

    cursor = nextConversationCursor(res.data);
    await save(row, { cursor, counts: c, oldestSeenAt: oldest, lastRunAt: new Date() });
    if (!cursor) {
      // Done: the live poll continues from the newest lead seen, so it never
      // re-reads history (and never announces it).
      if (newest && (!form.cursorLeadCreatedAt || newest > new Date(form.cursorLeadCreatedAt))) {
        await db.metaLeadForm.update({ where: { id: form.id }, data: { cursorLeadCreatedAt: newest } }).catch(() => null);
      }
      return save(row, { status: "done", cursor: null, counts: c, oldestSeenAt: oldest, finishedAt: now, lastErrorKind: null, lastError: null, retryAfter: null });
    }
  }
  return save(row, { status: "queued", cursor, counts: c, oldestSeenAt: oldest, lastRunAt: new Date() });
}

/**
 * Run whatever is runnable, oldest-touched first, until the deadline. The
 * cron's entry point and the button's ("Fetch older" runs one chunk for its
 * own company right away, the cron finishes the rest).
 */
export async function continueBackfills({ companyId = null, kinds = BACKFILL_KINDS, now = new Date(), budgetMs = 45000, maxRows = 10, deps = {} } = {}) {
  const deadline = Date.now() + budgetMs;
  const rows = await db.metaHistoryBackfill.findMany({
    where: { ...(companyId ? { companyId } : {}), kind: { in: [...kinds] }, status: { in: ["queued", "running", "rate_limited"] } },
    orderBy: { lastRunAt: "asc" },
    take: 50,
  });
  const ran = [];
  const aiBudget = { left: HISTORY_AI_PER_RUN };
  for (const row of rows) {
    if (ran.length >= maxRows || Date.now() >= deadline) break;
    if (!rowRunnable(row, now)) continue;
    if (!(await claim(row, now))) continue;
    const before = counts(row);
    try {
      const out =
        row.kind === "lead_form"
          ? await runLeadFormChunk({ row, now, deadline, deps })
          : await runConversationChunk({ row, now, deadline, aiBudget, deps });
      // What THIS chunk did — the cron's own summary adds it to its totals,
      // so "created 3" in the cron log counts history leads too.
      const after = counts(out);
      const delta = Object.fromEntries(Object.keys(after).map((k) => [k, (Number(after[k]) || 0) - (Number(before[k]) || 0)]));
      ran.push({
        id: row.id,
        companyId: row.companyId,
        kind: row.kind,
        status: out?.status || null,
        lastErrorKind: out?.lastErrorKind || null,
        delta,
      });
    } catch (err) {
      // A throw is FieldQuo's own failure (network, database). Counted like a
      // Meta refusal so a row cannot spin forever on it.
      const next = stateAfterRefusal(row, { kind: "unknown_error", message: err?.message || "threw" }, now);
      await save(row, { ...next, lastRunAt: now }).catch(() => null);
      ran.push({ id: row.id, companyId: row.companyId, kind: row.kind, status: next.status, error: err?.message || "threw" });
    }
  }
  return ran;
}

/**
 * What the settings cards draw: one line per channel and per form. A read.
 *
 * @returns {{ messages: Array<{ platform, status, counts, oldestSeenAt,
 *             lastRunAt, finishedAt, lastErrorKind, retryAfter }>,
 *             leads: Array<{ formId, name, ...same }> }}
 */
export async function backfillState(companyId) {
  const rows = await db.metaHistoryBackfill.findMany({ where: { companyId } }).catch(() => []);
  const channels = await db.messagingChannel.findMany({ where: { companyId }, select: { id: true, platform: true } }).catch(() => []);
  const forms = await db.metaLeadForm.findMany({ where: { companyId }, select: { id: true, formId: true, name: true } }).catch(() => []);
  const shape = (r) => ({
    status: r.status,
    counts: counts(r),
    oldestSeenAt: r.oldestSeenAt || null,
    lastRunAt: r.lastRunAt || null,
    finishedAt: r.finishedAt || null,
    startedAt: r.startedAt || null,
    lastErrorKind: r.lastErrorKind || null,
    retryAfter: r.retryAfter || null,
  });
  return {
    messages: rows
      .filter((r) => r.kind !== "lead_form")
      .map((r) => ({ platform: channels.find((c) => c.id === r.scopeId)?.platform || (r.kind === "messenger" ? "facebook" : "instagram"), ...shape(r) })),
    leads: rows
      .filter((r) => r.kind === "lead_form")
      .map((r) => {
        const f = forms.find((x) => x.id === r.scopeId);
        return { formId: f?.formId || null, name: f?.name || null, ...shape(r) };
      }),
  };
}
