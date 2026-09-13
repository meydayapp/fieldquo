// Harness stub: the pathname comes from ?path= so the shell lights the
// right tab; the router is inert.
const noop = () => {};
const params = () => new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
export function useRouter() { return { push: noop, replace: noop, back: noop, refresh: noop, prefetch: noop }; }
export function useParams() { return {}; }
export function usePathname() { return params().get("path") || "/app/me"; }
export function useSearchParams() { return params(); }
export function redirect() {}
