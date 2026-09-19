export const uploads = [];
export async function uploadBuffer(buffer, opts) {
  uploads.push({ bytes: buffer.length, ...opts });
  return { secure_url: `https://res.cloudinary.com/democloud/raw/upload/v1/${opts.publicId}.pdf`, public_id: opts.publicId, bytes: buffer.length };
}
export async function deleteAsset() {}
export const cloudinary = {};
export function resizedUrl(u) {
  return u;
}
