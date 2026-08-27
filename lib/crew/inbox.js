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
import { toE164 } from "@/lib/sms/twilioClient";
import { uploadBuffer } from "@/lib/cloudinary";
import { decideAction } from "./inboxLogic";
import { isTwilioMediaUrl } from "./inboundParse";
import { chargeInboundCrewMessage } from "./messaging";
import { inferStage } from "@/lib/gallery/stages";
import { zonedYmd, zonedWallClockToUtc } from "@/lib/booking/timezone";

/** The schema's own default, used when a company has never set one. */
const FALLBACK_TZ = "America/Toronto";

/**
 * How long an unanswered "which job?" can still be answered BY TEXT.
 *
 * ══ Why this is bounded at all ═════════════════════════════════════════════
 *
 * The pending lookup used to have no time limit, so a question asked on Tuesday
 * was still "the open question" on Friday. A crew member texting "2" to mean
 * "two more coats" would silently resolve it and file Tuesday's photo against
 * whichever job happened to be second in a list nobody remembered seeing. That
 * is precisely the silent wrong-file this feature exists to refuse, arriving
 * through the back door.
 *
 * A working day. Past that the message stays in the office inbox for a person —
 * it is never dropped, it just stops being answerable by a stray text.
 */
const ANSWER_WINDOW_MS = 12 * 60 * 60 * 1000;

/**
 * Start and end of the sender's day, read IN THE COMPANY'S TIMEZONE.
 *
 * ══ This used to be a comment, not behaviour ═══════════════════════════════
 *
 * The old version said "in the company's timezone as best we can" and called
 * `setHours(0,0,0,0)` — the SERVER's midnight. On Vercel the server is UTC, so
 * for a Montreal crew every photo texted after 20:00 local fell on the next UTC
 * day, matched none of their visits, and came back "I don't see a job on your
 * schedule for today". Evening progress photos are most of the traffic this
 * feature is for, and it lost all of them, every day, for every North American
 * tenant.
 *
 * The end is the next CALENDAR day's midnight rather than start + 24h, because a
 * DST day is 23 or 25 hours long and adding a fixed day would drag an hour of
 * tomorrow's schedule in (or drop an hour of today's).
 *
 * Exported so the check script can run it against real zones and transitions.
 */
export function dayBoundsIn(now = new Date(), timezone = FALLBACK_TZ) {
  let tz = timezone || FALLBACK_TZ;
  let ymd;
  try {
    ymd = zonedYmd(now, tz);
  } catch {
    // A bad zone string in a company row must not cost the crew their photos.
    tz = FALLBACK_TZ;
    ymd = zonedYmd(now, tz);
  }
  const start = zonedWallClockToUtc({ ...ymd, hours: 0 }, tz);
  const next = new Date(Date.UTC(ymd.year, ymd.month - 1, ymd.day + 1));
  const end = zonedWallClockToUtc(
    {
      year: next.getUTCFullYear(),
      month: next.getUTCMonth() + 1,
      day: next.getUTCDate(),
      hours: 0,
    },
    tz,
  );
  return { start, end };
}

