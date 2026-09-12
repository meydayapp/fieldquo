// next/navigation for the harness: a replace() that updates the URL and
// re-renders useSearchParams readers, like the App Router does.
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
export function useParams() { return {}; }
export function usePathname() { return window.__harnessPath || "/sales/queue"; }
export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, snapshot, () => "");
  return new URLSearchParams(search);
}
export function redirect() {}
