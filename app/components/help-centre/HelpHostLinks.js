// app/components/help-centre/HelpHostLinks.js
//
// On help.fieldquo.com every statically rendered link still reads
// /help/<lang>/… (lib/help/urls.js says why: the pages are built once and
// serve on two hosts). middleware.js turns such a path on this host into a
// 308 to the short spelling, which is correct for a crawler and costs a real
// visitor one extra round trip per click.
//
// This removes that round trip for people, not crawlers: on the help host
// only, a click on an internal /help/… link is turned into a client-side
// navigation to the short path. Capture phase, so it runs before next/link's
// own handler; modified clicks (new tab, middle button) are left alone so the
// browser does what the person asked; anything that is not a plain
// same-origin /help/… anchor is ignored. Renders nothing.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HelpHostLinks() {
  const router = useRouter();
  useEffect(() => {
    if (!window.location.hostname.startsWith("help.")) return undefined;
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      let url;
      try {
        url = new URL(a.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (!(url.pathname === "/help" || url.pathname.startsWith("/help/"))) return;
      e.preventDefault();
      router.push(`${url.pathname.slice("/help".length) || "/"}${url.search}${url.hash}`);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [router]);
  return null;
}
