// lib/cloudinary.js
import { v2 as cloudinary } from "cloudinary";
import { resizedUrl } from "@/lib/media/cloudinaryUrl";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Server-side upload from a Buffer (e.g. a generated PDF), not a browser File —
// the /api/upload route handles browser uploads via the unsigned preset instead.
export function uploadBuffer(
  buffer,
  { folder, publicId, resourceType = "auto" } = {},
) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
}

export async function deleteAsset(publicId, resourceType = "image") {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

// A resized variant of an image already uploaded to Cloudinary, via a URL
// transformation (`w_<width>,c_limit,q_auto,f_auto`) — see
// lib/media/cloudinaryUrl.js for the full rationale (lib/ai/images.js's
// vision-endpoint cost, the photo report PDF's embed size) and why the
// implementation itself lives there and not here: it's pure string surgery
// with no Cloudinary SDK dependency, which is what lets a "use client"
// component (the photo annotator) import it directly without pulling
// Node-only SDK code into a browser bundle. Re-exported here so every
// existing caller (`import { resizedUrl } from "@/lib/cloudinary"`) keeps
// working unchanged.
export { resizedUrl };

export { cloudinary };
