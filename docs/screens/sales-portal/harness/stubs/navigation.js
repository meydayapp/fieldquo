// next/navigation for the portal harness: a replace() that updates the URL
// and re-renders useSearchParams readers, like the App Router does.
// usePathname answers the page being rendered, and useParams the id a detail
// page was opened with (window.__harnessParams).
//
// 2026-09-18: the pathname is a STORE, not a constant. A push() to an app
// path ("/sales/messages", from Text them on a live call) moves it, every
// usePathname reader re-renders, and portal.jsx's PageRouter swaps the page
// under the shipped SalesShell — which is what the App Router does, and
// what the "call survives navigation" scenes exist to prove: the shell, its
// providers and the call they hold stay mounted while the page changes.
import { useSyncExternalStore } from "react";
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => window.location.search;
let currentPath = null;
const pathSnapshot = () => currentPath || window.__harnessPath || "/sales";
/** Move the harness to another /sales page. Exposed for the scene driver. */
export function setHarnessPath(path) {
  currentPath = path;
  window.__harnessPath = path;
  notify();
}
if (typeof window !== "undefined") window.__harnessNavigate = (path) => setHarnessPath(path);
// An app path ("/sales/messages?thread=…") cannot be written into a
// file:// document's history (origin null → SecurityError, and the page's
// URL sync threw on every thread open). The harness keeps its own
// pathname and takes the QUERY the page wrote, merged over the harness's
// own params (page=, scene=, lang=) so the frame's identity survives.
function local(url) {
  const target = new URL(String(url), window.location.href);
  if (!/^\//.test(String(url))) return url;
  const next = new URLSearchParams(window.location.search);
  for (const k of ["thread", "with", "to", "compose", "filter", "prospectId", "tab", "open", "new", "phone"]) next.delete(k);
  target.searchParams.forEach((v, k) => next.set(k, v));
  return `${window.location.pathname}?${next.toString()}`;
}
function go(url, replace) {
  const str = String(url);
  const app = /^\/sales(\/|\?|$)/.test(str);
  window.history[replace ? "replaceState" : "pushState"]({}, "", local(url));
  if (app) currentPath = str.split("?")[0];
  if (app) window.__harnessPath = currentPath;
  notify();
}
export function useRouter() {
  return {
    push: (url) => go(url, false),
    replace: (url) => go(url, true),
    back: () => {}, refresh: () => {}, prefetch: () => {},
  };
}
export function useParams() { return window.__harnessParams || {}; }
export function usePathname() {
  return useSyncExternalStore(subscribe, pathSnapshot, () => "/sales");
}
export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, snapshot, () => "");
  return new URLSearchParams(search);
}
export function redirect() {}
export function notFound() {}
