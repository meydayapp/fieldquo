// next/navigation for the portal harness: a replace() that updates the URL
// and re-renders useSearchParams readers, like the App Router does.
// usePathname answers the page being rendered (window.__harnessPath), and
// useParams the id a detail page was opened with (window.__harnessParams).
import { useSyncExternalStore } from "react";
const listeners = new Set();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => window.location.search;
export function useRouter() {
  return {
    push: (url) => { window.history.pushState({}, "", url); notify(); },
    replace: (url) => { window.history.replaceState({}, "", url); notify(); },
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
