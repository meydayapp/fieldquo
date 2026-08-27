// lib/jsonBody.js
//
// JSON.stringify, with an error that says WHERE.
//
// ══ Why ════════════════════════════════════════════════════════════════════
//
// A quote save died with:
//
//   JSON.stringify cannot serialize cyclic structures.
//
// That is JavaScriptCore's wording, so it only appears in Safari, and it names
// nothing: not the field, not the object, not which of the four bodies on the
// page was being built. Chrome's version ("Converting circular structure to
// JSON") at least prints a path; Safari's does not. Every stringify call site
// and every state setter on that screen was read line by line and all of them
// pass plain values — so the offending value is arriving from somewhere the
// code does not obviously admit to, and the only way to find it is for the
// failure to say so.
//
// This is the same lesson lib/fetchJson.js was written for: a browser's own
// message about a parse sent people hunting through regexes when the cause was
// an unset environment variable. A generic message from someone else's parser
// is not a diagnosis.
//
// ══ It refuses. It does not repair ═════════════════════════════════════════
//
// The tempting version of this drops the cycle and saves anyway. That would
// turn a loud failure into a quote silently missing a field — which is the
// failure this codebase is swept for, with the polarity reversed. A save that
// cannot represent what is on screen must not claim to have saved it.

/**
 * Find the first cyclic reference, as a readable path.
 *
 * Iterative rather than recursive: a takeoff with a deep nesting bug would blow
 * the stack on the way to reporting it, and "Maximum call stack size exceeded"
 * is a worse message than the one we are replacing.
 *
 * Tracks the ancestor chain, not every object seen. The same object appearing
 * twice in a payload — one shared price-book row on two line items — is legal
 * JSON and stringifies fine; only an object containing ITSELF is a cycle.
 * Treating repeats as cycles would fail correct saves, which is how a check
 * gets ignored.
 *
 * @returns {string|null} e.g. "scopeGroups[0].takeoff.sections[2]" or null
 */
export function findCycle(root) {
  const stack = [{ value: root, path: "", ancestors: new Set() }];

  while (stack.length) {
    const { value, path, ancestors } = stack.pop();
    if (value === null || typeof value !== "object") continue;
    if (ancestors.has(value)) return path || "(root)";

    // A copy per branch, so two siblings holding the same object are not
    // mistaken for a loop through it.
    const next = new Set(ancestors);
    next.add(value);

    if (Array.isArray(value)) {
      for (let i = value.length - 1; i >= 0; i--) {
        stack.push({ value: value[i], path: `${path}[${i}]`, ancestors: next });
      }
      continue;
    }

    // A DOM node or a React synthetic event is the usual culprit and is worth
    // naming outright — its own cycle is buried several hops down, and "this is
    // an event" is more useful to whoever reads the message than the hop that
    // happened to close the loop.
    const tag = describeUnserialisable(value);
    if (tag) return `${path || "(root)"} — ${tag}`;

    for (const key of Object.keys(value)) {
      stack.push({
        value: value[key],
        path: path ? `${path}.${key}` : key,
        ancestors: next,
      });
    }
  }

  return null;
}

/** Things that must never reach a request body, named in plain words. */
function describeUnserialisable(value) {
  if (typeof window !== "undefined") {
    if (typeof Node !== "undefined" && value instanceof Node) {
      return "a DOM element ended up in the payload";
    }
    if (typeof Event !== "undefined" && value instanceof Event) {
      return "a browser event ended up in the payload";
    }
    // Compared to `window` itself rather than `instanceof Window` — the lint
    // config runs over this file in a Node context where the global does not
    // exist, and an identity check needs no constructor.
    if (value === window) {
      return "the window object ended up in the payload";
    }
  }
  // React's synthetic event survives instanceof checks against Event in some
  // builds, so it is identified by shape instead.
  if (value?.nativeEvent && value?.target && typeof value?.preventDefault === "function") {
    return "a React event ended up in the payload";
  }
  return null;
}

/**
 * Serialise a request body, or throw an error a person can act on.
 *
 * @param label  which body this is, so a screen with four of them says which
 */
export function jsonBody(payload, label = "request") {
  try {
    return JSON.stringify(payload);
  } catch (err) {
    if (!/cyclic|circular|converting circular/i.test(String(err?.message))) throw err;
    const where = findCycle(payload);
    const detail = where
      ? `The problem is in "${where}".`
      : "The offending field could not be located.";
    const better = new Error(
      `This ${label} can't be saved: something on the page refers back to ` +
        `itself, so it can't be sent. ${detail} Nothing has been saved — ` +
        `please report this exact message.`,
    );
    better.cause = err;
    better.cyclePath = where;
    throw better;
  }
}
