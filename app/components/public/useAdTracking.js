// app/components/public/useAdTracking.js
//
// Everything a company's public funnel or instant estimate does about
// tracking, in one hook, so the two pages cannot drift apart:
//
//   1. First-party step counts — one FunnelVisit per visit, opened with the
//      landing's utm_* / click id / referrer host and moved forward as the
//      visitor reaches each step (app/api/funnel-visit). No cookie: the
//      visit's token lives in this tab's sessionStorage and nowhere else.
//   2. The partial lead — contact details posted, debounced, once the page
//      has rendered the "we save what you type" notice (lib/tracking/
//      partial.js says why the notice is the condition).
//   3. The company's ad pixels — loaded only when the company set an id,
//      only that company's ids, and, when the company switched "ask first"
//      on, only after the visitor accepts. The choice is remembered per
//      company in localStorage; nothing else is.
//   4. First touch — every visit token this tab is issued is added to
//      sessionStorage "fq.touch" (lib/tracking/touches.js), and posted with
//      the next page's landing, so the booking page or instant estimate a
//      visitor reaches from the company's website inherits the ad that
//      brought them there. Same storage, same lifetime as the token itself.
//
// The booking page and the website use this hook for 1 and 4 only: they
// pass no pixels and render no "we save what you type" notice, so nothing
// else happens on them (pixel events there stay exactly as they were:
// none).
//
// ── Not on a developer's laptop ────────────────────────────────────────────
//
// A local `npm run dev` runs against the production database (.env is a copy
// of the deployment's), so a developer clicking through a demo funnel would
// write visits and partial leads into a real company's report. Beacons are
// skipped on localhost unless localStorage["fieldquo:track-local"] is "1" —
// the same opt-in lib/analytics/track.js uses. The PIXELS still load
// locally: they go to the company's own ad account, and seeing them fire is
// how a developer checks this works.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readLanding } from "@/lib/tracking/landing";
import { validPixelIds, injectPixelScripts, firePixelEvent } from "@/lib/funnels/pixels";
import { PARTIAL_DEBOUNCE_MS } from "@/lib/tracking/partial";
import { readTouches, rememberTouch } from "@/lib/tracking/touches";

const consentKey = (slug) => `fq.adConsent.${slug}`;
const tokenKey = (surface, slug, funnelSlug) => `fq.visit.${surface}.${slug}.${funnelSlug || ""}`;

// Two tracked surfaces can be on one page — the website and its booking
// block. The second one's landing must wait for the first one's token to
// be in "fq.touch", or it would read an empty list and count the same
// arrival twice. One gate per page load, bounded so a slow beacon never
// holds another page's count hostage.
let landingGate = Promise.resolve();
const LANDING_WAIT_MS = 2000;

function isLocalDev() {
  try {
    const h = window.location.hostname;
    if (h !== "localhost" && h !== "127.0.0.1" && !h.endsWith(".localhost")) return false;
    return window.localStorage.getItem("fieldquo:track-local") !== "1";
  } catch {
    return true;
  }
}

function readStore(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    /* private window, blocked storage — the page works without it */
  }
}

/** Contact details worth posting yet: an address with an @, or seven digits. */
function worthCapturing(c) {
  const email = typeof c?.email === "string" && /\S+@\S+\.\S+/.test(c.email.trim());
  const phone = typeof c?.phone === "string" && c.phone.replace(/\D/g, "").length >= 7;
  return email || phone;
}

/**
 * @param ready            false until the page has its payload; nothing is
 *                         posted or loaded before then.
 * @param companySlug      the slug the page was reached on.
 * @param surface          "funnel" | "instant_quote" | "booking" | "website"
 *                         (for the website, companySlug is its subdomain)
 * @param funnelSlug       the funnel's slug (funnel surface only).
 * @param pixels           { meta, ga4, tiktok } from the public payload.
 * @param consentRequired  the company's "ask before loading ad pixels".
 * @param language         the page's language, stored on the visit.
 * @param ownLanding       false when this surface is a PART of another
 *                         tracked page (the website's booking block): its
 *                         URL is that page's URL, already counted as the
 *                         landing, so it posts none and inherits that visit's
 *                         instead.
 */
