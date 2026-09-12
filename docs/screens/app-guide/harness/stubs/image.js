// Harness stub for next/image: a plain <img>. The logo files are read from
// public/ through a <base href> in the harness HTML.
import React from "react";
export default function Image({ src, alt = "", width, height, priority, fill, sizes, quality, placeholder, blurDataURL, unoptimized, ...rest }) {
  let s = typeof src === "string" ? src : src?.src;
  if (s && s.startsWith("/")) s = "file:///Users/emilioboves/StudioProjects/fieldquo/public" + s;
  return React.createElement("img", { src: s, alt, width, height, ...rest });
}
