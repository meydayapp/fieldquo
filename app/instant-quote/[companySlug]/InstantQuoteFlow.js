// app/instant-quote/[companySlug]/InstantQuoteFlow.js
//
// The public instant-estimate flow. Four steps: pick a service, describe the
// property (address / traced lawn / typed area), see the range per material,
// leave contact details. Every price is computed server-side — this component
// only ever sends an address, a polygon, or a few numbers plus a material key.
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin, Ruler, CheckCircle2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import MediaUploader from "@/app/components/MediaUploader";

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

function LawnMap({ mapsKey, onArea }) {
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
    return (
      <p className="text-sm rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">
        The map couldn&apos;t load. Please request a quote and we&apos;ll measure your lawn by hand.
      </p>
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
  const [trade, setTrade] = useState(null);

  const [address, setAddress] = useState("");
  const [intake, setIntake] = useState({});
  const [polygon, setPolygon] = useState(null);

  const [measuring, setMeasuring] = useState(false);
  const [measureErr, setMeasureErr] = useState("");
  const [measurement, setMeasurement] = useState(null);
  const [options, setOptions] = useState([]);
  const [gated, setGated] = useState(null); // a message string when the owner hides prices
  const [financing, setFinancing] = useState(null);
  const [materialKey, setMaterialKey] = useState(null);

  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [media, setMedia] = useState([]); // photos/videos the homeowner attaches
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [submitErr, setSubmitErr] = useState("");

  useEffect(() => {
    fetchJson(`/api/instant-quote/${companySlug}`)
      .then(setData)
      .catch((e) => setLoadErr(e.message || "Could not load"));
  }, [companySlug]);

  const brand = data?.company?.brandColor || "#06356b";
  const language = data?.language || "en";

  function pickTrade(t) {
    setTrade(t);
    setIntake({});
    setAddress("");
    setPolygon(null);
    setMeasurement(null);
    setOptions([]);
    setMaterialKey(null);
    setResult(null);
    setMeasureErr("");
  }

  async function getEstimate() {
    setMeasuring(true);
    setMeasureErr("");
    setMeasurement(null);
    setOptions([]);
    setMaterialKey(null);
    try {
      const payload = { trade: trade.trade, intake };
      if (trade.measure === "roof_address") payload.address = address;
      if (trade.measure === "lawn_polygon") payload.polygon = polygon;
      const res = await fetchJson(`/api/instant-quote/${companySlug}/measure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setMeasurement(res.measurement);
      setFinancing(res.financing || null);
      // Gated: the owner chose not to show a price for this trade. The server
      // sends a message and NO options — render the message, and let them
      // request a quote exactly as before. Without this guard `res.options`
      // is undefined and the line below throws.
      if (res.gated) {
        setGated(res.message || "");
        setOptions([]);
      } else {
        setGated(null);
        const opts = res.options || [];
        setOptions(opts);
        if (opts.length === 1) setMaterialKey(opts[0].materialKey);
      }
    } catch (err) {
      setMeasureErr(err.message || "We couldn't measure that.");
    } finally {
      setMeasuring(false);
    }
  }

  async function submit() {
    setSubmitting(true);
    setSubmitErr("");
    try {
      const payload = { trade: trade.trade, intake, materialKey, ...contact };
      if (trade.measure === "roof_address") payload.address = address;
      if (trade.measure === "lawn_polygon") payload.polygon = polygon;
      if (media.length) payload.media = media;
      const res = await fetchJson(`/api/instant-quote/${companySlug}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setResult(res);
    } catch (err) {
      setSubmitErr(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Can we attempt a measurement yet?
  const inputs = trade ? INTAKE_INPUTS[trade.trade] || [] : [];
  const itemQtyTotal = Array.isArray(intake.items)
    ? intake.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
    : 0;
  const requiredMet =
    trade &&
    (trade.measure !== "roof_address" || address.trim().length > 4) &&
    (trade.measure !== "lawn_polygon" || (polygon && polygon.length >= 3)) &&
    // Junk: at least one item picked. The access toggles are all optional.
    (trade.measure !== "item_picker" || itemQtyTotal > 0) &&
    inputs.filter((f) => f.required).every((f) => Number(intake[f.key]) > 0);

  const selectedOption = options.find((o) => o.materialKey === materialKey) || (options.length === 1 ? options[0] : null);

  if (loadErr) {
    return <Centered><p className="text-red-600">{loadErr}</p></Centered>;
  }
  if (!data) {
    return <Centered><Loader2 className="animate-spin text-muted-foreground" /></Centered>;
  }
  if (!data.trades.length) {
    return (
      <Centered>
        <div className="text-center">
          <p className="text-muted-foreground mb-3">Instant estimates aren&apos;t available here yet.</p>
          <a href={`/quote/${companySlug}`} className="underline text-sm">Request a quote instead →</a>
        </div>
      </Centered>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30" style={{ ["--brand"]: brand }}>
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
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

        {result ? (
          <SuccessCard result={result} company={data.company} companySlug={companySlug} brand={brand} />
        ) : (
          <div className="space-y-6">
            {/* Step 1 — trade */}
            <Card step="1" title="What do you need?">
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
            </Card>

            {/* Step 2 — measurement input */}
            {trade && (
              <Card step="2" title="Tell us about the property">
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

                <button
                  onClick={getEstimate}
                  disabled={!requiredMet || measuring}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  style={{ background: brand }}
                >
                  {measuring ? <Loader2 size={15} className="animate-spin" /> : <Ruler size={15} />}
                  Get my estimate
                </button>
                {measureErr && <p className="text-sm text-red-600 mt-2">{measureErr}</p>}
              </Card>
            )}

            {/* Step 3 — measurement + options */}
            {measurement && options.length > 0 && (
              <Card step="3" title="Your estimate">
                {measurement.satelliteImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={measurement.satelliteImageUrl} alt="Property" className="w-full rounded-lg border border-border mb-3" />
                )}
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground mb-4">
                  {measurement.squares != null && <span><strong className="text-foreground">{measurement.squares}</strong> squares</span>}
                  {measurement.areaSqft != null && <span><strong className="text-foreground">{Math.round(measurement.areaSqft).toLocaleString()}</strong> sq ft</span>}
                  {measurement.predominantPitch && <span><strong className="text-foreground">{measurement.predominantPitch.rise}/12</strong> pitch</span>}
                </div>

                <div className="space-y-2">
                  {options.map((o) => {
                    const selected = materialKey === o.materialKey || options.length === 1;
                    return (
                      <button
                        key={o.materialKey || "single"}
                        onClick={() => setMaterialKey(o.materialKey)}
                        className={`w-full text-left rounded-lg border px-4 py-3 flex items-center justify-between ${
                          selected ? "border-transparent" : "border-border hover:border-foreground/30"
                        }`}
                        style={selected ? { boxShadow: `0 0 0 2px ${brand}` } : undefined}
                      >
                        <span className="text-sm font-medium text-foreground">{o.label || "Estimate"}</span>
                        <span className="text-sm font-semibold text-foreground">
                          {money(o.low)}–{money(o.high)}{o.unit ? ` ${o.unit}` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  This is an estimate from satellite measurements, not a final quote.
                  {" "}{data.company.name} will confirm it before anything is binding.
                </p>
              </Card>
            )}

            {/* Step 3 (gated) — measurement, but the owner hides the price.
                No figure is shown; they still leave details and we follow up. */}
            {measurement && gated && (
              <Card step="3" title="Almost there">
                {measurement.satelliteImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={measurement.satelliteImageUrl} alt="Property" className="w-full rounded-lg border border-border mb-3" />
                )}
                <p className="text-sm text-foreground">{gated}</p>
              </Card>
            )}

            {/* Financing — the company's own offer, shown once there's an
                estimate or a gated result. Never a monthly figure (FieldQuo
                doesn't provide financing); it's their words or their provider. */}
            {financing && (measurement) && (
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-sm text-foreground">{financing.note}</p>
                {financing.url && (
                  <a
                    href={financing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-3 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                    style={{ background: brand }}
                  >
                    {language === "fr" ? "Voir les options de financement" : "See financing options"}
                  </a>
                )}
              </div>
            )}

            {/* Step 4 — contact. Shown whether they saw a price or a gated
                message, so a gated flow can still be completed. */}
            {(selectedOption || gated) && (
              <Card step="4" title="Where should we send it?">
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
                  <input
                    placeholder="Phone"
                    value={contact.phone}
                    onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                  <MediaUploader
                    uploadUrl={`/api/self-quote/${companySlug}/upload`}
                    value={media}
                    onChange={setMedia}
                  />
                </div>
                <button
                  onClick={submit}
                  disabled={submitting || !contact.name || (!contact.email && !contact.phone)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 w-full justify-center"
                  style={{ background: brand }}
                >
                  {submitting && <Loader2 size={15} className="animate-spin" />}
                  Send me my estimate
                </button>
                {submitErr && <p className="text-sm text-red-600 mt-2">{submitErr}</p>}
              </Card>
            )}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground mt-8">
          Powered by measurements from satellite imagery.
        </p>
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

function Card({ step, title, children }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">{step}</span>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function SuccessCard({ result, company, companySlug, brand }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: brand }} />
      <h2 className="text-lg font-bold text-foreground mb-1">You&apos;re all set</h2>
      <p className="text-sm text-muted-foreground mb-4">
        {company.name} has your details and will confirm your quote shortly.
      </p>
      {result.estimate && (
        <div className="rounded-lg bg-muted/50 px-4 py-3 inline-block">
          <p className="text-xs text-muted-foreground">Estimated range</p>
          <p className="text-xl font-bold text-foreground">
            {money(result.estimate.low)}–{money(result.estimate.high)}
            {result.estimate.unit ? <span className="text-sm font-normal text-muted-foreground"> {result.estimate.unit}</span> : null}
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-4">Reference {result.reference}</p>
    </div>
  );
}

function Centered({ children }) {
  return <div className="min-h-screen flex items-center justify-center p-6">{children}</div>;
}
