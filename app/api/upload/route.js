// app/api/upload/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Fail loudly on placeholder/missing config. Otherwise the request goes out
  // to /v1_1/your_cloud_name/... and Cloudinary answers "unknown API key",
  // which surfaces as an opaque 500 that looks like a code bug rather than a
  // setup step.
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const preset = process.env.CLOUDINARY_UPLOAD_PRESET;
  const unset = (v, placeholder) => !v || v === placeholder;

  if (unset(cloudName, "your_cloud_name") || unset(preset, "your_unsigned_preset")) {
    return NextResponse.json(
      {
        error:
          "Image uploads aren't configured. Set CLOUDINARY_CLOUD_NAME and CLOUDINARY_UPLOAD_PRESET (an unsigned preset) in .env, then restart the dev server.",
      },
      { status: 503 },
    );
  }

  const cloudForm = new FormData();
  cloudForm.append("file", file);
  cloudForm.append("upload_preset", preset);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    { method: "POST", body: cloudForm },
  );

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data.error?.message || "Upload failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.secure_url, publicId: data.public_id });
}
