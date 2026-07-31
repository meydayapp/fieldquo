// lib/crew/inbox.js
//
// The crew inbox, wired to the database and the phone.
//
// This is the thin adapter around two pure cores: attribution.js ("which job?")
// and inboxLogic.js ("file, ask, or resolve?"). Everything decision-shaped lives
// there and is tested without a database; everything here is fetch, write, send.
//
// ── The FieldQuo edge, made concrete ───────────────────────────────────────
//
// Barry bolts onto Jobber over OAuth and gates every write behind an approval.
// This owns the schema: a crew photo goes straight onto JobVisit.photos with no
// third party in between. The candidates it attributes against are the sender's
// OWN scheduled visits for the day — richer context than Barry's, because the
// schedule is ours, not a copy synced through an API.
import { db } from "@/lib/db";
import { toE164, sendSms } from "@/lib/sms/twilioClient";
import { uploadBuffer } from "@/lib/cloudinary";
import { decideAction } from "./inboxLogic";

/** Start/end of the sender's day, in the company's timezone as best we can. */
function dayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Whose message is this?
 *
 * Matched on the Worker roster by phone. A number that isn't a crew member
 * resolves to null — the message is still logged, but nothing is filed, because
 * we have no schedule to attribute against and guessing would be worse than the
 * "who is this?" a person can answer.
 */
async function resolveSender(companyId, fromE164) {
  if (!fromE164) return null;
  // Phone is stored in varied formats, so the match can't happen in SQL —
  // pull the roster (small: a company has a handful of crew) and normalise both
  // sides. Only workers linked to a user, because attribution needs a userId to
  // find their scheduled visits.
  const workers = await db.worker.findMany({
    where: { companyId, phone: { not: null }, userId: { not: null } },
    select: { userId: true, phone: true, name: true },
  });
  return workers.find((w) => toE164(w.phone) === fromE164) || null;
}

/**
 * The jobs this person could plausibly be messaging about: their visits
 * scheduled for today, shaped for the attribution engine.
 */
async function candidatesFor(companyId, userId, now) {
  if (!userId) return [];
  const { start, end } = dayBounds(now);

  const visits = await db.jobVisit.findMany({
    where: {
      assignedToId: userId,
      scheduledAt: { gte: start, lt: end },
      job: { companyId },
    },
    select: {
      id: true,
      jobId: true,
      job: {
        select: {
          title: true,
          client: { select: { name: true } },
          // The visit address for GPS matching — the appointment carries the
          // geocoded coordinates (see the travel-time work).
          appointments: {
            select: { location: true, latitude: true, longitude: true },
            take: 1,
            orderBy: { scheduledAt: "desc" },
          },
        },
      },
    },
  });

  return visits.map((v) => {
    const appt = v.job.appointments?.[0];
    return {
      jobId: v.jobId,
      jobVisitId: v.id,
      jobTitle: v.job.title,
      clientName: v.job.client?.name || "",
      address: appt?.location || "",
      lat: appt?.latitude != null ? Number(appt.latitude) : undefined,
      lng: appt?.longitude != null ? Number(appt.longitude) : undefined,
    };
  });
}

/**
 * Pull a Twilio media URL (needs account auth) and re-host it to Cloudinary.
 * Returns the durable URL, or null on any failure — a photo that won't fetch
 * shouldn't take the whole message down.
 */
async function rehost(mediaUrl, companyId) {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_KEY_SECRET;
    const auth = sid && token ? "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") : null;

    const res = await fetch(mediaUrl, auth ? { headers: { Authorization: auth } } : {});
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const up = await uploadBuffer(buf, { folder: `crew/${companyId}`, resourceType: "auto" });
    return up?.secure_url || null;
  } catch (err) {
    console.error("[crew] media re-host failed:", err.message);
    return null;
  }
}

/** Append media + a note to a job's visit. The actual filing. */
async function fileToVisit({ jobVisitId, mediaUrls, note }) {
  if (!jobVisitId) return;
  const visit = await db.jobVisit.findUnique({
    where: { id: jobVisitId },
    select: { photos: true, notes: true },
  });
  if (!visit) return;

  await db.jobVisit.update({
    where: { id: jobVisitId },
    data: {
      photos: [...(visit.photos || []), ...mediaUrls],
      // Notes accrue rather than overwrite — a day's updates are a log, not a
      // single field somebody keeps clobbering.
      ...(note
        ? { notes: [visit.notes, note].filter(Boolean).join("\n") }
        : {}),
    },
  });
}

/** The visit id for a job among today's candidates. */
function visitIdFor(jobId, candidates) {
  return candidates.find((c) => c.jobId === jobId)?.jobVisitId || null;
}

/** A numbered list of jobs, for the "which one?" text. */
function askText(candidates) {
  const lines = candidates
    .slice(0, 9)
    .map((c, i) => `${i + 1}. ${c.clientName || c.jobTitle || c.address || "a job"}`);
  return `Which job is this for?\n${lines.join("\n")}\nReply with the number.`;
}

