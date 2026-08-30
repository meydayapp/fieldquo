// lib/ai/images.js
//
// Generating ONE marketing image — through lib/ai/provider.js, the only file
// allowed to talk to the vendor. This module's job is everything AROUND that
// call: resizing a reference photo before it's sent, and turning the vendor's
// base64 bytes back into a durable Cloudinary URL the rest of the product can
// store and render like any other photo.
//
// ══ One generation per creative, never one per aspect ratio ════════════════
//
// A campaign wants the same advert as a square post, a Story and a landscape
// banner. The expensive way is to call this three times; the right way is to
// call it ONCE and let lib/marketing/ratios.js reflow() lay the same artwork
// out three times, which is what an editor is for. Three generations of one
// idea would also come back as three DIFFERENT pictures — the "same advert,
// three shapes" promise the ratio system exists to keep would already be
// broken before the editor opened. So: this function is called once per
// creative. Whatever calls it three times for three ratios is the bug, not
// this file.
//
// ══ Why the reference is resized before it's sent ══════════════════════════
//
// See lib/cloudinary.js's resizedUrl for the mechanism. The reason it belongs
// HERE and not in provider.js: provider.js's job is "talk to the vendor" and
// nothing else, and deciding how big a photo needs to be before it's worth
// sending is a product decision about THIS feature, not a vendor concern.
import { generateImage } from "./provider";
import { uploadBuffer, resizedUrl } from "@/lib/cloudinary";

// Wide enough for what gpt-image-1's edit endpoint can actually use (it tops
// out at 1536px on its long edge), narrow enough that the download-then-
// upload round trip this function does is fast on a driveway connection. This
// is the number lib/cloudinary.js's "~85% fewer pixels" comment is measured
// against — change one, check the other still holds.
const REFERENCE_WIDTH = 1536;

/**
 * Downloads an already-uploaded photo, resized on the way out by Cloudinary
 * itself rather than after the fact here — see lib/cloudinary.js.
 *
 * Throws rather than degrading: a reference photo that can't be fetched is a
 * different failure from "the model declined", and the route above decides
 * separately what to tell the contractor and what to refund either way.
 */
async function fetchReference(url) {
  const res = await fetch(resizedUrl(url, { width: REFERENCE_WIDTH }));
  if (!res.ok) {
    throw new Error(`Couldn't fetch the reference photo (${res.status}).`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, type: res.headers.get("content-type") || "image/jpeg" };
}

/**
 * @param prompt              required — what to generate
 * @param referencePhotoUrl   an existing Cloudinary photo URL to build FROM,
 *                             or null for an unconditioned generation
 * @param onUsage             passed straight through to provider.js
 * @returns { url, model } — `url` is a NEW Cloudinary asset holding the
 *          generated image, never the vendor's own (ephemeral, unsigned) URL —
 *          or null when AI is unconfigured or the vendor refused. The caller
 *          (the API route) is the one that reserved credit before calling
 *          this, so a null return is its signal to refund rather than charge.
 */
export async function generateMarketingImage({ prompt, referencePhotoUrl = null, onUsage }) {
  if (typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("A prompt is required.");
  }

  let referenceImageBuffer = null;
  let referenceImageType;
  if (referencePhotoUrl) {
    const ref = await fetchReference(referencePhotoUrl);
    referenceImageBuffer = ref.buffer;
    referenceImageType = ref.type;
  }

  const result = await generateImage({
    prompt,
    referenceImageBuffer,
    referenceImageType,
    onUsage,
  });
  if (!result?.b64Json) return null;

  const uploaded = await uploadBuffer(Buffer.from(result.b64Json, "base64"), {
    folder: "marketing-generated",
    resourceType: "image",
  });

  return { url: uploaded.secure_url, model: result.model };
}
