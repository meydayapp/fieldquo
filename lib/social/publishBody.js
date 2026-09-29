// lib/social/publishBody.js
//
// The body of one POST to app/api/marketing/designer/designs/[id]/publish —
// built in one place so the Publish dialog and scripts/check-design-
// templates.mjs build the SAME object.
//
// Why that matters: the owner's 2026-09-29 change (lib/marketing/
// destinations.js) moved the choice of format from a picker to a rule, and a
// design laid out as a square before 4:5 existed must publish exactly as it
// did. The check proves it by md5 of this function's output against the body
// the old dialog built, key order included — JSON.stringify of an object
// literal is order-sensitive, so the keys below are in the order the old
// dialog wrote them and must stay that way.
//
// Pure.

/**
 * @param {Object} args
 * @param {string} args.ratioKey
 * @param {string[]} args.platforms
 * @param {string} args.caption
 * @param {string} [args.imageBase64]    one image (every single-image post)
 * @param {string[]} [args.slideTokens]  a carousel: signed receipts, in order
 * @param {string} [args.scheduledFor]   ISO string
 * @param {string} [args.simulateFailure] demo only
 */
export function metaPublishBody({ ratioKey, platforms, caption, imageBase64, slideTokens, scheduledFor, simulateFailure }) {
  if (Array.isArray(slideTokens) && slideTokens.length > 1) {
    return { ratioKey, platforms, caption, slideTokens, scheduledFor, simulateFailure };
  }
  return { ratioKey, platforms, caption, imageBase64, scheduledFor, simulateFailure };
}
