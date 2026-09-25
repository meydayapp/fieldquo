// scripts/stub-next-dynamic.js
//
// next/dynamic, for scripts/check-signup-aside.mjs only.
//
// The signup panel loads each sample as its own chunk (app/components/auth/
// samples/index.js). A server render has nothing to load — the real
// next/dynamic with ssr:false renders its placeholder — so the check reads
// WHICH sample a step asks for, and with what props, from the element tree
// signupPanelFor returns, and renders each sample component directly by
// importing it. This stub makes the lazy wrapper render nothing, so the
// panel's own markup is what the panel draws and no chunk is pretended.
//
// Wired in through esbuild's --alias, so nothing in the app can reach it.
export default function dynamic() {
  return function DynamicStub() {
    return null;
  };
}
