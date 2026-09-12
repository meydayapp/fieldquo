// Harness stub for next/link: a plain anchor. Nothing navigates in a
// screenshot, and the real Link needs the App Router context.
import React from "react";
export default function Link({ href, children, prefetch, scroll, replace, ...rest }) {
  return React.createElement("a", { href: typeof href === "string" ? href : "#", ...rest }, children);
}
