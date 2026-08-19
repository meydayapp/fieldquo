// app/api/self-quote/[companySlug]/upload/route.js
//
// Public. A homeowner filling in a self-quote can attach a photo, a short video
// or a PDF plan of the job — the pile to haul, the room to paint, the leak, the
// IKEA kitchen planner printout a cabinet client always has. It lands on
// the company's Cloudinary folder and comes back as a URL the browser then
// posts with the request, so the estimate carries the evidence and the reviewer
// can see what they're pricing.
//
// This endpoint takes an UNAUTHENTICATED upload, which is a quota risk (see the
// note that got /api/upload locked down). It's bounded three ways: the slug
// must resolve to a real company, every file goes through classifyMedia (type +
// size cap, no SVG), and one file per request. A rate limiter keyed on IP is
// the next hardening step and is noted in ROADMAP; today the company-scoped
// folder makes abuse auditable and deletable per tenant.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadBuffer } from "@/lib/cloudinary";
import { classifyMedia, uploadPublicId, safeFilename } from "@/lib/media/validate";

export async function POST(request, { params }) {
  const { companySlug } = await params;

  // Only a real tenant's slug opens the door — no open write endpoint.
  const company = await db.company.findUnique({
    where: { slug: companySlug },
    select: { id: true },
  });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    return NextResponse.json(
      { error: "Uploads aren't available right now." },
      { status: 503 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Same boundary as the staff path, minus SVG — a public form never needs a
  // vector, and a script vector is exactly what you don't want anonymous.
  const verdict = classifyMedia(file, { allowLogo: false });
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.error }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadBuffer(buffer, {
      // A sub-folder so lead-uploaded media is separable from the company's own
      // branding/gallery assets when auditing or purging.
      folder: `fieldquo/companies/${company.id}/leads`,
      resourceType: verdict.resourceType,
      // Documents only; see uploadPublicId. Never built from file.name — that
      // string is attacker-controlled and public_id is a path.
      publicId: uploadPublicId(verdict.kind),
    });
    return NextResponse.json({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      kind: verdict.kind,
      // Display-only, so the reviewer sees "kitchen-plan.pdf" rather than a
      // random id. Sanitised here, and again by normaliseMediaEntry on the way
      // into the database — the browser is free to post whatever it likes.
      filename: safeFilename(file.name),
    });
  } catch (err) {
    console.error("[self-quote/upload] Cloudinary error:", err?.message);
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  }
}
