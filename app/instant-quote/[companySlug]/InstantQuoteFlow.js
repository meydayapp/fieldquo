// app/instant-quote/[companySlug]/InstantQuoteFlow.js
//
// The public instant-estimate flow: ONE page, two columns. The form on the
// left, the estimate panel pinned beside it on the right.
//
// It used to be a four-step wizard that revealed each step as the last one was
// answered, and it leaked the thing it was collecting details for: step 3 put
// the real range on screen and step 4 asked who they were. A homeowner could
// read the number and close the tab, and the contractor never knew they
// existed. The panel now shows the range's SHAPE from the first paint — locked
// behind a blur, with the real figure never sent to the browser — so what the
// form is asking them to work towards is visible the whole way down.
//
// Three panel states, per trade, set by the owner (lib/estimate/visibility.js):
// locked until submit, live as they type, or no figure ever. The hero sentence
// and the submit button both follow that setting, so neither can promise
// something the panel won't do.
//
// Every price is computed server-side — this component only ever sends an
// address, a polygon, or a few numbers plus a material key and a band index.
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, CheckCircle2, Lock } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { formatPhoneInput } from "@/lib/validation";
import MediaUploader from "@/app/components/MediaUploader";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";

// ── The way out ──────────────────────────────────────────────────────────────
//
// Every dead end in this flow gets the same escape hatch, from one component.
//
// It exists because the copy that shipped told homeowners to do something they
// had no way of doing: the map-failure branch read "Please request a quote and
// we'll measure your lawn by hand" and rendered no link, because the link lived
// in a different branch. A stranger standing in a driveway with a failed map
// had nowhere to go. The same sentence appears in three server error messages,
// so the exit is a component and not a line of JSX someone remembers to paste.
function RequestQuoteLink({ companySlug, className = "" }) {
  return (
    <a
      href={`/quote/${companySlug}`}
      className={`inline-block underline text-sm font-medium ${className}`}
    >
      Request a quote instead →
    </a>
  );
}

// Surcharge / intake inputs shown per trade, mirroring the estimator's keys.
const INTAKE_INPUTS = {
  roofing: [
    { key: "tearOffLayers", label: "Existing roof layers to remove", type: "number", placeholder: "0" },
  ],
  epoxy: [
    { key: "squareFootage", label: "Floor area (sq ft)", type: "number", required: true },
    {
      key: "surfaceCondition",
      label: "Floor condition",
      type: "select",
      options: [["good", "Good"], ["fair", "Fair"], ["poor", "Poor / needs repair"]],
    },
  ],
  parging: [
    { key: "squareFootage", label: "Wall area (sq ft)", type: "number", required: true },
    {
      key: "access",
      label: "Height / access",
      type: "select",
      options: [["ground", "Ground level"], ["second_storey", "Second storey"], ["scaffold", "Needs scaffold"]],
    },
    {
      key: "condition",
      label: "Wall condition",
      type: "select",
      options: [["new_or_sound", "New / sound masonry"], ["minor_repair", "Minor repair"], ["major_repair", "Major repair"]],
    },
  ],
  cabinet_refacing: [
    { key: "doorCount", label: "Cabinet doors", type: "number", required: true },
    { key: "drawerCount", label: "Drawer fronts", type: "number" },
    { key: "boxLinearFt", label: "Exposed box sides (linear ft)", type: "number" },
  ],
  countertop: [
    { key: "squareFootage", label: "Countertop area (sq ft)", type: "number", required: true, placeholder: "e.g. 40" },
    { key: "cutouts", label: "Sink / cooktop cutouts", type: "number", placeholder: "e.g. 1" },
    { key: "edgeFt", label: "Upgraded edge (linear ft)", type: "number" },
    { key: "backsplashSqft", label: "Backsplash (sq ft)", type: "number" },
  ],
  flooring: [
    { key: "squareFootage", label: "Floor area (sq ft)", type: "number", required: true },
    {
      key: "surfaceCondition",
      label: "Subfloor / old floor",
      type: "select",
      options: [["good", "Bare & level"], ["fair", "Some prep"], ["poor", "Tear-out + levelling"]],
    },
  ],
  painting: [
    { key: "squareFootage", label: "Surface area (sq ft)", type: "number", required: true },
    {
      key: "scope",
      label: "Interior or exterior",
      type: "select",
      options: [["interior", "Interior"], ["exterior", "Exterior"]],
    },
    {
      key: "surfaceCondition",
      label: "Surface condition",
      type: "select",
      options: [["good", "Good"], ["fair", "Fair"], ["poor", "Poor / needs prep"]],
    },
  ],
  stair: [
    { key: "treads", label: "Number of steps", type: "number", required: true, placeholder: "e.g. 13" },
    { key: "railingFt", label: "Railing (linear ft)", type: "number" },
  ],
};

