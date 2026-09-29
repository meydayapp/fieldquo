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
  checkImageForFacebookFeed,
  nextContainerAction,
  interpretRateLimit,
  isValidFacebookScheduleTime,
  isValidScheduleTime,
  isMetaGraphError,
  classifyMetaPublishError,
  describeMetaError,
  metaErrorFields,
} from "./metaSpecs";
// Relative, like the metaSpecs import above: this file is driven by check
// scripts under plain node as well as by the bundler.
import { MAX_SLIDES, MIN_CAROUSEL_SLIDES } from "../marketing/slides.js";

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

// What the contractor reads for each Meta refusal. English here, as every
// PublishRefusal message is; the modal translates by `code` and falls back to
// this. Meta's own text travels separately (metaDetail / meta) so neither has
// to be squeezed into the other.
const META_REFUSAL_MESSAGES = {
  meta_auth: "The Facebook & Instagram connection has expired or was revoked. Reconnect it in Settings.",
  meta_permission:
    "Meta says FieldQuo isn't allowed to post here. Reconnect Facebook & Instagram in Settings and allow every permission it asks for.",
  meta_account:
    "Instagram wouldn't accept a post for this account. Check in Meta Business Suite that it's a professional (Business or Creator) account, linked to this Facebook Page and not restricted, then reconnect in Settings.",
  meta_media_unreachable: "Instagram couldn't download the image. Nothing was posted. Try again.",
  meta_media_shape: "Instagram refused this image's shape — use Portrait 4:5 or Square. Nothing was posted.",
  meta_media_rejected: "Instagram refused this image (size, format or shape). Nothing was posted.",
  rate_limited: "This account has reached Meta's posting limit. Try again later.",
  meta_transient: "Meta had a temporary problem. Nothing was posted. Try again in a minute.",
  meta_error: "Meta refused the post. Nothing was posted.",
};

/**
 * Turns an error from the Graph client into a named PublishRefusal carrying
 * Meta's full answer; anything else is returned untouched for the caller to
 * rethrow. This is the fix for the 2026-09-28 incident: a Graph refusal used
 * to fall straight through to the route's catch-all and be stored as
 * "Unexpected error", with code 9004 / subcode 2207052 lost.
 */
