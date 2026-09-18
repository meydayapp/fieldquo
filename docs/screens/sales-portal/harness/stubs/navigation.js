// next/navigation for the portal harness: a replace() that updates the URL
// and re-renders useSearchParams readers, like the App Router does.
// usePathname answers the page being rendered (window.__harnessPath), and
// useParams the id a detail page was opened with (window.__harnessParams).
import { useSyncExternalStore } from "react";
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => window.location.search;
// An app path ("/sales/messages?thread=…") cannot be written into a
// file:// document's history (origin null → SecurityError, and the page's
// URL sync threw on every thread open). The harness keeps its own
// pathname and takes the QUERY the page wrote, merged over the harness's
// own params (page=, scene=, lang=) so the frame's identity survives.
function local(url) {
  const target = new URL(String(url), window.location.href);
  if (!/^\//.test(String(url))) return url;
  const next = new URLSearchParams(window.location.search);
  for (const k of ["thread", "with", "to", "compose", "filter", "prospectId", "tab"]) next.delete(k);
  target.searchParams.forEach((v, k) => next.set(k, v));
  return `${window.location.pathname}?${next.toString()}`;
}
export function useRouter() {
  return {
    push: (url) => { window.history.pushState({}, "", local(url)); notify(); },
    replace: (url) => { window.history.replaceState({}, "", local(url)); notify(); },
    back: () => {}, refresh: () => {}, prefetch: () => {},
  };
}
export function useParams() { return window.__harnessParams || {}; }
export function usePathname() { return window.__harnessPath || "/sales"; }
export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, snapshot, () => "");
  return new URLSearchParams(search);
}
export function redirect() {}
export function notFound() {}