/**
 * Whose message is this?
 *
 * Matched on the Worker roster by phone. A number that isn't a crew member
 * resolves to null — the message is still logged, but nothing is filed, because
 * we have no schedule to attribute against and guessing would be worse than the
 * "who is this?" a person can answer.
 *
 * Note the scope: `companyId` is already decided, by the number that was texted.
 * This never picks a company from a phone number — see inboundParse.js.
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
async function candidatesFor(companyId, userId, now, timezone) {
  if (!userId) return [];
  const { start, end } = dayBoundsIn(now, timezone);

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
          // The site address, for the text side of attribution (street number
          // is the most distinctive token — see attribution.js).
          //
          // This used to select `appointments` off the Job for geocoded
          // coordinates. There is no such relation: Appointment has no jobId
          // and Job has no appointments back-relation, so Prisma rejected the
          // query and every inbound crew message threw before it could be
          // filed. Whoever wrote it assumed a Job↔Appointment link that the
          // schema has never had.
          //
          // No coordinates are supplied in their place. A job visit genuinely
          // has no geocoded point today, and inventing one from the client's
          // billing address would be worse than none — a company client is
          // billed at an office and worked at a different site every week, so
          // it would confidently attribute photos to the wrong job. gpsMatch
          // drops candidates with no point and falls back to text matching,
          // which is the honest degradation.
          client: { select: { name: true, address: true } },
        },
      },
    },
  });

  return visits.map((v) => {
    return {
      jobId: v.jobId,
      jobVisitId: v.id,
      jobTitle: v.job.title,
      clientName: v.job.client?.name || "",
      address: v.job.client?.address || "",
      // Deliberately absent, not zero. See the select above.
      lat: undefined,
      lng: undefined,
    };
  });
}

/**
 * Pull a Twilio media URL (needs account auth) and re-host it to Cloudinary.
 * Returns the durable URL, or null on any failure — a photo that won't fetch
 * shouldn't take the whole message down.
 *
 * ══ The host check is a credential check ═══════════════════════════════════
 *
 * This sends Basic auth built from the Twilio account SID and auth token. It
 * used to send that header to whatever host the webhook payload named, so a
 * `MediaUrl0` pointing anywhere would have handed FieldQuo's Twilio master
 * credentials to it — and a URL pointing inside the deployment's own network
 * would have been a server-side request forgery with an auth header attached.
 * The signature check makes that hard to reach. It does not make it safe to
 * leave, and the second guard costs one comparison.
 */
async function rehost(mediaUrl, companyId) {
  if (!isTwilioMediaUrl(mediaUrl)) return null;
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_API_KEY_SECRET;
    const auth = sid && token ? "Basic " + Buffer.from(`${sid}:${token}`).toString("base64") : null;

    const res = await fetch(mediaUrl, {
      ...(auth ? { headers: { Authorization: auth } } : {}),
      // A redirect off Twilio would carry the Authorization header to wherever
      // it pointed, which is the same leak the host check above closes. Twilio's
      // media endpoints do 307 to their CDN, so this is followed manually below
      // rather than refused outright.
      redirect: "manual",
    });

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      // The CDN URL is pre-signed and needs no credentials, so the follow-up
      // goes out bare. That is the point: the token never leaves Twilio's host.
      if (!next) return null;
      const followed = await fetch(next);
      if (!followed.ok) return null;
      return await store(followed, companyId);
    }

    if (!res.ok) return null;
    return await store(res, companyId);
  } catch (err) {
    console.error("[crew] media re-host failed:", err.message);
    return null;
  }
}

async function store(res, companyId) {
  const buf = Buffer.from(await res.arrayBuffer());
  const up = await uploadBuffer(buf, { folder: `crew/${companyId}`, resourceType: "auto" });
  return up?.secure_url || null;
}

/**
 * The visit a message should be filed onto for a given job.
 *
 * Today's scheduled visit when there is one; otherwise the job's most recent
 * visit, because the schedule may have moved between the question and the
 * answer. One helper rather than two copies: the SMS path and the office-inbox
 * path have to agree, and when they were written separately they didn't — the
 * SMS path had no fallback at all, so answering yesterday's question resolved to
 * no visit and filed the photo nowhere while telling the crew it had landed.
 */
async function visitFor(companyId, jobId, candidates = []) {
  const today = candidates.find((c) => c.jobId === jobId)?.jobVisitId;
  if (today) return today;
  const visit = await db.jobVisit.findFirst({
    where: { jobId, job: { companyId } },
    orderBy: { scheduledAt: "desc" },
    select: { id: true },
  });
  return visit?.id || null;
}