/**
 * Handle one inbound crew message end to end.
 *
 * @param {object} msg  { companyId, fromPhone, body, mediaUrls, point, now }
 *                      mediaUrls are the RAW Twilio urls; re-hosting happens here.
 * @returns {{ reply: string|null, action: string }}  reply is the SMS to send
 *          back (or null to stay silent — an agent that chirps "got it!" at
 *          every photo becomes noise the crew mutes).
 */
export async function handleCrewMessage({ companyId, fromPhone, body, mediaUrls = [], point = null, now = new Date() }) {
  const fromE164 = toE164(fromPhone);
  const sender = await resolveSender(companyId, fromE164);
  const candidates = await candidatesFor(companyId, sender?.userId, now);

  // Re-host media up front — needed whether we file now or after a reply.
  const hosted = (await Promise.all(mediaUrls.map((u) => rehost(u, companyId)))).filter(Boolean);

  // The open question for this sender, if any.
  const pendingRow = await db.crewInboundMessage.findFirst({
    where: { companyId, senderPhone: fromE164 || fromPhone, status: "pending" },
    orderBy: { createdAt: "desc" },
  });

  // Log THIS message. It's the record, and — if it needs asking — the pending
  // question too.
  const row = await db.crewInboundMessage.create({
    data: {
      companyId,
      senderUserId: sender?.userId || null,
      senderPhone: fromE164 || fromPhone,
      body: body || null,
      mediaUrls: hosted,
      ...(point && Number.isFinite(point.lat) && Number.isFinite(point.lng)
        ? { latitude: point.lat, longitude: point.lng }
        : {}),
      status: "pending", // provisional; set below
    },
  });

  const pending = pendingRow
    ? {
        candidates: pendingRow.candidateJobIds.map((jobId) => {
          const c = candidates.find((x) => x.jobId === jobId);
          return c || { jobId };
        }),
        payload: { mediaCount: pendingRow.mediaUrls.length },
        row: pendingRow,
      }
    : null;

  const decision = decideAction({
    inbound: { text: body, hasMedia: hosted.length > 0, mediaCount: hosted.length, point },
    pending,
    candidates,
  });

  // ── Carry out the decision ────────────────────────────────────────────────
  if (decision.action === "file") {
    const jobId = decision.jobId;

    if (decision.resolvedAsk && pending?.row) {
      // File the HELD photo (on the pending row), not this "2".
      await fileToVisit({
        jobVisitId: visitIdFor(jobId, candidates),
        mediaUrls: pending.row.mediaUrls,
        note: pending.row.body,
      });
      await db.crewInboundMessage.update({
        where: { id: pending.row.id },
        data: { status: "filed", method: decision.method, jobId, jobVisitId: visitIdFor(jobId, candidates), resolvedAt: now },
      });
      // This message was just the answer — it filed nothing of its own.
      await db.crewInboundMessage.update({ where: { id: row.id }, data: { status: "ignored", resolvedAt: now } });
    } else {
      await fileToVisit({ jobVisitId: visitIdFor(jobId, candidates), mediaUrls: hosted, note: body });
      await db.crewInboundMessage.update({
        where: { id: row.id },
        data: { status: "filed", method: decision.method, jobId, jobVisitId: visitIdFor(jobId, candidates), resolvedAt: now },
      });
    }

    const c = candidates.find((x) => x.jobId === jobId);
    const where = c?.clientName || c?.jobTitle || "the job";
    // Confirm ONLY when it wasn't obvious — a silent file for the only-one case,
    // a light confirmation when the crew had to choose or we inferred.
    const reply = decision.method === "only-one" ? null : `Filed to ${where}. 👍`;
    return { reply, action: "file" };
  }

  if (decision.action === "ask") {
    await db.crewInboundMessage.update({
      where: { id: row.id },
      data: { status: "pending", candidateJobIds: decision.candidates.map((c) => c.jobId) },
    });
    return { reply: askText(decision.candidates), action: "ask" };
  }

  if (decision.action === "reask" && pending?.row) {
    // Don't create a new question — the old one stands. Just nudge, and mark
    // this stray reply handled.
    await db.crewInboundMessage.update({ where: { id: row.id }, data: { status: "ignored", resolvedAt: now } });
    return { reply: askText(pending.candidates), action: "reask" };
  }

  // Ignore — nothing to file. Mark it, and stay silent unless it's clearly a
  // person expecting an answer.
  await db.crewInboundMessage.update({ where: { id: row.id }, data: { status: "ignored", resolvedAt: now } });
  const reply =
    !sender
      ? null // unknown number — don't engage a stranger
      : candidates.length === 0 && (hosted.length > 0 || body)
        ? "Thanks — I don't see a job on your schedule for today to file this against."
        : null;
  return { reply, action: "ignore" };
}
