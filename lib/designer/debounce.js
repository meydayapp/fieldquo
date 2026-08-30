// lib/designer/debounce.js
//
// Replaces the source clone's `lodash.debounce` dependency. The editor only
// ever needs the plain case — delay the last call in a burst by a fixed
// wait, no `leading`/`maxWait`/`flush` options anyone here calls — so
// pulling in lodash.debounce (and its `lodash` peer footprint) for one
// function was not worth the dependency.
//
// Pure, no fabric/DOM — importable from plain Node for
// scripts/check-designer.mjs.

/**
 * @param {(...args: any[]) => void} fn
 * @param {number} wait milliseconds
 * @returns {(...args: any[]) => void} a debounced wrapper around `fn`
 */
export function debounce(fn, wait) {
  let timer = null;

  return function debounced(...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, wait);
  };
}
