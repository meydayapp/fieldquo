// app/api/upload/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";

export async function POST(request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const cloudForm = new FormData();
  cloudForm.append("file", file);
  cloudForm.append("upload_preset", process.env.CLOUDINARY_UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
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