export function useAdTracking({ ready, companySlug, surface, funnelSlug = null, pixels = null, consentRequired = false, language = null, ownLanding = true }) {
  const tokenRef = useRef(null);
  const chainRef = useRef(Promise.resolve());
  const stepsSentRef = useRef(new Set());
  const startedRef = useRef(false);
  const contactTimerRef = useRef(null);
  const contactFpRef = useRef("");
  const localRef = useRef(null);

  const ids = useMemo(() => validPixelIds(pixels || {}), [pixels]);
  const hasPixel = Boolean(ids.meta || ids.ga4 || ids.tiktok);

  // "unknown" until read on the client, then "yes" | "no" | "ask".
  const [consent, setConsent] = useState("unknown");
  const [pixelsLive, setPixelsLive] = useState(false);

  const local = () => {
    if (localRef.current === null) localRef.current = typeof window === "undefined" ? true : isLocalDev();
    return localRef.current;
  };

  // Every beacon goes through one chain, so the token the first answer
  // carries is known before the second is sent. A payload may be a
  // function, evaluated when its turn comes — the landing's `touches` must
  // be read after the gate above opens, not when the effect ran.
  const post = useCallback(
    (payloadOrFn) => {
      if (typeof window === "undefined" || local()) return;
      chainRef.current = chainRef.current
        .then(async () => {
          const payload = typeof payloadOrFn === "function" ? payloadOrFn() : payloadOrFn;
          const res = await fetch(`/api/funnel-visit/${encodeURIComponent(companySlug)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({
              surface,
              funnelSlug,
              language,
              token: tokenRef.current,
              ...payload,
            }),
          });
          const d = await res.json().catch(() => null);
          if (d?.token && d.token !== tokenRef.current) {
            tokenRef.current = d.token;
            writeStore(window.sessionStorage, tokenKey(surface, companySlug, funnelSlug), d.token);
            rememberTouch(d.token);
          }
        })
        // Measurement is never the visitor's problem.
        .catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [companySlug, surface, funnelSlug, language],
  );

  // ── Open (or resume) the visit ─────────────────────────────────────────
  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const stored = readStore(window.sessionStorage, tokenKey(surface, companySlug, funnelSlug));
    if (stored && /^[A-Za-z0-9_-]{32}$/.test(stored)) tokenRef.current = stored;
    if (stepsSentRef.current.has("landed")) return;
    stepsSentRef.current.add("landed");
    if (local()) return;
    const prior = landingGate;
    let release = () => {};
    landingGate = new Promise((resolve) => {
      release = resolve;
    });
    chainRef.current = chainRef.current.then(() =>
      Promise.race([prior, new Promise((resolve) => setTimeout(resolve, LANDING_WAIT_MS))]),
    );
    post(() => ({
      step: "landed",
      landing: ownLanding ? readLanding(window.location.search, document.referrer) : {},
      // Read when the gate opens, before this visit's own token joins the
      // list. Only used by the server when the visit is new and its landing
      // carries nothing of its own.
      touches: readTouches(),
    }));
    chainRef.current = chainRef.current.then(release, release);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, companySlug, surface, funnelSlug, post, ownLanding]);

  // ── Consent, then the pixels ───────────────────────────────────────────
  useEffect(() => {
    if (!ready || !hasPixel || typeof window === "undefined") return;
    if (!consentRequired) {
      setConsent("yes");
      return;
    }
    const saved = readStore(window.localStorage, consentKey(companySlug));
    setConsent(saved === "yes" ? "yes" : saved === "no" ? "no" : "ask");
  }, [ready, hasPixel, consentRequired, companySlug]);

  useEffect(() => {
    if (consent !== "yes" || !hasPixel) return;
    injectPixelScripts(ids);
    setPixelsLive(true);
  }, [consent, hasPixel, ids]);

  const accept = useCallback(() => {
    writeStore(window.localStorage, consentKey(companySlug), "yes");
    setConsent("yes");
  }, [companySlug]);
  const decline = useCallback(() => {
    writeStore(window.localStorage, consentKey(companySlug), "no");
    setConsent("no");
  }, [companySlug]);

  // ── Steps ──────────────────────────────────────────────────────────────
  /** Report a step by name, once per visit. `trade` rides along on the instant estimate. */
  const reportStep = useCallback(
    (step, extra = {}) => {
      if (!ready || !step) return;
      const key = `${step}:${extra.trade || ""}`;
      if (stepsSentRef.current.has(key)) return;
      stepsSentRef.current.add(key);
      post({ step, ...(extra.trade ? { trade: extra.trade } : {}) });
    },
    [ready, post],
  );

  /** Fire an ad event on the loaded pixels. A no-op until they are live. */
  const fire = useCallback(
    (event, opts = {}) => (pixelsLive ? firePixelEvent(ids, event, opts) : []),
    [pixelsLive, ids],
  );

  /**
   * ViewContent, once per page load, when the visitor first gets past the
   * opening screen. Not spent while the pixels are not live yet (the visitor
   * has not answered the consent question): the next step retries it.
   */
  const markStarted = useCallback(
    (params = {}) => {
      if (startedRef.current || !pixelsLive) return;
      startedRef.current = true;
      fire("ViewContent", { params });
    },
    [fire, pixelsLive],
  );

  // ── The partial lead ─────────────────────────────────────────────────
  const captureContact = useCallback(
    (contact) => {
      if (!ready || !worthCapturing(contact)) return;
      const body = {
        name: (contact.name || "").trim().slice(0, 120),
        email: (contact.email || "").trim().slice(0, 254),
        phone: (contact.phone || "").trim().slice(0, 40),
        notice: true,
      };
      const fp = JSON.stringify(body);
      if (fp === contactFpRef.current) return;
      if (contactTimerRef.current) clearTimeout(contactTimerRef.current);
      contactTimerRef.current = setTimeout(() => {
        contactFpRef.current = fp;
        post({ contact: body });
      }, PARTIAL_DEBOUNCE_MS);
    },
    [ready, post],
  );

  useEffect(
    () => () => {
      if (contactTimerRef.current) clearTimeout(contactTimerRef.current);
    },
    [],
  );

  /** The visit's token, for the submit body — so the lead inherits the landing. */
  const visitToken = useCallback(() => tokenRef.current, []);

  /**
   * Wait for queued beacons (the landing post above all) to settle, bounded,
   * so a submit on a fast click still carries the token.
   */
  const settled = useCallback(
    (ms = 1500) => Promise.race([chainRef.current, new Promise((r) => setTimeout(r, ms))]),
    [],
  );

  return {
    reportStep,
    markStarted,
    captureContact,
    fire,
    visitToken,
    settled,
    pixelsLive,
    askConsent: consent === "ask",
    accept,
    decline,
  };
}
