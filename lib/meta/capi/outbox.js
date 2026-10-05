// lib/meta/capi/outbox.js
//
// Writing to, and draining, MetaConversionEvent — the outbox between "a lead
// moved" and "Meta was told".
//
// ══ Why an outbox and not a call at the moment it happens ══════════════════
//
// The owner's rule for this feature: nothing blocks the user action. A
// contractor marking a quote accepted must never wait on Meta, and must never
// see an error because Meta was slow. So the moment only WRITES a row (or the
// sweep derives one later), and the sender drains rows on a cron — batched up
// to Meta's 1,000-per-request limit, retried with backoff, given up on with a
// recorded reason.
//
// ══ What happens to a failure ══════════════════════════════════════════════
//
//   2xx                   sent.
//   400-499 (not 401/429) Meta refused the event itself; sending it again gets
//                         the same refusal forever. Because Meta discards the
//                         WHOLE batch on one bad event, a refused batch is
//                         split in half and each half re-sent, down to the one
//                         event that is wrong — which is marked `failed` with
//                         Meta's reason, and every good event beside it is
//                         still delivered.
//   auth (190 / 401)      the token was revoked or expired. Retried with
//                         backoff (a reconnect fixes it) and said on the
//                         screen as "auth_error".
//   429 / 5xx / network   retried with backoff.
//   MAX_ATTEMPTS reached  failed, recorded.
//   older than 7 days     expired — Meta refuses an event_time that old.
//
// Every failure is written to the platform error log with the company named
// (lib/platform/errorLog.js recordError, which never throws).
import { CAPI_MAX_BATCH, sendConversionEvents, ensureMessagingDataset } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/tokenCrypto";
import { recordError } from "@/lib/platform/errorLog";
import { payloadHash, serialiseEvents, stageRank, withinUploadWindow } from "./events";
import { capiReadiness, kindReady, datasetToken, recordCapiSync } from "./settings";

export const MAX_ATTEMPTS = 8;
const BACKOFF_BASE_MS = 5 * 60 * 1000;
const BACKOFF_CAP_MS = 6 * 60 * 60 * 1000;
/** Rows drained per run — a backlog clears over several runs, never one long one. */
export const DRAIN_LIMIT = 5000;

/** When to try again after `attempts` failures. Pure. */
export function nextAttemptAfter(attempts, now = new Date()) {
  const n = Math.max(1, attempts);
  const wait = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** (n - 1));
  return new Date(new Date(now).getTime() + wait);
}

/**
 * What to do with a failed send. Pure.
 * @returns "split" | "fail" | "retry"
 */
export function failureAction(result, batchSize) {
  const status = Number(result?.status);
  if (result?.kind === "auth_error" || status === 401) return "retry";
  if (result?.kind === "rate_limited" || status === 429) return "retry";
  if (status >= 400 && status < 500) return batchSize > 1 ? "split" : "fail";
  return "retry";
}

/**
 * Queue events for one company. Idempotent: a row already owed under the same
 * (company, kind, event_id) is left exactly as it is — the first build wins,
 * so an observed stage keeps the time it was first observed. A row whose
 * event_time is already past Meta's window is stored `expired`, so the
 * backfill and the screen can count it, and nothing tries to send it.
 *
 * @param rows [{ kind, stage, eventName, eventId, channel?, leadId?, threadId?, eventTime, payload }]
 */
export async function enqueueEvents(prisma, companyId, rows, { now = new Date() } = {}) {
  if (!companyId || !Array.isArray(rows) || !rows.length) return { queued: 0 };
  const data = rows
    .filter((r) => r && r.payload && r.eventId && r.kind)
    .map((r) => ({
      companyId,
      kind: r.kind,
      stage: r.stage,
      eventName: r.eventName,
      eventId: String(r.eventId),
      channel: r.channel || null,
      leadId: r.leadId || null,
      threadId: r.threadId || null,
      eventTime: new Date(r.eventTime),
      payload: r.payload,
      payloadHash: payloadHash(r.payload),
      status: withinUploadWindow(r.eventTime, now) ? "pending" : "expired",
      nextAttemptAt: now,
    }));
  if (!data.length) return { queued: 0 };
  const res = await prisma.metaConversionEvent.createMany({ data, skipDuplicates: true });
  return { queued: res?.count ?? 0 };
}

/**
 * Where one kind's events go for one company: { datasetId, accessToken } or a
 * reason. Messaging datasets are asked of Meta once and remembered.
 */