/**
 * File a held message to a job a HUMAN chose, from the inbox screen.
 *
 * The same filing the crew's SMS reply would have done, reached the other way —
 * so a "which job?" the crew never answered isn't a photo lost forever. Guards:
 * the message must belong to this company and still be unresolved, and the job
 * must be one of the candidates it was actually asked about (an owner can't
 * file it to an unrelated job by editing a request).
 *
 * `superseded` is accepted alongside `pending` on purpose. A question the crew
 * answered with a new photo instead of an answer stops being the open SMS
 * conversation, but the photo it was holding is real and a person can still say
 * where it belongs. Refusing it here would turn "we stopped asking" into "we
 * threw it away".
 *
 * @param scope  the caller's read scope, from crewMessageScope — `{}` for the
 *               whole company, `{ senderUserId }` for one person's own. Merged
 *               into the lookup rather than checked afterwards, so filing and
 *               listing cannot disagree about which rows exist: a member who
 *               can't see a message gets the same 404 they'd get for an id that
 *               was never real. Defaults to `{}` for callers with no viewer
 *               (there are none today; the default is so adding one is a
 *               decision rather than an omission).
 * @returns { ok, filedTo } or { ok:false, reason, status }
 */
export async function fileHeldMessage({ companyId, messageId, jobId, scope = {} }) {
  const msg = await db.crewInboundMessage.findFirst({
    where: { id: messageId, companyId, ...scope },
  });
  if (!msg) return { ok: false, reason: "No such message.", status: 404 };
  if (msg.status !== "pending" && msg.status !== "superseded") {
    return { ok: false, reason: "That message has already been handled.", status: 409 };
  }
  if (msg.candidateJobIds.length && !msg.candidateJobIds.includes(jobId)) {
    return { ok: false, reason: "That job wasn't one of the options for this message.", status: 400 };
  }

  const jobVisitId = await visitFor(companyId, jobId);
  if (!jobVisitId) return { ok: false, reason: "That job has no visit to file against.", status: 400 };

  const filed = await fileToVisit({
    companyId,
    jobId,
    jobVisitId,
    mediaUrls: msg.mediaUrls,
    note: msg.body,
  });
  if (!filed) {
    return { ok: false, reason: "There's nothing on that message to file.", status: 400 };
  }

  await db.crewInboundMessage.update({
    where: { id: msg.id },
    data: { status: "filed", method: "manual", jobId, jobVisitId, resolvedAt: new Date() },
  });

  const job = await db.job.findUnique({
    where: { id: jobId },
    select: { title: true, client: { select: { name: true } } },
  });
  return { ok: true, filedTo: job?.client?.name || job?.title || "the job" };
}

/**
 * Append media and/or a note to a job's visit, AND record each photo as a
 * JobPhoto with the stage the message implies.
 *
 * Two stores on purpose: JobVisit.photos stays the raw feed the job screen
 * already reads (nothing there breaks), and JobPhoto adds the stage + the
 * `featured` flag the website gallery needs. The photos land private — featured
 * is false until the owner promotes them.
 *
 * ── Returns whether anything landed ────────────────────────────────────────
 *
 * It used to return nothing and bail silently on a missing visit, while the
 * caller went ahead and marked the message `filed` and texted the crew "Filed to
 * Sam Rivera 👍". A photo deleted with a thank-you note is the worst outcome
 * this code could produce, so the caller now has to look.
 *
 * ── A note with no photo is a message too ──────────────────────────────────
 *
 * The old guard required media, so "second coat done, no photos" filed to a job
 * and wrote nothing anywhere a person would see it. The card sells "photos and
 * updates"; the updates half was dropping on the floor.
 */
async function fileToVisit({ companyId, jobId, jobVisitId, mediaUrls = [], note }) {
  const media = (Array.isArray(mediaUrls) ? mediaUrls : []).filter(Boolean);
  const text = typeof note === "string" ? note.trim() : "";
  if (!jobVisitId || (!media.length && !text)) return false;

  const visit = await db.jobVisit.findUnique({
    where: { id: jobVisitId },
    select: { photos: true, notes: true },
  });
  if (!visit) return false;

  await db.jobVisit.update({
    where: { id: jobVisitId },
    data: {
      ...(media.length ? { photos: [...(visit.photos || []), ...media] } : {}),
      // Notes accrue rather than overwrite — a day's updates are a log, not a
      // single field somebody keeps clobbering.
      ...(text ? { notes: [visit.notes, text].filter(Boolean).join("\n") } : {}),
    },
  });

  // Stage inferred from what the crew actually texted — a hint the owner can
  // change, never a silent decision. See lib/gallery/stages.js.
  if (companyId && media.length) {
    const stage = inferStage(text);
    await db.jobPhoto.createMany({
      data: media.map((url) => ({
        companyId,
        jobId: jobId || null,
        jobVisitId,
        url,
        stage,
        caption: text ? text.slice(0, 200) : null,
      })),
    });
  }
  return true;
}

