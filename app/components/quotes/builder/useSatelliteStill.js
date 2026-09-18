// app/components/quotes/builder/useSatelliteStill.js
//
// The satellite still a measure panel draws on, and the one place its zoom
// and address change.
//
// Until 2026-09-18 the still was fetched once per QUOTE, off the selected
// client's address, in QuoteBuilder, and handed down to the paving designer
// and the lawn tracer. The roof panel had its own address box because the
// roof being re-roofed is frequently not the address the invoice goes to —
// and that is just as true of a driveway or a lawn. So the still now belongs
// to the TAKEOFF: each panel holds its own through this hook, from the
// address the estimator chose, at the zoom they chose, and the takeoff stores
// both (`measureAddress`, `measureFrame`) so a reopened quote rebuilds the
// exact picture its drawing was traced on.
//
// ── What costs money here ───────────────────────────────────────────────────
//
// Two Google calls sit behind this hook. measure() geocodes an address (one
// billed request) and the <img> that follows is one billed still. reframe()
// — the − / + buttons — is arithmetic on a request the browser already holds
// (lib/measure/imageScale.js) and makes NO call of its own; the <img> at the
// new zoom is the one billed still per tap. Reopening a quote with a stored
// frame geocodes nothing: the frame is the request, and the browser has the
// bytes cached for a day.
//
// A module-level cache keeps two groups on one quote from geocoding the same
// address twice; it is keyed on what the route is asked, not on what it
// answers, and is never persisted.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import {
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
  MAX_TILE_PX,
  DEFAULT_SCALE,
  imageScale,
  satelliteProxyPath,
  stillFrame,
} from "@/lib/measure/imageScale";
import { VIEW_W, VIEW_H } from "./PolygonMeasure";

/**
 * The zoom a drawing was traced at when its takeoff carries no frame.
 *
 * Every paver design and lot outline saved before 2026-09-18 was traced on
 * a zoom-20, 640×640, scale-2 still centred on the geocoded client address
 * — that was the only still there was. Those drawings are in viewBox units
 * and mean nothing on any other picture: shown on today's zoom-18 default
 * they would sit four times too small and, worse, MEASURE sixteen times too
 * small, because the scale that applies to a vertex is the still's. So a
 * takeoff with shapes and no frame is fetched at 20, and the frame is written
 * the moment it lands so it is pinned from then on.
 */
export const LEGACY_LOT_ZOOM = 20;

const inflight = new Map();

const clampZoom = (z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(Number(z) || DEFAULT_ZOOM)));

/** A still object from a stored frame — pure, no network. Null for a bad frame. */
export function stillFromFrame(frame, formattedAddress = "") {
  const f = stillFrame(frame);
  if (!f) return null;
  const scale = imageScale(f);
  const url = satelliteProxyPath(f);
  if (!scale || !url) return null;
  return {
    frame: f,
    location: { lat: f.lat, lng: f.lng },
    formattedAddress: formattedAddress || "",
    precise: null,
    image: { url, width: scale.pixelWidth, height: scale.pixelHeight },
    scale,
  };
}

/** The placement a PolygonMeasure drawing on this still is projected through. */
export function placementOf(still, natural = null) {
  if (!still?.scale || !still?.location) return null;
  return {
    center: still.location,
    scaleInfo: still.scale,
    naturalWidth: natural?.width,
    naturalHeight: natural?.height,
    viewWidth: VIEW_W,
    viewHeight: VIEW_H,
    fit: "slice",
  };
}

/**
 * @param {object}  p
 * @param {object}  [p.frame]        the takeoff's stored frame, if any
 * @param {string}  [p.address]      the address to start from (stored, else the client's)
 * @param {boolean} [p.marker]       pin on the address (roof: yes; paving: no)
 * @param {number}  [p.defaultZoom]  zoom for a fresh measure
 * @param {number}  [p.initialZoom]  zoom for the FIRST automatic fetch when there
 *                                   is no frame — LEGACY_LOT_ZOOM for a takeoff
 *                                   that already has a drawing
 * @param {boolean} [p.auto]         fetch on mount when there is an address and
 *                                   no frame (the tracing panels do; the roof
 *                                   panel bills Solar and waits for a click)
 */