export async function resolveDestination(prisma, { settings, pageConnection, kind, channel, ensureDataset = ensureMessagingDataset }) {
  if (kind === "crm" || kind === "website") {
    const token = datasetToken(settings);
    if (!token || !settings?.datasetId) return { ok: false, reason: "no_token" };
    return { ok: true, datasetId: settings.datasetId, accessToken: token };
  }
  if (kind === "messaging") {
    const pageToken = pageConnection?.pageAccessTokenEnc ? decryptToken(pageConnection.pageAccessTokenEnc) : null;
    if (!pageToken) return { ok: false, reason: "no_page" };
    const column = channel === "instagram" ? "instagramDatasetId" : "messengerDatasetId";
    const ownerId = channel === "instagram" ? pageConnection.instagramUserId : pageConnection.pageId;
    let datasetId = settings?.[column] || null;
    if (!datasetId) {
      const made = await ensureDataset({ pageAccessToken: pageToken, ownerId });
      datasetId = made?.ok && made.data?.id ? String(made.data.id) : null;
      if (!datasetId) return { ok: false, reason: made?.kind || "no_dataset", message: made?.message };
      await prisma.metaConversionSettings.updateMany({ where: { companyId: settings.companyId }, data: { [column]: datasetId } });
    }
    return { ok: true, datasetId, accessToken: pageToken };
  }
  return { ok: false, reason: "unknown_kind" };
}

async function markSent(prisma, rows, now) {
  if (!rows.length) return;
  await prisma.metaConversionEvent.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: { status: "sent", sentAt: now, lastError: null, lastStatusCode: 200, attempts: { increment: 1 } },
  });
}

async function markFailedFinal(prisma, row, result) {
  await prisma.metaConversionEvent.updateMany({
    where: { id: row.id },
    data: {
      status: "failed",
      attempts: { increment: 1 },
      lastError: String(result?.message || result?.kind || "refused").slice(0, 500),
      lastStatusCode: Number.isFinite(Number(result?.status)) ? Number(result.status) : null,
    },
  });
}

async function markRetry(prisma, rows, result, now) {
  for (const r of rows) {
    const attempts = (r.attempts || 0) + 1;
    await prisma.metaConversionEvent.updateMany({
      where: { id: r.id },
      data: {
        status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
        attempts,
        nextAttemptAt: nextAttemptAfter(attempts, now),
        lastError: String(result?.message || result?.kind || "error").slice(0, 500),
        lastStatusCode: Number.isFinite(Number(result?.status)) ? Number(result.status) : null,
      },
    });
  }
}

/**
 * Send one ordered list of rows to one destination, splitting refused
 * batches. Returns { sent, failed, retried, lastFailure }.
 */
export async function sendRows(prisma, { rows, destination, send = sendConversionEvents, now = new Date(), testEventCode = null }) {
  const out = { sent: 0, failed: 0, retried: 0, lastFailure: null };
  const queue = [];
  for (let i = 0; i < rows.length; i += CAPI_MAX_BATCH) queue.push(rows.slice(i, i + CAPI_MAX_BATCH));
  while (queue.length) {
    const batch = queue.shift();
    let result;
    try {
      result = await send({
        accessToken: destination.accessToken,
        datasetId: destination.datasetId,
        events: batch.map((r) => r.payload),
        serialise: serialiseEvents,
        testEventCode,
      });
    } catch (err) {
      result = { ok: false, kind: "network", message: err?.message || "network error", status: null };
    }
    if (result?.ok) {
      await markSent(prisma, batch, now);
      out.sent += batch.length;
      continue;
    }
    out.lastFailure = result;
    const action = failureAction(result, batch.length);
    if (action === "split") {
      const mid = Math.ceil(batch.length / 2);
      queue.unshift(batch.slice(mid));
      queue.unshift(batch.slice(0, mid));
    } else if (action === "fail") {
      await markFailedFinal(prisma, batch[0], result);
      out.failed += 1;
    } else {
      await markRetry(prisma, batch, result, now);
      out.retried += batch.length;
      // An outage or a dead token does not get better for the next batch in
      // the same second; the rest wait for their own backoff.
      for (const rest of queue.splice(0)) await markRetry(prisma, rest, result, now);
      break;
    }
  }
  return out;
}

/**
 * Drain everything due, company by company. Each company's rows go ONLY to
 * that company's own destination, read from that company's own settings row —
 * a row is never sent with another tenant's dataset or token.
 *
 * @returns {{ companies: number, sent: number, failed: number, retried: number, expired: number, skipped: number }}
 */
