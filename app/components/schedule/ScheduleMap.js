// app/components/schedule/ScheduleMap.js
//
// The one Google map: numbered pins per person, a popover per pin, work-area
// polygons, and — for whoever may draw — the Maps drawing tool.
//
// ── Loaded only where it is looked at ──────────────────────────────────────
//
// Every reader imports this through next/dynamic with ssr:false, so the
// Maps JS SDK and this file's chunk leave the server untouched and reach the
// browser only when a map view is actually opened — not on every calendar
// load. Google bills per map load; a map nobody asked for is a map somebody
// pays for.
//
// ── Markers are kept, not re-created ───────────────────────────────────────
//
// The pins are google.maps.Marker instances held in a ref keyed by stop key,
// and each render DIFFS the wanted set against the held one: new keys get a
// marker, gone keys lose theirs, kept keys are moved or re-iconed only when
// position, colour or label changed. Re-creating thirty markers on every
// state tick (a filter change, a row hover) is what makes a map stutter on
// the phone this is most often read on, and the popover would close.
//
// The same holds for polygons and for the single InfoWindow.
//
// ── One SDK load, one libraries list ───────────────────────────────────────
//
// useLoadScript is called with lib/maps/libraries.js's list — the one
// AddressAutocomplete uses — so a page carrying both never injects the SDK
// twice. Zone drawing needs no extra library at all — see the drawing
// section below for why it is an editable polygon and not DrawingManager.
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GoogleMap, useLoadScript } from "@react-google-maps/api";
import { MAPS_LIBRARIES } from "@/lib/maps/libraries";