// Where each trade's number actually comes from. Only two of these involve
// imagery; the rest are the homeowner's own figures.
const MEASURE_SOURCE = {
  roof_address: "from satellite measurements of your roof",
  lawn_polygon: "from the area you traced on the map",
  manual_area: "from the area you gave us",
  manual_units: "from the counts you gave us",
  stair_count: "from the counts you gave us",
  item_picker: "from the items you picked",
};

function money(n) {
  return "$" + Math.round(Number(n) || 0).toLocaleString();
}

// ── Lawn polygon map ─────────────────────────────────────────────────────────
// Loads the Google Maps JS API once and lets the homeowner trace their lawn.
// The vertices go up to the server, which recomputes the area — the browser's
// live readout is a convenience, never the priced number.
let mapsLoader = null;
function loadMaps(key) {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.google?.maps?.drawing) return Promise.resolve(window.google);
  if (mapsLoader) return mapsLoader;
  mapsLoader = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=drawing,geometry`;
    s.async = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error("maps_failed"));
    document.head.appendChild(s);
  });
  return mapsLoader;
}

function LawnMap({ mapsKey, onArea, companySlug }) {
  const mapRef = useRef(null);
  const searchRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [areaSqft, setAreaSqft] = useState(0);
  const stateRef = useRef({ map: null, polygon: null });

  // onArea changes identity every parent render (it closes over setState). Held
  // in a ref so the map-init effect can depend only on mapsKey — otherwise each
  // traced vertex would tear down and rebuild the whole map, losing the shape.
  const onAreaRef = useRef(onArea);
  onAreaRef.current = onArea;

  useEffect(() => {
    if (!mapsKey) {
      setFailed(true);
      return;
    }
    let cancelled = false;
    loadMaps(mapsKey)
      .then((google) => {
        if (cancelled || !mapRef.current) return;
        const map = new google.maps.Map(mapRef.current, {
          center: { lat: 45.42, lng: -75.69 },
          zoom: 18,
          mapTypeId: "satellite",
          tilt: 0,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });
        stateRef.current.map = map;

        const dm = new google.maps.drawing.DrawingManager({
          drawingMode: google.maps.drawing.OverlayType.POLYGON,
          drawingControl: false,
          polygonOptions: { fillColor: "#22c55e", fillOpacity: 0.3, strokeColor: "#16a34a", strokeWeight: 2, editable: true },
        });
        dm.setMap(map);

        const measure = (poly) => {
          const path = poly.getPath().getArray().map((p) => ({ lat: p.lat(), lng: p.lng() }));
          const m2 = google.maps.geometry.spherical.computeArea(poly.getPath());
          const sqft = Math.round(m2 * 10.7639104);
          setAreaSqft(sqft);
          onAreaRef.current(sqft, path);
        };

        google.maps.event.addListener(dm, "polygoncomplete", (poly) => {
          // One polygon at a time — clear the previous.
          if (stateRef.current.polygon) stateRef.current.polygon.setMap(null);
          stateRef.current.polygon = poly;
          dm.setDrawingMode(null);
          measure(poly);
          poly.getPath().addListener("set_at", () => measure(poly));
          poly.getPath().addListener("insert_at", () => measure(poly));
        });

        // Recenter from a typed address (core Geocoder, no Places needed).
        if (searchRef.current) {
          const geocoder = new google.maps.Geocoder();
          searchRef.current.addEventListener("keydown", (e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            geocoder.geocode({ address: searchRef.current.value }, (res, status) => {
              if (status === "OK" && res[0]) {
                map.setCenter(res[0].geometry.location);
                map.setZoom(20);
              }
            });
          });
        }

        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [mapsKey]);

  if (failed) {
    // Terminal for this trade: without a polygon the server cannot measure a
    // lawn at all, so there is no retry to offer — only the way out.
    return (
      <div className="text-sm rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">
        <p>The map couldn&apos;t load, so we can&apos;t measure your lawn here.</p>
        <RequestQuoteLink companySlug={companySlug} className="mt-1 text-amber-900" />
      </div>
    );
  }

  return (
    <div>
      <input
        ref={searchRef}
        placeholder="Type your address, press Enter to find it, then trace your lawn"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-2"
      />
      <div ref={mapRef} className="w-full h-80 rounded-lg border border-border bg-muted" />
      {!ready && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" /> Loading map…
        </p>
      )}
      {areaSqft > 0 && (
        <p className="text-sm text-foreground mt-2">
          Traced area: <strong>{areaSqft.toLocaleString()} sq ft</strong>
        </p>
      )}
    </div>
  );
}

export default function InstantQuoteFlow({ companySlug }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  // 404 means this link is for a company that doesn't exist — the only failure
  // where /quote/<slug> is just as broken, so it's the only one without the
  // escape hatch. Everything else (network, 500) is transient and the
  // request-a-quote form is a real alternative.
  const [loadErrStatus, setLoadErrStatus] = useState(0);
  const [trade, setTrade] = useState(null);

  const [address, setAddress] = useState("");
  // ── Where the job is ──────────────────────────────────────────────────────
  //
  // Separate from `address`, which for a roof IS the measurement input. Every
  // other trade measures from typed counts and never asked where the work was,
  // so a lead arrived with a price and no way to know whether it was across
  // town — no travel time, no travel fee, nothing for the booking calendar to
  // filter slots against. The booking flow already refuses to offer times it
  // cannot reach; it can only do that with an address.
  const [siteAddress, setSiteAddress] = useState("");
  const [intake, setIntake] = useState({});
  const [polygon, setPolygon] = useState(null);
  const [materialKey, setMaterialKey] = useState(null);

  // The live preview, for "range" trades only. Null until the form has enough
  // in it to measure; never populated at all in the other two modes, so there
  // is no state here for a figure the mode says to withhold.
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  // null means unanswered, and stays null until they tap. Not 0 — index 0 is
  // the lowest band, a real answer, and seeding it would record "under $3,500"
  // for everyone who never touched the question.
  const [budgetIndex, setBudgetIndex] = useState(null);
  const [media, setMedia] = useState([]); // photos/videos the homeowner attaches
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [submitErr, setSubmitErr] = useState("");

  useEffect(() => {
    fetchJson(`/api/instant-quote/${companySlug}`)
      .then(setData)
      .catch((e) => {
        setLoadErr(e.message || "Could not load");
        setLoadErrStatus(e.status || 0);
      });
  }, [companySlug]);

  const brand = data?.company?.brandColor || "#06356b";
  const language = data?.language || "en";

  function pickTrade(t) {
    setTrade(t);
    setIntake({});
    setAddress("");
    setSiteAddress("");
    setPolygon(null);
    setMaterialKey(null);
    setPreview(null);
    setResult(null);
    setSubmitErr("");
  }

  // What the form still needs. Computed before the effects below because the
  // preview is only worth fetching once the job itself is described — the
  // contact and budget answers don't change the number.
  const inputs = trade ? INTAKE_INPUTS[trade.trade] || [] : [];
  const itemQtyTotal = Array.isArray(intake.items)
    ? intake.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
    : 0;
  const jobDescribed = Boolean(
    trade &&
    (trade.measure !== "roof_address" || address.trim().length > 4) &&
    (trade.measure !== "lawn_polygon" || (polygon && polygon.length >= 3)) &&
    // Junk: at least one item picked. The access toggles are all optional.
    (trade.measure !== "item_picker" || itemQtyTotal > 0) &&
    inputs.filter((f) => f.required).every((f) => Number(intake[f.key]) > 0),
  );

  // ── The live preview, and why only one mode gets it ──────────────────────
  //
  // Collapsing the flow to a single submit removed the round trip that used to
  // reveal the range early, which would have quietly turned "show the range
  // straight away" into "show it after they submit" — two settings doing one
  // thing, with the owner's choice silently ignored. So a `range` trade
  // measures as they type and fills the panel live. The other two modes never
  // call this: for them the figure staying on the server IS the feature.
  //
  // Debounced because it prices on every keystroke otherwise, and aborted on
  // change so a slow early response can't land after a newer one and show a
  // price for a roof they already re-typed.
  const livePreview = trade?.estimateDisplay === "range" && jobDescribed;
  useEffect(() => {
    // No setState on the way out: a stale preview is DERIVED away at render
    // (see `livePreviewShown`) rather than cleared here. Clearing it in the
    // effect body costs a second render pass on every keystroke that makes the
    // form incomplete again, and lets a stale figure paint once before it goes.
    if (!livePreview) return;

    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const payload = { trade: trade.trade, intake };
        if (trade.measure === "roof_address") payload.address = address;
        if (trade.measure === "lawn_polygon") payload.polygon = polygon;
        const res = await fetchJson(`/api/instant-quote/${companySlug}/measure`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctl.signal,
        });
        setPreview(res);
      } catch {
        // A preview that fails is not an error the homeowner needs to see —
        // they haven't asked for anything yet. The panel keeps its empty state
        // and submitting still works, because /request measures again itself.
        setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 600);
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePreview, companySlug, trade?.trade, address, polygon, JSON.stringify(intake)]);

  async function submit() {
    setSubmitting(true);
    setSubmitErr("");
    try {
      const payload = { trade: trade.trade, intake, materialKey, ...contact };
      if (trade.measure === "roof_address") payload.address = address;
      else if (siteAddress.trim()) payload.address = siteAddress.trim();
      if (trade.measure === "lawn_polygon") payload.polygon = polygon;
      if (media.length) payload.media = media;
      // The index only. The server owns the dollars behind it — a form that
      // posted "budget: 10000" could be edited to say anything (#5).
      if (budgetIndex !== null) payload.budgetBandIndex = budgetIndex;
      const res = await fetchJson(`/api/instant-quote/${companySlug}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setResult(res);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitErr(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // The owner's bands for THIS trade, labels already built server-side in their
  // currency. An older config that predates the setting sends none, and the
  // question simply isn't asked — better than falling back to generic bands
  // that don't fit the trade and collecting answers nobody can act on.
  const budgetBands = trade?.budgetBands || [];
  const needsMaterial = (trade?.materials?.length || 0) > 1;
  const missing = [
    !trade && "what you need",
    trade && !jobDescribed && "the job details",
    needsMaterial && !materialKey && "an option",
    trade && trade.measure !== "roof_address" && siteAddress.trim().length < 5 && "the job address",
    trade && !contact.name && "your name",
    trade && !contact.email && !contact.phone && "an email or phone",
    trade && budgetBands.length > 0 && budgetIndex === null && "your budget",
    trade && media.length === 0 && "at least one photo",
  ].filter(Boolean);

  // The promise in the hero and the word on the button both follow the trade's
  // mode, so neither can advertise something the panel won't do.
  const display = trade?.estimateDisplay || "after_submit";
  const heroSubhead = !trade
    ? // Nothing picked yet, and the modes are PER TRADE — a company can gate
      // roofing and show a range for lawns. Promising either one here would be
      // a coin flip, and half of them would be a promise the panel then breaks.
      "Tell us about the job and add a few photos — we'll get your price to you."
    : display === "gated"
      ? "Tell us about the job and add a few photos — we'll review it and come back to you with your price."
      : display === "range"
        ? "Tell us about the job and add a few photos — your estimated range appears as you go, and we'll confirm your final price."
        : "Tell us about the job and add a few photos — you'll see your estimated range as soon as you submit, and we'll confirm your final price.";
  const submitCta = display === "after_submit" ? "Reveal my estimate" : "Get my estimate";

  // The preview only counts while the form still describes the job it was
  // priced for. Derived, not stored: the moment they clear the address, the
  // figure that belonged to it stops being shown, with no extra render.
  const livePreviewShown = livePreview ? preview : null;


  if (loadErr) {
    return (
      <Centered>
        <div className="text-center">
          <p className="text-red-600 mb-3">{loadErr}</p>
          {loadErrStatus !== 404 && <RequestQuoteLink companySlug={companySlug} />}
        </div>
      </Centered>
    );
  }
  if (!data) {
    return <Centered><Loader2 className="animate-spin text-muted-foreground" /></Centered>;
  }
  if (!data.trades.length) {
    return (
      <Centered>
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Instant estimates aren&apos;t available here yet.</p>
          <RequestQuoteLink companySlug={companySlug} />
        </div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30" style={{ ["--brand"]: brand }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          {data.company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.company.logoUrl} alt={data.company.name} className="h-10 w-auto" />
          ) : (
            <div className="h-10 w-10 rounded-lg" style={{ background: brand }} />
          )}
          <div>
            <h1 className="text-lg font-bold text-foreground">{data.company.name}</h1>
            <p className="text-xs text-muted-foreground">Instant estimate</p>
          </div>
        </div>

        {/* Hero. The promise made here has to match what the panel actually
            does, so the second line is chosen from the trade's display mode
            rather than hardcoded: telling someone they will "see a range right
            away" and then showing them a gated notice is the same broken
            promise as a button that does nothing. */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">Get an instant estimate</h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">{heroSubhead}</p>
        </div>

        {/* ── Two columns: the form, and the estimate that never leaves the
            screen ──────────────────────────────────────────────────────────

            One page, not a wizard. The old flow revealed step 2 after picking a
            trade, step 3 after measuring and step 4 after that, so a homeowner
            never saw how much was left to do and had no idea a price was
            coming until it arrived. Everything is visible from the first paint
            now, with the estimate panel pinned alongside it — locked, but
            plainly there, which is the thing the form is asking them to work
            towards.

            Stacks to one column below `lg`, panel LAST on mobile: a sticky
            price card above the form on a phone eats the screen someone is
            trying to type into. */}
        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            {result ? (
              <SuccessCard result={result} company={data.company} brand={brand} />
            ) : (
              <>
                <Section title="What do you need?" required>
                  <div className="grid grid-cols-2 gap-2">
                    {data.trades.map((t) => (
                      <button
                        key={t.trade}
                        onClick={() => pickTrade(t)}
                        className={`text-left rounded-lg border px-3 py-2.5 text-sm font-medium ${
                          trade?.trade === t.trade
                            ? "border-transparent text-white"
                            : "border-border bg-card text-foreground hover:border-foreground/30"
                        }`}
                        style={trade?.trade === t.trade ? { background: brand } : undefined}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Section>

                {trade && (
                  <Section title="Tell us about the property">
                    {trade.measure === "roof_address" && (
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin size={14} /> Property address</span>
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="917 Littlerock St, city, postal code"
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    )}

                    {trade.measure === "lawn_polygon" && (
                      <LawnMap
                        mapsKey={data.mapsKey}
                        companySlug={companySlug}
                        onArea={(sqft, path) => setPolygon(path)}
                      />
                    )}

                    {trade.measure === "item_picker" && (
                      <ItemPicker
                        items={trade.items || []}
                        jobTypes={trade.jobTypes || []}
                        intake={intake}
                        setIntake={setIntake}
                      />
                    )}

                    {inputs.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {inputs.map((f) => (
                          <label key={f.key} className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">{f.label}{f.required ? " *" : ""}</span>
                            {f.type === "select" ? (
                              <select
                                value={intake[f.key] ?? ""}
                                onChange={(e) => setIntake({ ...intake, [f.key]: e.target.value })}
                                className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                              >
                                <option value="">Select…</option>
                                {f.options.map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="number"
                                value={intake[f.key] ?? ""}
                                placeholder={f.placeholder}
                                onChange={(e) => setIntake({ ...intake, [f.key]: e.target.value })}
                                className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </Section>
                )}

                {/* The material choice comes from the page load, not from a
                    measurement — the names are the company's own and carry no
                    rates, so there was never a reason to make someone measure
                    before they could pick one. Prices, where the mode allows
                    them at all, appear in the panel and only in the panel. */}
                {trade?.materials?.length > 1 && (
                  <Section title="Which option?" required>
                    <div className="space-y-2">
                      {trade.materials.map((m) => {
                        const selected = materialKey === m.key;
                        return (
                          <button
                            key={m.key}
                            onClick={() => setMaterialKey(m.key)}
                            className={`w-full text-left rounded-lg border px-4 py-3 text-sm font-medium text-foreground ${
                              selected ? "border-transparent" : "border-border hover:border-foreground/30"
                            }`}
                            style={selected ? { boxShadow: `0 0 0 2px ${brand}` } : undefined}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {/* Budget sits with the contact details, not with the
                    measurements: it's a qualifying question, and nothing picked
                    here moves the estimate by a cent. Asked next to the job
                    itself it reads as "tell us what you'll pay and we'll charge
                    it", which is exactly what a homeowner is afraid of. */}
                {trade && budgetBands.length > 0 && (
                  <Section title="Your budget" required>
                    <div className="grid grid-cols-2 gap-2">
                      {budgetBands.map((b) => {
                        const selected = budgetIndex === b.index;
                        return (
                          <button
                            key={b.index}
                            type="button"
                            onClick={() => setBudgetIndex(b.index)}
                            className={`rounded-lg border px-3 py-2 text-sm font-medium text-foreground ${
                              selected ? "border-transparent" : "border-border hover:border-foreground/30"
                            }`}
                            style={selected ? { boxShadow: `0 0 0 2px ${brand}` } : undefined}
                          >
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {trade && trade.measure !== "roof_address" && (
                  <Section title="Where's the job?" required>
                    <AddressAutocomplete
                      value={siteAddress}
                      onChange={setSiteAddress}
                      onPlaceSelected={(place) => setSiteAddress(place.address)}
                      placeholder="Street, city, postal code"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                  </Section>
                )}

                {trade && (
                  <Section title="Your details" required>
                    <div className="space-y-3">
                      <input
                        placeholder="Your name *"
                        value={contact.name}
                        onChange={(e) => setContact({ ...contact, name: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                      <input
                        placeholder="Email"
                        type="email"
                        value={contact.email}
                        onChange={(e) => setContact({ ...contact, email: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                      {/* Same formatter as the back office (lib/validation.js),
                          so a number typed in a driveway is stored the way staff
                          type it — one shape in the database, not two. */}
                      <input
                        placeholder="Phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        value={contact.phone}
                        onChange={(e) => setContact({ ...contact, phone: formatPhoneInput(e.target.value) })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                    </div>
                  </Section>
                )}

                {trade && (
                  <Section title="Photos" required>
                    <MediaUploader
                      uploadUrl={`/api/self-quote/${companySlug}/upload`}
                      value={media}
                      onChange={setMedia}
                    />
                  </Section>
                )}

                {trade && (
                  <div>
                    <button
                      onClick={submit}
                      disabled={submitting || missing.length > 0}
                      className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 w-full"
                      style={{ background: brand }}
                    >
                      {submitting && <Loader2 size={15} className="animate-spin" />}
                      {submitCta}
                    </button>
                    {/* Say WHY it's disabled. A greyed-out button with no reason
                        is the same dead end as one that does nothing — the
                        homeowner taps it, gets no response, and concludes the
                        form is broken rather than that they missed a field. */}
                    {missing.length > 0 && (
                      <p className="mt-2 text-xs text-muted-foreground text-center">
                        Still needed: {missing.join(", ")}
                      </p>
                    )}
                    {/* Every server-side failure ends here — the address that
                        couldn't be found, the roof with no satellite coverage,
                        the trade that can't price. Several of those messages say
                        "request a quote"; this is the link that makes that
                        sentence true. */}
                    {submitErr && (
                      <div className="mt-2">
                        <p className="text-sm text-red-600">{submitErr}</p>
                        <RequestQuoteLink companySlug={companySlug} className="mt-1 text-red-700" />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* The panel. Sticky only from `lg` up, where there is a second
              column for it to sit beside. */}
          <div className="lg:sticky lg:top-8">
            <EstimatePanel
              trade={trade}
              result={result}
              preview={livePreviewShown}
              previewing={previewing}
              brand={brand}
              language={language}
              company={data.company}
            />
          </div>
        </div>

        {/* Only claimed where it's true — the two trades that read imagery. */}
        {(trade?.measure === "roof_address" || trade?.measure === "lawn_polygon") && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            Powered by measurements from satellite imagery.
          </p>
        )}
      </div>
    </div>
  );
}

// The junk-removal measurement: a job type, a list of items with quantities,
// and the access surcharges. The browser only ever holds item KEYS + counts —
// no prices; the server reprices from the company's rates (non-negotiable #5).
function ItemPicker({ items, jobTypes, intake, setIntake }) {
  const selected = Array.isArray(intake.items) ? intake.items : [];
  const qtyOf = (key) => selected.find((i) => i.key === key)?.quantity || 0;
  const setQty = (key, q) => {
    const next = selected.filter((i) => i.key !== key);
    if (q > 0) next.push({ key, quantity: q });
    setIntake({ ...intake, items: next });
  };
  const accepted = items.filter((i) => !i.notAccepted);
  const refused = items.filter((i) => i.notAccepted);
  const toggle = (k) => setIntake({ ...intake, [k]: !intake[k] });

  return (
    <div className="space-y-4">
      {jobTypes.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-1.5">What kind of job?</p>
          <div className="flex flex-wrap gap-2">
            {jobTypes.map((j) => {
              const on = (intake.jobType || "single_items") === j.key;
              return (
                <button
                  key={j.key}
                  type="button"
                  onClick={() => setIntake({ ...intake, jobType: j.key })}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                    on ? "border-foreground bg-foreground text-background" : "border-border text-foreground"
                  }`}
                >
                  {j.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <p className="text-sm text-muted-foreground mb-1.5">What needs to go?</p>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {accepted.map((it) => (
            <div key={it.key} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm text-foreground">{it.label}</span>
              <Stepper q={qtyOf(it.key)} onChange={(nq) => setQty(it.key, nq)} />
            </div>
          ))}
        </div>
      </div>

      {refused.length > 0 && (
        // Named, not hidden — a homeowner who has a propane tank needs to know
        // now, not when the truck arrives and refuses it.
        <p className="text-xs text-muted-foreground">
          We can’t take: {refused.map((r) => r.label).join(", ")}.
        </p>
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Anything that makes it harder? (optional)</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-foreground">Flights of stairs</span>
          <Stepper q={Number(intake.stairsFlights) || 0} onChange={(nq) => setIntake({ ...intake, stairsFlights: nq })} />
        </div>
        {[
          ["disassembly", "Needs taking apart"],
          ["demolition", "Small demolition"],
          ["longCarry", "Long carry to the truck"],
          ["noElevator", "Upstairs, no elevator"],
        ].map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={!!intake[k]} onChange={() => toggle(k)} />
            <span>{l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function Stepper({ q, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, q - 1))}
        className="h-7 w-7 rounded-full border border-border text-foreground disabled:opacity-40"
        disabled={q <= 0}
        aria-label="Fewer"
      >
        −
      </button>
      <span className="w-6 text-center text-sm tabular-nums text-foreground">{q}</span>
      <button
        type="button"
        onClick={() => onChange(q + 1)}
        className="h-7 w-7 rounded-full border border-border text-foreground"
        aria-label="More"
      >
        +
      </button>
    </div>
  );
}

function Section({ title, required = false, children }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-2">
        {title}
        {required && <span className="text-red-600"> *</span>}
      </h2>
      {children}
    </section>
  );
}

/**
 * The estimate, in whatever state it's honestly in.
 *
 * Four of them, and the panel is never blank in any: an empty box beside a form
 * is the thing that made the old flow feel like nothing was coming.
 *
 *   empty      nothing picked yet — say what will appear here
 *   locked     after_submit, pre-submit. Blurred PLACEHOLDER and a lock. The
 *              real figure is not in this component's props, let alone the DOM
 *              (see the measure route) — deleting the blur reveals X's.
 *   live       range mode, updating as they type
 *   revealed   submitted: the figure, the measured facts behind it, financing
 *
 * The blurred node is aria-hidden and pointer-events-none: a screen reader that
 * announced "$X,XXX" would be reading out fake money, and a cursor that could
 * select it invites people to try.
 */
function EstimatePanel({ trade, result, preview, previewing, brand, language, company }) {
  const fr = language === "fr";
  const rangeLabel = fr ? "Fourchette estimée" : "Estimated range";
  const heading = fr ? "Votre estimation" : "Your estimate";

  const shown = result?.estimate || (result ? null : preview?.options?.[0] || null);
  const measurement = result?.measurement || preview?.measurement || null;
  const financing = result?.financing || preview?.financing || null;
  const locked = !result && trade?.estimateDisplay === "after_submit" && trade.lockedMessage;
  const gatedNote = !result && trade?.estimateDisplay === "gated" && trade.gatedMessage;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-base font-bold text-foreground mb-3">{heading}</h2>

      {shown ? (
        <div className="rounded-xl border border-border overflow-hidden text-center px-4 py-6">
          <div className="text-xs text-muted-foreground mb-1.5">{rangeLabel}</div>
          <div className="text-3xl font-bold" style={{ color: brand }}>
            {money(shown.low)} – {money(shown.high)}
          </div>
          {shown.unit && <div className="text-xs text-muted-foreground mt-1">{shown.unit}</div>}
          {/* Why a small job and a slightly larger one quote the same figure.
              Without this the estimator looks broken — the owner watched one
              cabinet door and twenty produce an identical range and reasonably
              concluded the form wasn't reading his numbers. It was: both were
              under the company's minimum. Says that a minimum exists, never
              what it is — the floor is a rate. */}
          {shown.minimumApplied && (
            <div className="text-xs text-muted-foreground mt-2 border-t border-border pt-2">
              {fr
                ? "Ce projet est sous notre montant minimum de facturation, alors le minimum s’applique."
                : "This job comes in under our minimum charge, so the minimum applies."}
            </div>
          )}
        </div>
      ) : locked ? (
        <div className="relative rounded-xl border border-border overflow-hidden">
          <div
            aria-hidden="true"
            className="text-center px-4 py-6 select-none pointer-events-none opacity-50 blur-[9px]"
          >
            <div className="text-xs text-muted-foreground mb-1.5">{rangeLabel}</div>
            <div className="text-3xl font-bold" style={{ color: brand }}>
              {trade.lockedMessage.placeholder}
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center px-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              style={{ background: `${brand}22` }}
            >
              <Lock size={20} style={{ color: brand }} />
            </div>
            <div className="text-sm font-bold text-foreground">{trade.lockedMessage.title}</div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
          {previewing ? (
            <Loader2 size={18} className="animate-spin mx-auto text-muted-foreground" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {gatedNote ||
                (trade
                  ? fr
                    ? "Complétez le formulaire pour voir votre estimation."
                    : "Fill in the form and your estimate appears here."
                  : fr
                    ? "Choisissez un service pour commencer."
                    : "Pick a service to get started.")}
            </p>
          )}
        </div>
      )}

      {locked && <p className="text-xs text-muted-foreground mt-3">{trade.lockedMessage.body}</p>}

      {/* The measured facts behind the figure. Only ever rendered next to a
          figure that exists, because "22 squares" on its own answers a question
          nobody asked. */}
      {shown && measurement && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
          {measurement.squares != null && <span><strong className="text-foreground">{measurement.squares}</strong> squares</span>}
          {measurement.areaSqft != null && <span><strong className="text-foreground">{Math.round(measurement.areaSqft).toLocaleString()}</strong> sq ft</span>}
          {measurement.predominantPitch && <span><strong className="text-foreground">{measurement.predominantPitch.rise}/12</strong> pitch</span>}
        </div>
      )}
      {shown && measurement?.satelliteImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={measurement.satelliteImageUrl} alt="Property" className="w-full rounded-lg border border-border mt-3" />
      )}

      {/* Said where a figure is shown OR promised, never on the empty state —
          disclaiming a number that isn't there yet is noise. Only the roof and
          the lawn are read from imagery; a door count "measured from satellite"
          is a claim the company would have to defend. */}
      {(shown || locked) && trade && (
        <p className="text-xs text-muted-foreground mt-3">
          This is an estimate {MEASURE_SOURCE[trade.measure] || "based on the details you gave us"}, not a
          final quote. {company.name} will confirm it before anything is binding.
        </p>
      )}

      {/* Financing — the company's own words or their provider. Never a monthly
          figure; FieldQuo doesn't provide financing and won't imply a term. */}
      {financing && (
        <div className="rounded-xl bg-muted/50 p-4 mt-4">
          <p className="text-sm text-foreground">{financing.note}</p>
          {financing.url && (
            <a
              href={financing.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ background: brand }}
            >
              {fr ? "Voir les options de financement" : "See financing options"}
            </a>
          )}
        </div>
      )}

      {result && (
        <p className="text-xs text-muted-foreground mt-4 text-center">Reference {result.reference}</p>
      )}
    </div>
  );
}

function SuccessCard({ result, company, brand }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: brand }} />
      <h2 className="text-lg font-bold text-foreground mb-1">You&apos;re all set</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {company.name} has your details and will confirm your quote shortly.
      </p>
      {/* The figure itself lives in the panel beside this card and is NOT
          repeated here — two copies of one number on one screen is how they
          drift apart. What belongs here is the case where there is no figure:
          withheld on purpose, said out loud, because silence where a number
          belongs reads as a bug rather than a decision. */}
      {!result.estimate && result.message && (
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-sm text-foreground">{result.message}</p>
        </div>
      )}
    </div>
  );
}

function Centered({ children }) {
  return <div className="min-h-screen flex items-center justify-center p-6">{children}</div>;
}
