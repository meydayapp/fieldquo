// lib/social/publishDesign.js
//
// Orchestrates one publish attempt end to end — validates, checks the live
// rate limit, walks Instagram's container-then-publish state machine (or
// makes Facebook's single call), and returns a plain result the API route
// turns into a SocialPublish row. No fetch(), no Prisma, no fabric: every
// side effect crosses an injected `client` (lib/social/metaGraphClient.js's
// exports, or a fake — see scripts/check-designer-reach.mjs) and an injected
// `sleep`, so the container poll loop can be driven by a test in
// milliseconds against every status Meta can return, including EXPIRED and
// an IN_PROGRESS that never resolves, without a network call or a real
// 24-hour wait.
//
// The decisions themselves — is this caption too long, does this status
// mean "poll again" or "give up", is the account out of quota — all live in
// lib/social/metaSpecs.js and are asserted there directly. This file is the
// GLUE between those decisions and the two Meta endpoints, kept thin on
// purpose so the glue can't quietly duplicate a rule metaSpecs.js already
// owns.
//
// Also exports validateInstagramSchedule() — the read-only half of
// scheduling an Instagram post (see its own comment below and
// docs/SOCIAL-SCHEDULING.md): no client, no container, because a scheduled
// Instagram post's container must not exist until the cron actually fires
// it. publishToFacebook() already covers Facebook scheduling unchanged — it
// accepted `scheduledPublishTime` before this file had any concept of
// "later" at all, because Meta's own Page feed endpoint does the holding.
import {
  validateCaption,
  validateImageForInstagram,
  validateImageForFacebook,
  nextContainerAction,
  interpretRateLimit,
  isValidFacebookScheduleTime,
  isValidScheduleTime,
} from "./metaSpecs";

/**
 * Thrown for every refusal — a bad caption, no connection, quota exhausted,
 * a container that expired. `code` is a stable string the API route maps to
 * a translated message; never a raw Meta error string, which is not
 * guaranteed to be in the contractor's language or even human-readable.
 */
export class PublishRefusal extends Error {
  constructor(code, message, extra) {
    super(message || code);
    this.name = "PublishRefusal";
    this.code = code;
    if (extra) Object.assign(this, extra);
  }
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {Object} args
 * @param {import("./metaConnection").MetaConnection} args.connection
 * @param {string} args.imageUrl - public Cloudinary URL Meta will cURL
 * @param {string} args.caption
 * @param {number} args.width
 * @param {number} args.height
 * @param {number} [args.fileSizeBytes]
 * @param {Object} args.client - lib/social/metaGraphClient.js's exports, or a fake
 * @param {(ms:number)=>Promise<void>} [args.sleep]
 * @param {"rate_limited"|"container_error"|null} [args.simulateFailure] -
 *   demo-only. Forwarded to `client` unchanged; the real metaGraphClient.js
 *   ignores the extra field, so this parameter is a no-op unless `client` is
 *   lib/social/mockMetaGraphClient.js. The publish route only ever sets it
 *   from connection.mock — see that file's own header.
 */
export async function publishToInstagram({
  connection,
  imageUrl,
  caption,
  width,
  height,
  fileSizeBytes,
  client,
  sleep = defaultSleep,
  simulateFailure = null,
}) {
  if (!connection?.connected) {
    throw new PublishRefusal("not_connected", "Instagram isn't connected yet.");
  }
  if (!connection.instagramUserId) {
    throw new PublishRefusal(
      "no_instagram_account",
      "This Facebook Page has no linked Instagram professional account.",
    );
  }

  const captionCheck = validateCaption(caption);
  if (!captionCheck.ok) {
    throw new PublishRefusal("invalid_caption", captionCheck.errors.join(","), {
      errors: captionCheck.errors,
    });
  }

  const imageCheck = validateImageForInstagram({ width, height, fileSizeBytes });
  if (!imageCheck.ok) {
    throw new PublishRefusal("invalid_image", imageCheck.errors.join(","), {
      errors: imageCheck.errors,
    });
  }

  // Checked live, not against a locally-tracked counter — a post made
  // directly through Meta Business Suite (outside FieldQuo entirely) still
  // counts against the same quota, and only Meta's own endpoint knows that.
  const quota = await client
    .getInstagramPublishingLimit({
      igUserId: connection.instagramUserId,
      accessToken: connection.pageAccessToken,
      simulateFailure,
    })
    .catch(() => null);
  const rate = interpretRateLimit(quota);
  if (!rate.ok) {
    throw new PublishRefusal(
      "rate_limited",
      "This Instagram account has reached Meta's limit on posts published in a 24-hour period.",
      { rate },
    );
  }

  const containerId = await client.createInstagramContainer({
    igUserId: connection.instagramUserId,
    accessToken: connection.pageAccessToken,
    imageUrl,
    caption,
  });
  if (!containerId) {
    throw new PublishRefusal("container_failed", "Meta did not return a container id.");
  }

  let attempt = 0;
  // A container is guaranteed to leave IN_PROGRESS within Meta's own SLA in
  // practice, but "guaranteed in practice" is not a loop condition — bounded
  // by nextContainerAction()'s own MAX_POLL_ATTEMPTS, which turns "never
  // resolves" into a named failure instead of a hung request.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const statusCode = await client.getInstagramContainerStatus({
      containerId,
      accessToken: connection.pageAccessToken,
      simulateFailure,
    });
    const decision = nextContainerAction(statusCode, attempt);

    if (decision.action === "publish") {
      // eslint-disable-next-line no-await-in-loop
      const postId = await client.publishInstagramContainer({
        igUserId: connection.instagramUserId,
        accessToken: connection.pageAccessToken,
        containerId,
      });
      if (!postId) {
        throw new PublishRefusal("publish_failed", "Meta did not return a post id.", { containerId });
      }
      return { containerId, postId, status: "published" };
    }

    // Meta says it is already live. Record the success we came for rather than
    // publishing a second time. postId stays null: a container's status does
    // not carry the post id, and inventing one would be worse than an audit
    // row that honestly says it does not know which post this became.
    if (decision.action === "already_published") {
      return { containerId, postId: null, status: "published" };
    }

    if (decision.action === "poll") {
      attempt += 1;
      // eslint-disable-next-line no-await-in-loop
      await sleep(decision.waitMs);
      continue;
    }

    if (decision.action === "recreate") {
      throw new PublishRefusal(
        "container_expired",
        "The upload expired before Meta finished processing it. Try publishing again.",
        { containerId },
      );
    }

    throw new PublishRefusal(
      decision.reason || "container_failed",
      "Meta could not finish processing the image.",
      { containerId },
    );
  }
}

