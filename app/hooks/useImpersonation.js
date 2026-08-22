"use client";

// app/hooks/useImpersonation.js
//
// Is this session a support session, and whose?
//
// Extracted because two places need the answer and were about to ask
// separately: the banner across the top, and the sidebar's identity row —
// which showed the app user who happened to be signed in on that browser.
// QA opened a support session over a customer's account and the sidebar said
// "jonny", their own app login. Nothing on the page said whose account they
// were acting inside except the banner they had already scrolled past.
//
// One fetch, shared. Returns null while loading and while not impersonating,
// which are the same thing as far as every caller is concerned: render the
// normal UI.

import { useEffect, useState } from "react";

export function useImpersonation() {
  const [state, setState] = useState(null);

  useEffect(() => {
    let live = true;
    fetch("/api/impersonation/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setState(d?.active ? d : null))
      // Silent. A failed status check must not make the app look impersonated
      // when it isn't, and the read-only enforcement lives in middleware
      // regardless of what this component believes.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return state;
}
