const noop = () => {};
export function useRouter() { return { push: noop, replace: noop, back: noop, refresh: noop, prefetch: noop }; }
export function useParams() { return {}; }
export function usePathname() { return "/sales/messages"; }
export function useSearchParams() { return new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""); }
export function redirect() {}