export async function deliverPending(prisma, { now = new Date(), companyId = null, send = sendConversionEvents, ensureDataset = ensureMessagingDataset } = {}) {
  const summary = { companies: 0, sent: 0, failed: 0, retried: 0, expired: 0, skipped: 0 };
  const due = await prisma.metaConversionEvent.findMany({
    where: { status: "pending", nextAttemptAt: { lte: now }, ...(companyId ? { companyId } : {}) },
    orderBy: [{ companyId: "asc" }, { eventTime: "asc" }],
    take: DRAIN_LIMIT,
  });
  const byCompany = new Map();
  for (const r of due) {
    if (!byCompany.has(r.companyId)) byCompany.set(r.companyId, []);
    byCompany.get(r.companyId).push(r);
  }
  for (const [cid, rows] of byCompany) {
    summary.companies += 1;
    const [settings, pageConnection, company] = await Promise.all([
      prisma.metaConversionSettings.findUnique({ where: { companyId: cid } }),
      prisma.metaPageConnection.findFirst({ where: { companyId: cid, disconnectedAt: null }, orderBy: { connectedAt: "desc" } }),
      prisma.company.findUnique({ where: { id: cid }, select: { name: true } }),
    ]);
    const companyName = company?.name || cid;

    // Past Meta's window: never sent, whatever else is true.
    const stale = rows.filter((r) => !withinUploadWindow(r.eventTime, now));
    if (stale.length) {
      await prisma.metaConversionEvent.updateMany({
        where: { id: { in: stale.map((r) => r.id) } },
        data: { status: "expired" },
      });
      summary.expired += stale.length;
    }
    const live = rows.filter((r) => withinUploadWindow(r.eventTime, now));
    if (!live.length) continue;

    const readiness = capiReadiness({ settings, pageConnection });
    // Switch off (or terms withdrawn): nothing is sent. The rows wait and
    // expire on their own; turning the switch back on within the week sends
    // what is still inside Meta's window.
    const groups = new Map();
    for (const r of live) {
      if (!kindReady(readiness, r.kind, r.channel)) {
        summary.skipped += 1;
        continue;
      }
      const key = r.kind === "messaging" ? `messaging:${r.channel}` : r.kind === "website" ? "website" : "crm";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(r);
    }
    let lastError = null;
    for (const [key, list] of groups) {
      const [kind, channel] = key.split(":");
      let destination;
      try {
        destination = await resolveDestination(prisma, { settings, pageConnection, kind, channel, ensureDataset });
      } catch (err) {
        destination = { ok: false, reason: "decrypt_failed", message: err?.message };
      }
      if (!destination.ok) {
        lastError = destination.reason;
        await markRetry(prisma, list, { kind: destination.reason, message: destination.message || destination.reason }, now);
        summary.retried += list.length;
        await recordError({
          area: "meta_capi",
          code: `destination_${destination.reason}`,
          companyId: cid,
          message: `Send lead results to Meta: ${companyName} — no ${kind}${channel ? `/${channel}` : ""} destination (${destination.reason}).`,
          detail: { kind, channel: channel || null, rows: list.length },
        });
        continue;
      }
      // Earlier funnel stages first: Meta asks for a lead's stages in order.
      list.sort((a, b) => stageRank(a.kind, a.stage) - stageRank(b.kind, b.stage) || new Date(a.eventTime) - new Date(b.eventTime));
      const res = await sendRows(prisma, { rows: list, destination, send, now });
      summary.sent += res.sent;
      summary.failed += res.failed;
      summary.retried += res.retried;
      if (res.lastFailure) {
        lastError = res.lastFailure.kind === "auth_error" ? "auth_error" : res.failed ? "bad_request" : res.lastFailure.kind || "error";
        await recordError({
          area: "meta_capi",
          code: lastError,
          companyId: cid,
          message: `Send lead results to Meta: ${companyName} — Meta refused or failed ${res.failed + res.retried} ${kind} event(s): ${String(res.lastFailure.message || "").slice(0, 300)}`,
          detail: { kind, channel: channel || null, status: res.lastFailure.status ?? null, code: res.lastFailure.code ?? null, sent: res.sent, failed: res.failed, retried: res.retried },
        });
      }
    }
    if (groups.size) await recordCapiSync(prisma, cid, { error: lastError, at: now });
  }
  return summary;
}