/** The pin, as an SVG data URL. Fill, ink and label are the stop's own. */
function pinIcon(fill, ink, label, selected) {
  const w = selected ? 36 : 30;
  const h = selected ? 48 : 40;
  const text = String(label ?? "").slice(0, 3).replace(/[<>&"]/g, "");
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 30 40">` +
    `<path d="M15 39C15 39 2 22 2 14A13 13 0 0 1 28 14C28 22 15 39 15 39Z" fill="${fill}" stroke="#ffffff" stroke-width="1.5"/>` +
    `<text x="15" y="18.5" text-anchor="middle" font-family="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif" font-size="${text.length > 2 ? 10 : 13}" font-weight="700" fill="${ink}">${text}</text>` +
    `</svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new window.google.maps.Size(w, h),
    anchor: new window.google.maps.Point(w / 2, h - 1),
  };
}

const iconKey = (s, selected) => `${s.fill}|${s.ink}|${s.label}|${selected ? 1 : 0}`;

/** Where an empty, uncentred map looks: the world, not a guessed city. */
const WORLD = { lat: 20, lng: 0 };

const MAP_OPTIONS = {
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  clickableIcons: false,
  // The page scrolls past the map on a phone; a map that eats every touch is
  // a page nobody can leave. Ctrl+scroll / two fingers to zoom.
  gestureHandling: "cooperative",
};

/**
 * @param centre       { lat, lng } | null — where to look when nothing else says.
 * @param stops        buildMapStops() rows; only `located` ones get a pin.
 * @param selectedKey  the stop whose pin is enlarged and whose popover is open.
 * @param onSelect     (key|null) => void
 * @param renderPopover (stop) => HTMLElement — the caller owns the words.
 * @param polygons     [{ id, name, path: [{lat,lng}], fill }] to draw.
 * @param drawing      { active: bool, onComplete(path), onProgress(count), finishNonce }
 *                     — polygon drawing mode, for a caller who may draw.
 * @param editingId    polygon to make editable; onEdited(id, path) on change.
 * @param fitKey       changes when the caller wants the viewport re-fitted
 *                     (a new day, a new filter). Never on a tick.
 */
export default function ScheduleMap({
  centre,
  stops = [],
  selectedKey = null,
  onSelect,
  renderPopover,
  polygons = [],
  drawing = null,
  editingId = null,
  onEdited,
  fitKey = "",
  className = "",
  unavailableText = "The map could not load.",
  missingKeyText = "No Google Maps key is configured for this site.",
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: key,
    libraries: MAPS_LIBRARIES,
  });
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());
  const polygonsRef = useRef(new Map());
  const infoRef = useRef(null);
  const [ready, setReady] = useState(false);

  const onLoad = useCallback((map) => {
    mapRef.current = map;
    setReady(true);
  }, []);
  const onUnmount = useCallback(() => {
    for (const m of markersRef.current.values()) m.setMap(null);
    markersRef.current.clear();
    for (const p of polygonsRef.current.values()) p.setMap(null);
    polygonsRef.current.clear();
    infoRef.current?.close();
    infoRef.current = null;
    mapRef.current = null;
    setReady(false);
  }, []);

  // Callbacks in refs so the marker effect never re-runs for a new closure.
  const onSelectRef = useRef(onSelect);
  const renderPopoverRef = useRef(renderPopover);
  const onEditedRef = useRef(onEdited);
  useEffect(() => {
    onSelectRef.current = onSelect;
    renderPopoverRef.current = renderPopover;
    onEditedRef.current = onEdited;
  }, [onSelect, renderPopover, onEdited]);

  // ── Pins: diffed, never rebuilt ──────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    const g = window.google.maps;
    const map = mapRef.current;
    const held = markersRef.current;
    const wanted = new Map(stops.filter((s) => s.located).map((s) => [s.key, s]));

    for (const [k, marker] of held) {
      if (!wanted.has(k)) {
        marker.setMap(null);
        held.delete(k);
      }
    }
    for (const [k, s] of wanted) {
      const selected = k === selectedKey;
      const ik = iconKey(s, selected);
      let marker = held.get(k);
      if (!marker) {
        marker = new g.Marker({
          // The display point: coincident stops are fanned apart by
          // spreadCoincident so neither hides the other.
          position: { lat: s.pinLat ?? s.lat, lng: s.pinLng ?? s.lng },
          map,
          icon: pinIcon(s.fill, s.ink, s.label, selected),
          title: [s.assigneeName, s.clientName].filter(Boolean).join(" · "),
          zIndex: selected ? 1000 : 1,
        });
        marker.__fq = { ik, lat: s.pinLat ?? s.lat, lng: s.pinLng ?? s.lng };
        marker.addListener("click", () => onSelectRef.current?.(k));
        held.set(k, marker);
      } else {
        const pl = s.pinLat ?? s.lat;
        const pg = s.pinLng ?? s.lng;
        if (marker.__fq.lat !== pl || marker.__fq.lng !== pg) {
          marker.setPosition({ lat: pl, lng: pg });
          marker.__fq.lat = pl;
          marker.__fq.lng = pg;
        }
        if (marker.__fq.ik !== ik) {
          marker.setIcon(pinIcon(s.fill, s.ink, s.label, selected));
          marker.setZIndex(selected ? 1000 : 1);
          marker.__fq.ik = ik;
        }
      }
    }
  }, [ready, stops, selectedKey]);

  // ── The popover: one InfoWindow, moved between pins ──────────────────────
  useEffect(() => {
    if (!ready || !window.google?.maps) return;
    const g = window.google.maps;
    if (!infoRef.current) {
      infoRef.current = new g.InfoWindow({ maxWidth: 280 });
      infoRef.current.addListener("closeclick", () => onSelectRef.current?.(null));
    }
    const info = infoRef.current;
    const marker = selectedKey ? markersRef.current.get(selectedKey) : null;
    const stop = selectedKey ? stops.find((s) => s.key === selectedKey) : null;
    if (!marker || !stop) {
      info.close();
      return;
    }
    const content = renderPopoverRef.current?.(stop);
    if (content) info.setContent(content);
    info.open({ map: mapRef.current, anchor: marker });
  }, [ready, selectedKey, stops]);

  // ── Polygons: diffed the same way ────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    const g = window.google.maps;
    const map = mapRef.current;
    const held = polygonsRef.current;
    const wanted = new Map(polygons.filter((p) => Array.isArray(p.path) && p.path.length >= 3).map((p) => [p.id, p]));
    for (const [id, poly] of held) {
      if (!wanted.has(id)) {
        poly.setMap(null);
        held.delete(id);
      }
    }
    for (const [id, p] of wanted) {
      const editable = id === editingId;
      const sig = JSON.stringify([p.path, p.fill, editable]);
      let poly = held.get(id);
      if (!poly) {
        poly = new g.Polygon({
          paths: p.path,
          map,
          strokeColor: p.fill,
          strokeOpacity: 0.9,
          strokeWeight: 2,
          fillColor: p.fill,
          fillOpacity: 0.12,
          editable,
          clickable: editable,
          zIndex: 0,
        });
        poly.__fq = { sig };
        held.set(id, poly);
      } else if (poly.__fq.sig !== sig) {
        // Only re-path when the path itself changed; a colour or editable
        // flip on its own must not reset the vertices somebody is dragging.
        if (JSON.stringify(poly.__fq.path) !== JSON.stringify(p.path)) poly.setPath(p.path);
        poly.setOptions({ strokeColor: p.fill, fillColor: p.fill, editable, clickable: editable });
        poly.__fq.sig = sig;
      }
      poly.__fq.path = p.path;
      // Edits: the path's own events, wired once per polygon.
      if (editable && !poly.__fq.listening) {
        const path = poly.getPath();
        const report = () => {
          const out = [];
          path.forEach((ll) => out.push({ lat: ll.lat(), lng: ll.lng() }));
          onEditedRef.current?.(id, out);
        };
        poly.__fq.listeners = [
          path.addListener("set_at", report),
          path.addListener("insert_at", report),
          path.addListener("remove_at", report),
        ];
        poly.__fq.listening = true;
      } else if (!editable && poly.__fq.listening) {
        for (const l of poly.__fq.listeners || []) l.remove();
        poly.__fq.listening = false;
      }
    }
  }, [ready, polygons, editingId]);

  // ── Drawing a zone: click to place corners, Maps' own handles to adjust ──
  //
  // Google removed DrawingManager from the Maps JavaScript API at version
  // 3.65 (the console says so in as many words when you construct one), so
  // "the Maps drawing tool" today is the editable polygon: corners are placed
  // by clicking the map, the draft is a google.maps.Polygon with
  // editable:true so its vertex handles can be dragged as you go, and it is
  // closed by clicking the first corner again or by the caller's Finish
  // button (`drawing.finishNonce` changes). The draft is thrown away on
  // completion; the saved polygon comes back through `polygons` and is drawn
  // by the effect above, so the map never shows two copies.
  const drawingActive = Boolean(drawing?.active);
  const finishNonce = drawing?.finishNonce ?? 0;
  const drawingRefCb = useRef(drawing);
  useEffect(() => {
    drawingRefCb.current = drawing;
  }, [drawing]);
  const draftRef = useRef(null);
  const completeDraft = useCallback(() => {
    const draft = draftRef.current;
    if (!draft) return false;
    const out = [];
    draft.poly.getPath().forEach((ll) => out.push({ lat: ll.lat(), lng: ll.lng() }));
    if (out.length < 3) return false;
    draft.poly.setMap(null);
    for (const l of draft.listeners) l.remove();
    draftRef.current = null;
    mapRef.current?.setOptions({ draggableCursor: null });
    drawingRefCb.current?.onComplete?.(out);
    return true;
  }, []);
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return undefined;
    const g = window.google.maps;
    const map = mapRef.current;
    if (!drawingActive) return undefined;

    // One explicit empty RING inside the paths array. `paths: []` gives a
    // polygon with no path at all (getPath() is undefined), and a single
    // empty MVCArray is ambiguous — Maps reads it as a list of rings and then
    // throws `forEach is not a function` on the first LatLng pushed into it.
    const path = new g.MVCArray();
    const poly = new g.Polygon({
      paths: new g.MVCArray([path]),
      map,
      strokeWeight: 2,
      strokeOpacity: 0.9,
      fillOpacity: 0.12,
      editable: true,
      clickable: true,
      zIndex: 5,
    });
    const listeners = [];
    const report = () => drawingRefCb.current?.onProgress?.(path.getLength());
    listeners.push(
      map.addListener("click", (e) => {
        if (!e?.latLng) return;
        path.push(e.latLng);
        report();
      }),
    );
    // A click ON the polygon: on its first vertex with three or more placed,
    // that is "close it"; anywhere else on the fill is another corner, since
    // the map's own click does not fire when the polygon swallows it.
    listeners.push(
      poly.addListener("click", (e) => {
        if (e?.vertex === 0 && path.getLength() >= 3) {
          completeDraft();
          return;
        }
        if (e?.vertex == null && e?.edge == null && e?.latLng) {
          path.push(e.latLng);
          report();
        }
      }),
    );
    listeners.push(path.addListener("set_at", report), path.addListener("insert_at", report), path.addListener("remove_at", report));
    map.setOptions({ draggableCursor: "crosshair" });
    draftRef.current = { poly, listeners };
    report();

    return () => {
      // Left drawing mode (cancelled, or completed and the caller flipped
      // `active` off): the draft goes, whatever state it was in.
      if (draftRef.current?.poly === poly) draftRef.current = null;
      poly.setMap(null);
      for (const l of listeners) l.remove();
      map.setOptions({ draggableCursor: null });
    };
  }, [ready, drawingActive, completeDraft]);

  // The caller's Finish button.
  const lastNonce = useRef(finishNonce);
  useEffect(() => {
    if (finishNonce === lastNonce.current) return;
    lastNonce.current = finishNonce;
    if (drawingActive) completeDraft();
  }, [finishNonce, drawingActive, completeDraft]);

  // ── The viewport: fitted when the caller says, not on every tick ─────────
  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps) return;
    const g = window.google.maps;
    const map = mapRef.current;
    const located = stops.filter((s) => s.located);
    const points = [
      ...located.map((s) => ({ lat: s.lat, lng: s.lng })),
      ...polygons.flatMap((p) => (Array.isArray(p.path) ? p.path : [])),
    ];
    if (centre) points.push(centre);
    if (points.length === 0) {
      map.setCenter(WORLD);
      map.setZoom(2);
      return;
    }
    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(13);
      return;
    }
    const bounds = new g.LatLngBounds();
    for (const p of points) bounds.extend(p);
    map.fitBounds(bounds, 48);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, fitKey]);

  if (!key) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground p-6 ${className}`}>
        {missingKeyText}
      </div>
    );
  }
  if (loadError) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-border bg-muted text-sm text-muted-foreground p-6 ${className}`}>
        {unavailableText}
      </div>
    );
  }
  if (!isLoaded) {
    return <div className={`animate-pulse rounded-xl bg-accent ${className}`} aria-busy="true" />;
  }
  return (
    <div className={`rounded-xl overflow-hidden border border-border ${className}`}>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={centre || WORLD}
        zoom={centre ? 11 : 2}
        options={MAP_OPTIONS}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={() => onSelectRef.current?.(null)}
      />
    </div>
  );
}
