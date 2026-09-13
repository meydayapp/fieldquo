// Harness stub for next/navigation. usePathname returns the href of the
// screen being photographed (set by guide.jsx from ?page=), so the sidebar's
// active-row logic — the real one — highlights the right row. useParams
// returns the row's `params` ({ id } for a detail page, { token } for a
// client link), which is what the App Router would have parsed from that
// href — a detail page reads its id from here and nowhere else.
//
// One router object for the life of the page, as the App Router's is: a
// page that lists `router` in an effect's dependencies (accept-invitation's
// loadInvite does) would otherwise re-run that effect on every render, and
// photograph "Loading…" forever.
const noop = () => {};
const ROUTER = { push: noop, replace: noop, back: noop, refresh: noop, prefetch: noop };
const EMPTY_SEARCH = new URLSearchParams("");
export function useRouter() { return ROUTER; }
export function useParams() { return (typeof window !== "undefined" && window.__harness?.params) || {}; }
export function usePathname() { return (typeof window !== "undefined" && window.__harness?.href) || "/app"; }
export function useSearchParams() { return EMPTY_SEARCH; }
export function redirect() {}
export function notFound() {}
