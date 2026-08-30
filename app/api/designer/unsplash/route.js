// app/api/designer/unsplash/route.js
//
// Server-side proxy for the Image sidebar's stock-photo tab — see
// lib/designer/unsplash.js for why this can't be a direct browser call.
// Free: no feature gate, no spend check.
//
// Mirrors app/api/settings/voice/voices/route.js's "not_configured" vs
// "unavailable" distinction exactly: the first means this deployment never
// set the key (an operator problem, named as one); the second means the key
// exists but Unsplash didn't answer (a transient problem, retry later).
// Conflating either with "no images found" would tell a contractor to try a
// different search when there is no search to try — AGENTS.md treats that
// kind of mismatched error message as a bug in its own right.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { unsplashConfigured, fetchRandomStockPhotos } from "@/lib/designer/unsplash";

export async function GET(request) {
  const { response } = await memberOrRefusal(request);
  if (response) return response;

  if (!unsplashConfigured()) {
    return NextResponse.json({ images: [], reason: "not_configured" });
  }

  let photos = null;
  try {
    photos = await fetchRandomStockPhotos();
  } catch (err) {
    console.error("[designer/unsplash] provider error:", err?.message);
    return NextResponse.json({ images: [], reason: "unavailable" });
  }

  // Only the fields ImageSidebar renders: a thumbnail, a full-res URL to add
  // to the canvas, attribution (Unsplash's API guidelines require crediting
  // the photographer wherever a photo is used), and the id for the React key.
  const images = photos.map((p) => ({
    id: p.id,
    thumbUrl: p?.urls?.small,
    fullUrl: p?.urls?.regular,
    altDescription: p?.alt_description || "Stock photo",
    photographerName: p?.user?.name,
    photographerUrl: p?.user?.links?.html,
  }));

  return NextResponse.json({ images });
}
