// Harness stub for next/dynamic: React.lazy with the same loader.
import React, { Suspense, lazy } from "react";
export default function dynamic(loader, opts = {}) {
  const L = lazy(() => Promise.resolve(loader()).then((m) => (m.default ? m : { default: m })));
  const Fallback = opts.loading || (() => null);
  return function Dynamic(props) {
    return React.createElement(Suspense, { fallback: React.createElement(Fallback) }, React.createElement(L, props));
  };
}