export function useSatelliteStill({
  frame = null,
  address = "",
  marker = false,
  defaultZoom = DEFAULT_ZOOM,
  initialZoom = null,
  auto = false,
} = {}) {
  const [still, setStill] = useState(() => stillFromFrame(frame, address));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const measure = useCallback(
    async (query, zoom = defaultZoom) => {
      const q = String(query || "").trim();
      if (!q) return null;
      const z = clampZoom(zoom);
      const params = new URLSearchParams({
        address: q,
        zoom: String(z),
        scale: String(DEFAULT_SCALE),
        width: String(MAX_TILE_PX),
        height: String(MAX_TILE_PX),
      });
      if (marker) params.set("marker", "1");
      const url = `/api/measure/satellite?${params.toString()}`;
      setBusy(true);
      setError("");
      try {
        let p = inflight.get(url);
        if (!p) {
          p = fetchJson(url).finally(() => inflight.delete(url));
          inflight.set(url, p);
        }
        const data = await p;
        if (!alive.current) return null;
        if (!data?.ok || !data.frame) {
          setError(data?.error || "");
          return null;
        }
        const next = {
          frame: stillFrame(data.frame),
          location: data.location,
          formattedAddress: data.formattedAddress || q,
          precise: data.precise ?? null,
          image: data.image,
          scale: data.scale,
        };
        setStill(next);
        return next;
      } catch (err) {
        if (alive.current) setError(err?.message || "");
        return null;
      } finally {
        if (alive.current) setBusy(false);
      }
    },
    [defaultZoom, marker],
  );

  // The first still, when the panel opens with an address and no stored frame.
  const autoRan = useRef(false);
  useEffect(() => {
    if (!auto || autoRan.current || still || !address) return;
    autoRan.current = true;
    measure(address, initialZoom ?? defaultZoom);
  }, [auto, address, still, measure, initialZoom, defaultZoom]);

  /**
   * The same address at another zoom. Pure — returns { from, to, still } so
   * the caller can re-project its drawing through the two placements — and
   * null when there is no still yet or the zoom is already there.
   */
  const reframe = useCallback(
    (zoom) => {
      if (!still?.frame) return null;
      const z = clampZoom(zoom);
      if (z === still.frame.zoom) return null;
      const next = stillFromFrame({ ...still.frame, zoom: z }, still.formattedAddress);
      if (!next) return null;
      next.precise = still.precise;
      setStill(next);
      return { from: placementOf(still), to: placementOf(next), still: next };
    },
    [still],
  );

  /** A still from somewhere else — the roof route's `still` — adopted as ours. */
  const adopt = useCallback((frame2, { formattedAddress = "", location = null, precise = null } = {}) => {
    const next = stillFromFrame(frame2, formattedAddress);
    if (!next) return null;
    if (location) next.location = location;
    next.precise = precise;
    setStill(next);
    setError("");
    return next;
  }, []);

  const placement = useMemo(() => placementOf(still), [still]);

  return { still, busy, error, measure, reframe, adopt, placement };
}

/**
 * Follow the client's address when it changes — but only while the panel's
 * address IS the client's.
 *
 * Before the panels owned their stills, picking a different client refetched
 * the still for the new address. That has to keep happening for an estimator
 * who never typed an address of their own; it must NOT happen to one who
 * did, because the whole point of the field is that the job site can differ
 * from the billing address. So the panel's box follows the client only when
 * it still holds the previous client's address, i.e. was never edited.
 *
 * @param {string}   siteAddress  the selected client's address
 * @param {string}   address      what the panel's box holds
 * @param {Function} onFollow     (newAddress) → set the box and re-measure
 */
export function useFollowClientAddress(siteAddress, address, onFollow) {
  const prev = useRef(siteAddress);
  useEffect(() => {
    const was = prev.current;
    prev.current = siteAddress;
    if (siteAddress === was) return;
    if (String(address || "").trim() !== String(was || "").trim()) return;
    if (!siteAddress) return;
    onFollow(siteAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteAddress]);
}
