const noop = () => {};
export function useRouter() { return { push: noop, replace: noop, back: noop, refresh: noop, prefetch: noop }; }
export function useParams() { return {}; }
export function usePathname() {
  const p = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("path") : null;
  return p || "/app/me/schedule";
}
export function useSearchParams() { return new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""); }
export function redirect() {}
