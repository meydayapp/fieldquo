const noop = () => {};
export function useRouter() { return { push: noop, replace: noop, back: noop, refresh: noop, prefetch: noop }; }
export function useParams() { return {}; }
export function usePathname() { return new URLSearchParams(window.location.search).get("path") || "/platform/sales/payouts"; }
export function useSearchParams() { return new URLSearchParams(window.location.search); }
export function redirect() {}