/**
 * What to say when there's nothing to file — usually nothing.
 *
 * ══ Silence is the right default, and the wrong one during setup ═══════════
 *
 * An unknown number gets no reply: we don't engage strangers, and a line that
 * answers everything is a line spammers keep. But the FIRST texts a company ever
 * sends are a contractor testing from his own mobile, which is not on the Worker
 * roster yet — and silence at that exact moment is indistinguishable from the
 * feature being broken. That indistinguishability is the whole reason this code
 * needed rewriting, so the opening handful of messages get a sentence that says
 * we heard them and names the one thing missing.
 */
async function ignoreReply({ companyId, sender, candidates, hasContent }) {
  if (!sender) {
    const seen = await db.crewInboundMessage.count({ where: { companyId } });
    if (seen > SETUP_REPLY_LIMIT) return null;
    return (
      "Got your text — but this number isn't on your team roster yet, " +
      "so there's no schedule to file it against. Add it to a crew member " +
      // Named to the screen that can actually take it. "Settings → Team" was
      // one level short: the phone field lives on the worker row under
      // Team → Workers, and until this change it did not exist there at all.
      "under Settings → Team → Workers and try again."
    );
  }
  if (candidates.length === 0 && hasContent) {
    return "Thanks — I don't see a job on your schedule for today to file this against.";
  }
  return null;
}