/**
 * Facebook Page photo posts are a single call — no container, no polling.
 * `scheduledPublishTime`, when given, uses Meta's own native Page
 * scheduling; omit it to publish immediately. See metaSpecs.js's header for
 * why Instagram has no equivalent parameter and is never scheduled this way.
 *
 * A demo (mock) company's SCHEDULED Facebook posts never reach this
 * function at schedule time at all — see the publish route and
 * docs/SOCIAL-SCHEDULING.md: there is no real Meta scheduler to hand a mock
 * post to, so a mock Facebook schedule is queued the same way Instagram's
 * always is, and this function is called again — WITHOUT
 * scheduledPublishTime — by the cron at fire time instead, against
 * lib/social/mockMetaGraphClient.js. `simulateFailure` is demo-only, exactly
 * like publishToInstagram()'s own — see that function's doc comment.
 */
export async function publishToFacebook({
  connection,
  imageUrl,
  caption,
  fileSizeBytes,
  scheduledPublishTime,
  client,
  simulateFailure = null,
}) {
  if (!connection?.connected) {
    throw new PublishRefusal("not_connected", "Facebook isn't connected yet.");
  }
  if (!connection.pageId) {
    throw new PublishRefusal("no_page", "No Facebook Page is connected.");
  }

  const imageCheck = validateImageForFacebook({ fileSizeBytes });
  if (!imageCheck.ok) {
    throw new PublishRefusal("invalid_image", imageCheck.errors.join(","), { errors: imageCheck.errors });
  }

  if (scheduledPublishTime && !isValidFacebookScheduleTime(scheduledPublishTime)) {
    throw new PublishRefusal(
      "invalid_schedule",
      "Choose a time between 10 minutes and 75 days from now.",
    );
  }

  const postId = await client.publishFacebookPhoto({
    pageId: connection.pageId,
    pageAccessToken: connection.pageAccessToken,
    imageUrl,
    caption,
    scheduledPublishTime,
    simulateFailure,
  });
  if (!postId) {
    throw new PublishRefusal("publish_failed", "Meta did not return a post id.");
  }
  return { postId, status: scheduledPublishTime ? "scheduled" : "published" };
}

/**
 * Validates an Instagram SCHEDULE request without touching Meta at all — no
 * container is created here, deliberately: a container created now would sit
 * idle against Meta's 24-hour lifetime for however long is left until
 * `scheduledFor`, and expire before the real publish ever runs if that gap
 * is more than a few hours (docs/SOCIAL-SCHEDULING.md's container-timing
 * decision). The container is created at FIRE time instead, by the cron
 * calling publishToInstagram() itself — this function only decides whether
 * the request is even worth queuing.
 *
 * Reuses the exact same caption/image checks an immediate publish runs
 * (validateCaption, validateImageForInstagram) plus FieldQuo's own schedule
 * window (isValidScheduleTime — Instagram has no Meta-side window to defer
 * to, see that function's own comment) — so a caption that would fail today
 * fails now, at schedule time, rather than three days from now when nobody
 * is watching.
 *
 * Returns `{ ok, errors }` rather than throwing, same shape as
 * validateCaption/validateImageForInstagram — the caller (the publish
 * route) turns a `false` into the SAME PublishRefusal-shaped per-platform
 * result an immediate publish failure produces, so the UI doesn't need two
 * different failure shapes to render.
 */
export function validateInstagramSchedule({ caption, width, height, fileSizeBytes, scheduledFor, now }) {
  const errors = [];

  const captionCheck = validateCaption(caption);
  if (!captionCheck.ok) errors.push(...captionCheck.errors);

  const imageCheck = validateImageForInstagram({ width, height, fileSizeBytes });
  if (!imageCheck.ok) errors.push(...imageCheck.errors);

  if (!isValidScheduleTime(scheduledFor, now)) errors.push("invalid_schedule");

  return { ok: errors.length === 0, errors };
}
