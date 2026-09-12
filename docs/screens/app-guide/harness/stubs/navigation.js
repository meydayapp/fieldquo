// Harness stub for next/navigation. usePathname returns the href of the
// screen being photographed (set by guide.jsx from ?page=), so the sidebar's
// active-row logic — the real one — highlights the right row.
const noop = () => {};
export function useRouter() { return { push: noop, replace: noop, back: noop, refresh: noop, prefetch: noop }; }
export function useParams() { return {}; }
export function usePathname() { return (typeof window !== "undefined" && window.__harness?.href) || "/app"; }
export function useSearchParams() { return new URLSearchParams(""); }
export function redirect() {}
export function notFound() {}