/** Messages into a company's life during which an unknown sender still gets help. */
const SETUP_REPLY_LIMIT = 5;

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
export async function handleCrewMessage({ companyId, fromPhone, body, mediaUrls = [], point = null, segments = 1, now = new Date() }) {
  const fromE164 = toE164(fromPhone);
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  const sender = await resolveSender(companyId, fromE164);
  const candidates = await candidatesFor(companyId, sender?.userId, now, company?.timezone);

  // Re-host media up front — needed whether we file now or after a reply.
  const hosted = (await Promise.all(mediaUrls.map((u) => rehost(u, companyId)))).filter(Boolean);

  // The open question for this sender, if any — and only a RECENT one. See
  // ANSWER_WINDOW_MS: an unbounded lookup let a stray "2" days later resolve a
  // forgotten question against a job nobody had in mind.
  const pendingRow = await db.crewInboundMessage.findFirst({
    where: {
      companyId,
      senderPhone: fromE164 || fromPhone,
      status: "pending",
      createdAt: { gte: new Date(now.getTime() - ANSWER_WINDOW_MS) },
    },
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

  // ── Metered here, not at the door ─────────────────────────────────────────
  //
  // The charge lands the moment the message is RECORDED, and it lands whatever
  // the balance is. The carrier has already been paid by the time this webhook
  // fires, so declining to bill would only mean FieldQuo silently absorbing it;
  // declining to RECEIVE would destroy a site photo to save money that was
  // already spent. Keyed on this row's own id, so a re-delivered webhook after a
  // timeout charges exactly once. Whether the reply is affordable is a separate
  // question, answered by the caller — see lib/crew/messaging.js.
  await chargeInboundCrewMessage({
    companyId,
    messageId: row.id,
    // What the CARRIER delivered, not what survived re-hosting: a photo we
    // failed to fetch from Twilio still cost us the MMS.
    hasMedia: mediaUrls.length > 0,
    segments,
    // Onto the statement line, last four digits only — so a charge can be
    // paired with the message that caused it without a full mobile number
    // landing in a billing export.
    from: fromE164 || fromPhone,
  }).catch((err) => {
    // A ledger write that fails must not cost the crew their photo. Logged, and
    // the message is still filed — the reverse (refuse the work because the
    // accounting hiccupped) is the trade nobody would choose.
    console.error("[crew] metering failed:", err.message);
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

  // ── The stale question, actually abandoned ────────────────────────────────
  //
  // inboxLogic's contract says a question the crew answer with a NEW photo is
  // abandoned rather than left to collect a mismatched answer later. Nothing
  // used to carry that out: the old row stayed `pending` forever, so the next
  // bare number the crew texted could still resolve it. Marked `superseded` —
  // which stops the SMS side treating it as open while leaving it in the office
  // inbox, because the photo it holds is real and a person can still place it.
  if (pending?.row && !decision.resolvedAsk && decision.action !== "reask") {
    await db.crewInboundMessage.update({
      where: { id: pending.row.id },
      data: { status: "superseded" },
    });
  }

  // ── Carry out the decision ────────────────────────────────────────────────
  if (decision.action === "file") {
    const jobId = decision.jobId;
    const target = decision.resolvedAsk && pending?.row ? pending.row : row;
    const jobVisitId = await visitFor(companyId, jobId, candidates);

    const filed = await fileToVisit({
      companyId,
      jobId,
      jobVisitId,
      // On a resolved ask this files the HELD photo, not the "2" they just texted.
      mediaUrls: target.mediaUrls,
      note: target.body,
    });

    if (!filed) {
      // Nothing landed — the job has no visit to attach to, or there was nothing
      // to attach. Do NOT report success: leave it for a person, and say so.
      // The version of this that marked `filed` anyway is how a photo could
      // vanish behind a thumbs-up.
      await db.crewInboundMessage.update({
        where: { id: target.id },
        data: { status: "pending", candidateJobIds: [jobId] },
      });
      if (target.id !== row.id) {
        await db.crewInboundMessage.update({
          where: { id: row.id },
          data: { status: "ignored", resolvedAt: now },
        });
      }
      return { reply: "Couldn't file that one — it's waiting in the office inbox.", action: "held", messageId: row.id };
    }

    await db.crewInboundMessage.update({
      where: { id: target.id },
      data: { status: "filed", method: decision.method, jobId, jobVisitId, resolvedAt: now },
    });
    if (target.id !== row.id) {
      // This message was just the answer — it filed nothing of its own.
      await db.crewInboundMessage.update({
        where: { id: row.id },
        data: { status: "ignored", resolvedAt: now },
      });
    }

    const c = candidates.find((x) => x.jobId === jobId);
    const where = c?.clientName || c?.jobTitle || "the job";
    // Confirm ONLY when it wasn't obvious — a silent file for the only-one case,
    // a light confirmation when the crew had to choose or we inferred.
    const reply = decision.method === "only-one" ? null : `Filed to ${where}. 👍`;
    return { reply, action: "file", messageId: row.id };
  }

  if (decision.action === "ask") {
    await db.crewInboundMessage.update({
      where: { id: row.id },
      data: { status: "pending", candidateJobIds: decision.candidates.map((c) => c.jobId) },
    });
    return { reply: askText(decision.candidates), action: "ask", messageId: row.id };
  }

  if (decision.action === "reask" && pending?.row) {
    // Don't create a new question — the old one stands. Just nudge, and mark
    // this stray reply handled.
    await db.crewInboundMessage.update({ where: { id: row.id }, data: { status: "ignored", resolvedAt: now } });
    return { reply: askText(pending.candidates), action: "reask", messageId: row.id };
  }

  // Ignore — nothing to file. Mark it, and stay silent unless it's clearly a
  // person expecting an answer.
  await db.crewInboundMessage.update({ where: { id: row.id }, data: { status: "ignored", resolvedAt: now } });
  return { reply: await ignoreReply({ companyId, sender, candidates, hasContent: hosted.length > 0 || Boolean(body) }), action: "ignore", messageId: row.id };
}
