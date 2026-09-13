// Harness stub for next/image: a plain <img>. A "/logo.svg" path resolves
// against the page's origin, which shoot.mjs serves from public/ — the same
// place the deployed app serves it from.
import React from "react";
export default function Image({ src, alt = "", width, height, priority, fill, sizes, quality, placeholder, blurDataURL, unoptimized, ...rest }) {
  const s = typeof src === "string" ? src : src?.src;
  return React.createElement("img", { src: s, alt, width, height, ...rest });
}
