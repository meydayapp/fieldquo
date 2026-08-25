// scripts/stub-next-navigation.js
//
// next/navigation, for scripts/check-takeoff-render.jsx only.
//
// useRouter() throws "invariant expected app router to be mounted" outside a
// real Next request, so a component that navigates cannot be rendered to static
// markup at all — and the quote builder navigates, because saving a quote ends
// on the quote. Stubbing the hooks is what lets the check render the screen it
// exists to check.
//
// Deliberately inert rather than recording: this check is about whether the
// markup comes out, not about where a click would go. Navigation is asserted
// from the source in scripts/check-quote-builder.mjs instead.
//
// Wired in through esbuild's --alias, so nothing in the app can reach it.
const noop = () => {};

export function useRouter() {
  return {
    push: noop,
    replace: noop,
    back: noop,
    forward: noop,
    refresh: noop,
    prefetch: noop,
  };
}

export function useParams() {
  return {};
}

export function usePathname() {
  return "/";
}

export function useSearchParams() {
  return new URLSearchParams();
}

export function redirect() {}
export function notFound() {}
