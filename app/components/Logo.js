// app/components/Logo.js
//
// The FieldQuo mark, in its three supplied variants.
//
// One component rather than scattered <img> tags so that swapping an asset,
// fixing an aspect ratio or adding a dark-mode variant happens once.
//
// Uses next/image for the automatic width/height that prevents layout shift —
// a logo that pops in after paint moves the entire header down, which is the
// first thing anyone sees.
//
// A note on dark mode: the wordmark's navy (#06356b) is dark, and on the dark
// theme's #0a1220 page it would nearly disappear. Rather than ship a second
// set of files, the `onDark` variant renders the icon beside live text using
// the current foreground token — the icon's orange arrow carries fine on
// either background, and the word is just type.
//
// ── The real dark asset, when it exists ─────────────────────────────────────
//
// That composition is a stand-in, not the preference. The moment a proper
// light-ink wordmark exists it should be used instead, at exactly:
//
//     public/logo/FieldQuo_logo_horizontal_outlined_dark.png
//
// It is NOT in the repo today — public/logo/ holds only FieldQuo_icon.png,
// FieldQuo_logo_horizontal_outlined.png and FieldQuo_logo_vertical_outlined.png
// — so DARK_HORIZONTAL below is null and every `onDark` caller keeps the
// composed mark.
//
// Presence is a build-time constant rather than a runtime probe on purpose.
// Fetching the URL to see whether it 404s means either a broken-image flash or
// a logo that pops in after paint, and this mark sits in the first thing anyone
// sees. scripts/check-sidebar.mjs asserts the constant and public/logo/ agree
// in both directions, so dropping the file in without wiring it fails a check
// instead of being quietly ignored, and pointing at a missing file fails too.
//
// ── Which surfaces are "dark" ───────────────────────────────────────────────
//
// `onDark` means THE SURFACE IS DARK, not "the dark theme is on". The sidebar
// is navy (#06356b) in light mode and near-black (#081729) in dark, so it
// passes onDark in both — a theme-following swap there would put the navy
// wordmark on navy chrome in light mode, which is the invisibility this whole
// note exists to avoid.
"use client";

import Image from "next/image";
import Link from "next/link";

const ASSETS = {
  // Measured from the files, not guessed. next/image uses these to reserve
  // space before the image loads; wrong numbers mean a squashed mark and a
  // layout shift on every first paint.
  icon: {
    src: "/logo/FieldQuo_icon.png",
    width: 464,
    height: 360,
  },
  horizontal: {
    src: "/logo/FieldQuo_logo_horizontal_outlined.png",
    width: 1200,
    height: 360,
  },
  vertical: {
    src: "/logo/FieldQuo_logo_vertical_outlined.png",
    width: 850,
    height: 516,
  },
};

// The light-ink horizontal wordmark for dark surfaces. null until the asset
// ships; fill in `{ src, width, height }` with dimensions MEASURED from the
// file, not guessed — next/image reserves space from these, and wrong numbers
// mean a squashed mark and a layout shift on first paint. check:sidebar
// enforces that this matches what is actually in public/logo/.
const DARK_HORIZONTAL = null;

/**
 * @param variant  "horizontal" | "vertical" | "icon"
 * @param height   rendered height in px; width follows the aspect ratio
 * @param href     wraps in a link when set; pass null for a bare mark
 * @param onDark   composes icon + live text instead of the flat artwork, so
 *                 the navy wordmark doesn't vanish on a dark surface
 */
export default function Logo({
  variant = "horizontal",
  height = 32,
  href = "/",
  onDark = false,
  className = "",
  priority = false,
}) {
  // On a dark surface, prefer the real light-ink artwork over the composition.
  // Falls through to `asset` when DARK_HORIZONTAL is null, which is today.
  const darkAsset = onDark && variant === "horizontal" ? DARK_HORIZONTAL : null;
  const asset = darkAsset || ASSETS[variant] || ASSETS.horizontal;
  const ratio = asset.width / asset.height;

  const mark =
    onDark && !darkAsset && variant !== "icon" ? (
      <span className={`inline-flex items-center gap-2.5 ${className}`}>
        <Image
          src={ASSETS.icon.src}
          alt=""
          width={ASSETS.icon.width}
          height={ASSETS.icon.height}
          priority={priority}
          style={{ height, width: height * (ASSETS.icon.width / ASSETS.icon.height) }}
          aria-hidden="true"
        />
        <span
          className="font-bold tracking-tight text-current"
          style={{ fontSize: height * 0.62 }}
        >
          Field<span className="text-brand-accent">Quo</span>
        </span>
      </span>
    ) : (
      <Image
        src={asset.src}
        alt="FieldQuo"
        width={asset.width}
        height={asset.height}
        priority={priority}
        className={className}
        style={{ height, width: height * ratio }}
      />
    );

  if (!href) return mark;

  return (
    <Link href={href} className="inline-flex items-center" aria-label="FieldQuo">
      {mark}
    </Link>
  );
}
