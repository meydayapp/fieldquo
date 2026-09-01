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
import {
  validateCaption,
  validateImageForInstagram,
  validateImageForFacebook,
  nextContainerAction,
  interpretRateLimit,
  isValidFacebookScheduleTime,
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
    .getInstagramPublishingLimit({ igUserId: connection.instagramUserId, accessToken: connection.pageAccessToken })
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
 */
export async function publishToFacebook({
  connection,
  imageUrl,
  caption,
  fileSizeBytes,
  scheduledPublishTime,
  client,
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
  });
  if (!postId) {
    throw new PublishRefusal("publish_failed", "Meta did not return a post id.");
  }
  return { postId, status: scheduledPublishTime ? "scheduled" : "published" };
}