function refusalFromMeta(err, stage, extra) {
  if (!isMetaGraphError(err)) return err;
  const { code, retryable } = classifyMetaPublishError(err);
  return new PublishRefusal(code, META_REFUSAL_MESSAGES[code] || META_REFUSAL_MESSAGES.meta_error, {
    retryable,
    stage,
    metaDetail: describeMetaError(err, stage),
    meta: metaErrorFields(err),
    ...extra,
  });
}

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
  carousel = null,
  client,
  sleep = defaultSleep,
  simulateFailure = null,
}) {
  // A carousel (2–10 images, lib/marketing/slides.js) replaces the single
  // image: every item is checked the way one image is, each becomes an item
  // container, and ONE carousel container carries the caption. Polling and
  // publishing that container is the same state machine as a single image's,
  // and Meta counts the carousel as one post against the publishing limit.
  const items = Array.isArray(carousel) && carousel.length >= MIN_CAROUSEL_SLIDES ? carousel : null;
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

  if (items && items.length > MAX_SLIDES) {
    throw new PublishRefusal("too_many_slides", `A carousel can have at most ${MAX_SLIDES} images.`);
  }
  for (const it of items || [{ width, height, fileSizeBytes }]) {
    const imageCheck = validateImageForInstagram({ width: it.width, height: it.height, fileSizeBytes: it.fileSizeBytes });
    if (!imageCheck.ok) {
      throw new PublishRefusal("invalid_image", imageCheck.errors.join(","), {
        errors: imageCheck.errors,
      });
    }
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

  let containerId;
  if (items) {
    const childIds = [];
    for (const it of items) {
      let childId;
      try {
        // eslint-disable-next-line no-await-in-loop
        childId = await client.createInstagramCarouselItem({
          igUserId: connection.instagramUserId,
          accessToken: connection.pageAccessToken,
          imageUrl: it.imageUrl,
        });
      } catch (err) {
        throw refusalFromMeta(err, "carousel_item");
      }
      if (!childId) throw new PublishRefusal("container_failed", "Meta did not return a carousel item id.");
      childIds.push(childId);
    }
    try {
      containerId = await client.createInstagramCarouselContainer({
        igUserId: connection.instagramUserId,
        accessToken: connection.pageAccessToken,
        childIds,
        caption,
      });
    } catch (err) {
      throw refusalFromMeta(err, "carousel_container");
    }
  } else {
    try {
      containerId = await client.createInstagramContainer({
        igUserId: connection.instagramUserId,
        accessToken: connection.pageAccessToken,
        imageUrl,
        caption,
      });
    } catch (err) {
      throw refusalFromMeta(err, "container");
    }
  }
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
    let statusCode;
    try {
      // eslint-disable-next-line no-await-in-loop
      statusCode = await client.getInstagramContainerStatus({
        containerId,
        accessToken: connection.pageAccessToken,
        simulateFailure,
      });
    } catch (err) {
      throw refusalFromMeta(err, "status", { containerId });
    }
    const decision = nextContainerAction(statusCode, attempt);

    if (decision.action === "publish") {
      let postId;
      try {
        // eslint-disable-next-line no-await-in-loop
        postId = await client.publishInstagramContainer({
          igUserId: connection.instagramUserId,
          accessToken: connection.pageAccessToken,
          containerId,
        });
      } catch (err) {
        throw refusalFromMeta(err, "publish", { containerId });
      }
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
 *
 * `width`/`height` feed the pre-post feed check (checkImageForFacebookFeed):
 * an image taller than 4:5 still posts, and the result carries
 * `warnings: ["feed_crop"]` so the contractor is told the feed will crop it.
 * The key is present ONLY when there is a warning, so a result for any image
 * the feed shows in full is byte-for-byte what it was before this check.
 */
export async function publishToFacebook({
  connection,
  imageUrl,
  caption,
  fileSizeBytes,
  width,
  height,
  scheduledPublishTime,
  carousel = null,
  client,
  simulateFailure = null,
}) {
  // A multi-photo post: each image uploaded unpublished (temporary when the
  // post is scheduled — Meta requires it), then one feed post attaching them.
  const items = Array.isArray(carousel) && carousel.length >= MIN_CAROUSEL_SLIDES ? carousel : null;
  if (!connection?.connected) {
    throw new PublishRefusal("not_connected", "Facebook isn't connected yet.");
  }
  if (!connection.pageId) {
    throw new PublishRefusal("no_page", "No Facebook Page is connected.");
  }

  if (items && items.length > MAX_SLIDES) {
    throw new PublishRefusal("too_many_slides", `A post can have at most ${MAX_SLIDES} images.`);
  }
  for (const it of items || [{ fileSizeBytes }]) {
    const imageCheck = validateImageForFacebook({ fileSizeBytes: it.fileSizeBytes });
    if (!imageCheck.ok) {
      throw new PublishRefusal("invalid_image", imageCheck.errors.join(","), { errors: imageCheck.errors });
    }
  }

  if (scheduledPublishTime && !isValidFacebookScheduleTime(scheduledPublishTime)) {
    throw new PublishRefusal(
      "invalid_schedule",
      "Choose a time between 10 minutes and 75 days from now.",
    );
  }

  if (items) {
    const mediaIds = [];
    for (const it of items) {
      let photoId;
      try {
        // eslint-disable-next-line no-await-in-loop
        photoId = await client.uploadFacebookUnpublishedPhoto({
          pageId: connection.pageId,
          pageAccessToken: connection.pageAccessToken,
          imageUrl: it.imageUrl,
          temporary: Boolean(scheduledPublishTime),
        });
      } catch (err) {
        throw refusalFromMeta(err, "facebook_photo_upload");
      }
      if (!photoId) throw new PublishRefusal("publish_failed", "Meta did not return a photo id.");
      mediaIds.push(photoId);
    }
    let feedPostId;
    try {
      feedPostId = await client.publishFacebookMultiPhoto({
        pageId: connection.pageId,
        pageAccessToken: connection.pageAccessToken,
        mediaIds,
        caption,
        scheduledPublishTime,
        simulateFailure,
      });
    } catch (err) {
      throw refusalFromMeta(err, "facebook_feed");
    }
    if (!feedPostId) throw new PublishRefusal("publish_failed", "Meta did not return a post id.");
    const { warnings } = checkImageForFacebookFeed({ width: items[0].width, height: items[0].height });
    return {
      postId: feedPostId,
      status: scheduledPublishTime ? "scheduled" : "published",
      ...(warnings.length ? { warnings } : {}),
    };
  }

  let postId;
  try {
    postId = await client.publishFacebookPhoto({
      pageId: connection.pageId,
      pageAccessToken: connection.pageAccessToken,
      imageUrl,
      caption,
      scheduledPublishTime,
      simulateFailure,
    });
  } catch (err) {
    throw refusalFromMeta(err, "facebook_photo");
  }
  if (!postId) {
    throw new PublishRefusal("publish_failed", "Meta did not return a post id.");
  }
  const { warnings } = checkImageForFacebookFeed({ width, height });
  return {
    postId,
    status: scheduledPublishTime ? "scheduled" : "published",
    ...(warnings.length ? { warnings } : {}),
  };
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
