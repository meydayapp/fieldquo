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
  const asset = ASSETS[variant] || ASSETS.horizontal;
  const ratio = asset.width / asset.height;

  const mark =
    onDark && variant !== "icon" ? (
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
