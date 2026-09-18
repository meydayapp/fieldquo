// Harness stub of next/navigation. router.replace rewrites the query string
// in place so ?open= follows the selection the way the real page keeps it.
export function useRouter() {
  return {
    push: (href) => { window.location.href = href; },
    replace: (href) => { window.history.replaceState(null, "", href); },
    back: () => {}, refresh: () => {}, prefetch: () => {},
  };
}
export function useParams() { return {}; }
export function usePathname() { return "/sales/threads"; }
export function useSearchParams() { return new URLSearchParams(typeof window !== "undefined" ? window.location.search : ""); }
export function redirect() {}
