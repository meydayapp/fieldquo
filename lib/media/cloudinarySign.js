// lib/media/cloudinarySign.js
//
// The download-link signer the file routes inject into lib/media/fileOpen.js,
// or null when this deployment has no Cloudinary credentials — a null signer
// is answered "storage isn't configured", never a link that 401s.
//
// Server-only: it holds the SDK and, through it, the API secret.
import { cloudinary } from "@/lib/cloudinary";

export function cloudinarySigner() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return null;
  return (publicId, format, options) => cloudinary.utils.private_download_url(publicId, format, options);
}
