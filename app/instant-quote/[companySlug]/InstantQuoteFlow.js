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
// ── The language is the visitor's ──────────────────────────────────────────
//
// Three pills at the top of the form: English, Français, Español. Every string
// on the page comes from lib/i18n/instantQuoteCopy.js (plus the lawn and
// "doesn't look right" tables it defers to), so switching re-renders the whole
// page — and re-fetches the payload, because the trade chips, the budget
// bands, the lawn cards and the junk-removal items are labelled server-side.
// The pick is carried on every request after that: the measurement notes,
// the draft, the lead and the email are created in it and never re-translated
// (non-negotiable #6). Resolution order on first paint: ?lang= on the link
// (a contractor's French page links with ?lang=fr), what this browser chose
// here before (localStorage, per company), the browser's own language when
// it is one of the three, then the company's.
//
// Every price is computed server-side — this component only ever sends an
// address, a polygon, or a few numbers plus a material key and a band index.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MapPin, CheckCircle2, Lock } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { estimateRange } from "@/lib/estimate/estimateMoney";
import { formatPhoneInput } from "@/lib/validation";
import MediaUploader from "@/app/components/MediaUploader";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import BookVisitPanel from "@/app/components/public/BookVisitPanel";
import LawnCareOffer, { lawnPickTotal, estimateMoneyCents } from "./LawnCareOffer";
import MeasurementDoubt from "./MeasurementDoubt";
import { lawnEstimateCopy } from "@/lib/i18n/lawnEstimateCopy";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import {
  INSTANT_QUOTE_LANGUAGES,
  instantQuoteCopy,
  instantQuoteLanguage,
  instantQuoteLocale,
} from "@/lib/i18n/instantQuoteCopy";
import { questionsFor, timelineOptionsFor, tradeQuestionCopy } from "@/lib/leads/tradeQuestions";
import { serviceAreaCopy } from "@/lib/company/serviceArea";
import { DEFAULT_FORM_FIELDS, contactRule, contactSatisfied } from "@/lib/estimate/formFields";
import FormLook, { useFormLook } from "@/app/components/public/FormLook";

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
function RequestQuoteLink({ companySlug, t, className = "" }) {
  return (
    <a
      href={`/quote/${companySlug}`}
      className={`inline-block underline text-sm font-medium ${className}`}
    >
      {t.requestQuoteInstead}
    </a>
  );
}

// Surcharge / intake inputs shown per trade, mirroring the estimator's keys.
// Labels and options are COPY KEYS resolved through the language table at
// render (intakeInputs below) — the field keys and option VALUES are the
// estimator's and never change with the language.
const INTAKE_INPUTS = {
  roofing: [
    { key: "tearOffLayers", label: "tearOffLayers", type: "number", placeholder: "0" },
  ],
  epoxy: [
    { key: "squareFootage", label: "squareFootageFloor", type: "number", required: true },
    {
      key: "surfaceCondition",
      label: "surfaceCondition",
      type: "select",
      options: [["good", "good"], ["fair", "fair"], ["poor", "poor"]],
    },
  ],
  parging: [
    { key: "squareFootage", label: "squareFootageWall", type: "number", required: true },
    {
      key: "access",
      label: "access",
      type: "select",
      options: [["ground", "ground"], ["second_storey", "second_storey"], ["scaffold", "scaffold"]],
    },
    {
      key: "condition",
      label: "condition",
      type: "select",
      options: [["new_or_sound", "new_or_sound"], ["minor_repair", "minor_repair"], ["major_repair", "major_repair"]],
    },
  ],
  // Refinishing shares the manual_units measurement with refacing and does NOT
  // share its fields: there is no box veneer to price (the box exteriors are
  // sprayed as part of the base scope), so that input is deliberately absent
  // rather than rendered as a box that changes no number.
  cabinet_refinishing: [
    { key: "doorCount", label: "doorCount", type: "number", required: true },
    { key: "drawerCount", label: "drawerCount", type: "number" },
    {
      key: "complexityLevel",
      label: "complexityLevel",
      type: "select",
      options: [["standard", "standard"], ["moderate", "moderate"], ["high", "high"]],
    },
  ],
  cabinet_refacing: [
    { key: "doorCount", label: "doorCount", type: "number", required: true },
    { key: "drawerCount", label: "drawerCount", type: "number" },
    { key: "boxLinearFt", label: "boxLinearFt", type: "number" },
  ],
  countertop: [
    { key: "squareFootage", label: "squareFootageCounter", type: "number", required: true, eg: "40" },
    { key: "cutouts", label: "cutouts", type: "number", eg: "1" },
    { key: "edgeFt", label: "edgeFt", type: "number" },
    { key: "backsplashSqft", label: "backsplashSqft", type: "number" },
  ],
  flooring: [
    { key: "squareFootage", label: "squareFootageFloor", type: "number", required: true },
    {
      key: "surfaceCondition",
      label: "subfloor",
      type: "select",
      options: [["good", "bareLevel"], ["fair", "somePrep"], ["poor", "tearOut"]],
    },
  ],
  painting: [
    { key: "squareFootage", label: "squareFootageSurface", type: "number", required: true },
    // Asked only when the company sells BOTH. The page payload carries the
    // scopes they sell (`trade.scopes`); with one, the server prices that one
    // whatever the form sent, so a question here would be a control whose
    // answer changes nothing. `askedWhen` is read by the input filter below.
    {
      key: "scope",
      label: "scope",
      type: "select",
      options: [["interior", "interior"], ["exterior", "exterior"]],
      askedWhen: (trade) => !Array.isArray(trade?.scopes) || trade.scopes.length > 1,
    },
    {
      key: "surfaceCondition",
      label: "surfaceConditionPaint",
      type: "select",
      options: [["good", "good"], ["fair", "fair"], ["poor", "poorPrep"]],
    },
  ],
  stair: [
    { key: "treads", label: "treads", type: "number", required: true, eg: "13" },
    // Straight / L / U, L preselected: with the step count it derives the
    // balusters, posts and handrail the range prices
    // (lib/estimate/stairsFromSteps.js). A homeowner is not asked to count
    // spindles; they are asked whether the stair turns.
    {
      key: "shape",
      label: "stairShape",
      type: "select",
      options: [["straight", "stairStraight"], ["L", "stairL"], ["U", "stairU"]],
      defaultValue: "L",
    },
    { key: "railingFt", label: "railingFt", type: "number" },
  ],
};

/** The trade's inputs with their words resolved in the page's language. */
function intakeInputs(trade, t) {
  if (!trade) return [];
  return (INTAKE_INPUTS[trade.trade] || [])
    .filter((f) => !f.askedWhen || f.askedWhen(trade))
    .map((f) => ({
      ...f,
      labelText: t.inputs[f.label] || f.label,
      placeholderText: f.eg ? `${t.inputs.egPrefix}${f.eg}` : f.placeholder,
      optionsText: (f.options || []).map(([v, k]) => [v, t.options[k] || k]),
    }));
}

// The trades measured from an ADDRESS rather than from something the
// homeowner types or draws: roofing and gutters read the same roof model.
// One predicate, so the address box, the payload and the "where's the job"
// section cannot disagree about which trades already have an address.
const byAddress = (measure) =>
  measure === "roof_address" || measure === "gutter_address" || measure === "lawn_address";

// A trade whose figure is the area the homeowner TRACED on the map — the lawn
// (lawn_polygon) and any trade priced per traced square foot (area_polygon:
// paving). One predicate, so the map, the payload and the wording agree.
const byTrace = (measure) => measure === "lawn_polygon" || measure === "area_polygon";

// The trades whose figure is read off imagery — roof, eaves, lawn, a traced
// area — and so the ones that carry the "this doesn't look right" control
// under it. A door count the homeowner typed has nothing for a satellite to
// have got wrong.
const fromImagery = (measure) => byAddress(measure) || byTrace(measure);

// Money lives in lib/estimate/estimateMoney.js now, shared with the funnel
// runner. What used to be here was `"$" + Math.round(Number(n) || 0)`, which
// published a dollar figure for a company billing in euros and turned a
// missing bound into a confident "$0". See that file for both arguments.

// ── The language, remembered ─────────────────────────────────────────────────
const langStorageKey = (slug) => `fq.instantQuote.lang.${slug}`;

function readStoredLanguage(slug) {
  try {
    return instantQuoteLanguage(window.localStorage.getItem(langStorageKey(slug)));
  } catch {
    return null;
  }
}

function storeLanguage(slug, code) {
  try {
    window.localStorage.setItem(langStorageKey(slug), code);
  } catch {
    // Private mode or storage blocked — the pick still holds for this visit.
  }
}

/**
 * Which language the page opens in. `?lang=` wins (a link from a French page
 * must open French whatever this browser chose last month), then what this
 * browser chose here before, then the browser's own language when it is one
 * of the three, then the company's — which the payload carries.
 */
function initialLanguage(slug) {
  if (typeof window === "undefined") return null;
  const fromQuery = instantQuoteLanguage(new URLSearchParams(window.location.search).get("lang"));
  if (fromQuery) return fromQuery;
  const stored = readStoredLanguage(slug);
  if (stored) return stored;
  const browser = instantQuoteLanguage(window.navigator?.language);
  return browser || null;
}

// ── Lawn / area polygon map ──────────────────────────────────────────────────
// Loads the Google Maps JS API once and lets the homeowner trace their lawn
// (or the area to pave). The vertices go up to the server, which recomputes
// the area — the browser's live readout is a convenience, never the priced
// number.
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

// `area` is true for a traced area that is not a lawn (paving): the wording
// says "the area" instead of "your lawn". Same map, same polygon, same server.
function LawnMap({ mapsKey, onArea, companySlug, centerAddress = "", t, area = false }) {
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
          // 18, not 20: a suburban lot fits in the frame, so the homeowner
          // sees the property's edges before they start tracing (the owner's
          // complaint about the stills — "I cannot see the edge of the
          // property"). They can pinch in; the map is live.
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
                map.setZoom(19);
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

  // Lawn care already has the address typed above the map (it is the
  // measurement input), so the map opens on the house rather than on a
  // city-wide default the homeowner has to search twice for.
  useEffect(() => {
    const map = stateRef.current.map;
    if (!ready || !map || !centerAddress || centerAddress.trim().length < 5) return;
    const timer = setTimeout(() => {
      try {
        new window.google.maps.Geocoder().geocode({ address: centerAddress }, (res, status) => {
          if (status === "OK" && res[0]) {
            map.setCenter(res[0].geometry.location);
            map.setZoom(19);
          }
        });
      } catch {
        // No geocoder — the search box above the map still works.
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [ready, centerAddress]);

  if (failed) {
    // Terminal for this trade: without a polygon the server cannot measure a
    // lawn at all, so there is no retry to offer — only the way out.
    return (
      <div className="text-sm rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">
        <p>{area ? t.mapFailedArea : t.mapFailed}</p>
        <RequestQuoteLink companySlug={companySlug} t={t} className="mt-1 text-amber-900" />
      </div>
    );
  }

  return (
    <div>
      <input
        ref={searchRef}
        placeholder={area ? t.mapSearchPlaceholderArea : t.mapSearchPlaceholder}
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm mb-2"
      />
      <div ref={mapRef} className="w-full h-80 rounded-lg border border-border bg-muted" />
      {!ready && (
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
          <Loader2 size={12} className="animate-spin" /> {t.loadingMap}
        </p>
      )}
      {areaSqft > 0 && (
        <p className="text-sm text-foreground mt-2">
          <strong>{t.tracedArea(areaSqft)}</strong>
        </p>
      )}
    </div>
  );
}

// `embedded` is true only from app/embed/[companySlug]/[widget]/page.js. It
// changes two things — the company header is not drawn, and the root stops
// claiming the viewport — and nothing else. See the comments at each site.
//
// `look` is the company's saved appearance with its brand colour, read on
// the server by the page that mounts this (lib/estimate/publicFormLook.js) —
// never from the URL, which on an embed is a string somebody else pasted.
// Null, or the default preset, changes nothing at all: see FormLook.
export default function InstantQuoteFlow({ companySlug, embedded = false, look: lookProp = null }) {
  const [data, setData] = useState(null);
  const [loadErr, setLoadErr] = useState("");
  // 404 means this link is for a company that doesn't exist — the only failure
  // where /quote/<slug> is just as broken, so it's the only one without the
  // escape hatch. Everything else (network, 500) is transient and the
  // request-a-quote form is a real alternative.
  const [loadErrStatus, setLoadErrStatus] = useState(0);
  const [trade, setTrade] = useState(null);

  // The visitor's language. Null until the first effect resolves it (see
  // initialLanguage) — the payload's own `language` fills it in when the
  // browser and the link said nothing, i.e. the company's.
  const [language, setLanguage] = useState(null);

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
  // The structured halves of the site address, when it was picked from the
  // autocomplete rather than typed. Held separately from the string because
  // `siteAddress` is also a free-text field — someone who types it gets no
  // jurisdiction, and an empty object is the honest record of that.
  const [siteJurisdiction, setSiteJurisdiction] = useState({});
  const [intake, setIntake] = useState({});
  const [polygon, setPolygon] = useState(null);
  const [materialKey, setMaterialKey] = useState(null);
  // Lawn care: the program and add-ons picked — KEYS, never amounts. Held
  // apart from `intake` so ticking an add-on does not re-measure the
  // property: the cards already carry the server's per-item prices and the
  // panel totals a pick from those; the server reprices from the keys on
  // submit (#5).
  const [lawnPick, setLawnPick] = useState({ programKey: null, addOnKeys: [] });
  // Whether the "trace your lawn to correct it" map is open.
  const [tracing, setTracing] = useState(false);

  // ── When, and the trade's own questions ──────────────────────────────────
  //
  // "When do you need this done?" is required; its options depend on the
  // trade (lib/leads/tradeQuestions.js). `answers` holds the trade question
  // keys; `notes` the free text. None of it moves the estimate by a cent —
  // it is what the company reads before they ring back.
  const [whenNeeded, setWhenNeeded] = useState(null);
  const [answers, setAnswers] = useState({});
  const [notes, setNotes] = useState("");

  // The service-area verdict for the address on the form: null until asked
  // or when the company has no area, else the route's answer. Only an
  // explicit `inside: false` ever prints a sentence.
  const [areaVerdict, setAreaVerdict] = useState(null);

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

  // ── The payload, in the page's language ───────────────────────────────────
  //
  // Fetched once per language: the chips, the bands, the lawn cards and the
  // junk items are labelled server-side, so a switch is a refetch. `language`
  // being null on the first run means "whatever the company speaks" — the
  // route answers with that and the state is seeded from the answer.
  useEffect(() => {
    const wanted = language ?? initialLanguage(companySlug);
    const ctl = new AbortController();
    fetchJson(`/api/instant-quote/${companySlug}${wanted ? `?lang=${wanted}` : ""}`, { signal: ctl.signal })
      .then((payload) => {
        setData(payload);
        const resolved = instantQuoteLanguage(payload.language) || "en";
        if (language !== resolved) setLanguage(resolved);
        // Keep the chosen trade across a language switch — by KEY, because
        // the object it came from has just been relabelled. And on the first
        // load, one trade on offer is picked outright: a chooser with a
        // single chip is a tap that decides nothing.
        setTrade((current) =>
          current
            ? payload.trades.find((x) => x.trade === current.trade) || null
            : payload.trades.length === 1
              ? payload.trades[0]
              : null,
        );
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        setLoadErr(e.message || instantQuoteCopy(wanted || "en").couldNotLoad);
        setLoadErrStatus(e.status || 0);
      });
    return () => ctl.abort();
  }, [companySlug, language]);

  function chooseLanguage(code) {
    if (!instantQuoteLanguage(code) || code === language) return;
    storeLanguage(companySlug, code);
    setLanguage(code);
  }

  const brand = data?.company?.brandColor || "#06356b";
  // ── The brand, measured ───────────────────────────────────────────────────
  //
  // `brand` above is the raw hex and stays raw for the things a raw hex is
  // right for: a selection ring, a wash. It is NOT right for text or for a
  // fill carrying text, and this page was using it for both.
  //
  // Four tenants in the database make that concrete. Sunset Inc's brand is
  // #ffffff, Big painter Inc's is #c0c0c0, Teacup Poodle's is #fefcdd, and the
  // seeded default is #bd9d60. Against the white card those measure 1.00,
  // 1.82, 1.04 and 2.57 to one — so the estimate figure, the selected trade
  // chip and the submit button rendered white-on-white or near it. The submit
  // button is the control this entire page exists to get pressed.
  //
  // documentTheme is the same machinery the quote and the PDF use: accentText
  // steps the colour until it clears 4.5:1 as TEXT on paper, fillPair returns
  // a background plus a foreground measured against it. Neither invents a
  // colour — a dark brand comes back untouched.
  // The chosen look, if any. Its palette re-measures accentText and the
  // button pair against ITS surfaces (a dark card, a brand-washed page), so
  // the two values below follow it and every `theme.accentText` and
  // `solid.bg` in this file is right on that surface too. Null on the
  // default look, and then these are exactly what they always were.
  const look = useFormLook(lookProp);
  const theme = useMemo(() => {
    const base = documentTheme({ brandColor: brand });
    return look ? { ...base, accentText: look.palette.accentText } : base;
  }, [brand, look]);
  const solid = useMemo(() => (look ? look.palette.button : fillPair(theme)), [theme, look]);
  // The lit chip — trade, language — is the button's pair on a solid look
  // and a filled chip beside an outline button, so a selection still reads
  // as a fill when the call to action is a ghost.
  const chip = look ? look.palette.chip : solid;
  const lang = language || instantQuoteLanguage(data?.language) || "en";
  const t = instantQuoteCopy(lang);
  const q = tradeQuestionCopy(lang);
  const uploadCopy = clientDocCopy(lang).selfQuote;
  // The company's currency, not a symbol. Absent until the payload lands;
  // currencyMeta falls back to the default rather than throwing, and no figure
  // is rendered before then anyway.
  const currency = data?.currency;

  function pickTrade(next) {
    setTrade(next);
    setIntake({});
    setAddress("");
    setSiteAddress("");
    setSiteJurisdiction({});
    setPolygon(null);
    setMaterialKey(null);
    setLawnPick({ programKey: null, addOnKeys: [] });
    setTracing(false);
    setPreview(null);
    setResult(null);
    setSubmitErr("");
    setWhenNeeded(null);
    setAnswers({});
    setAreaVerdict(null);
  }

  // What the form still needs. Computed before the effects below because the
  // preview is only worth fetching once the job itself is described — the
  // contact and budget answers don't change the number.
  const inputs = intakeInputs(trade, t);
  const itemQtyTotal = Array.isArray(intake.items)
    ? intake.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0)
    : 0;
  const jobDescribed = Boolean(
    trade &&
    (!byAddress(trade.measure) || address.trim().length > 4) &&
    (!byTrace(trade.measure) || (polygon && polygon.length >= 3)) &&
    // Junk: at least one item picked. The access toggles are all optional.
    (trade.measure !== "item_picker" || itemQtyTotal > 0) &&
    inputs.filter((f) => f.required).every((f) => Number(intake[f.key]) > 0),
  );

  // The trade's own questions — minus any whose key the estimator already
  // asks as an INPUT (painting's scope is priced, so it is asked once, in
  // the inputs, whatever the company sells). A question asked twice with two
  // different option lists is a form that contradicts itself.
  const inputKeys = new Set((INTAKE_INPUTS[trade?.trade] || []).map((f) => f.key));
  const tradeQuestions = trade ? questionsFor(trade.trade).filter((qq) => !inputKeys.has(qq.key)) : [];
  const whenOptions = trade ? timelineOptionsFor(trade.trade) : [];

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
        const payload = { trade: trade.trade, intake, language: lang };
        if (byAddress(trade.measure)) payload.address = address;
        if (byTrace(trade.measure)) payload.polygon = polygon;
        // The trace is the correction: with one, the server sizes the lawn
        // from it and ignores the parcel arithmetic.
        if (trade.measure === "lawn_address" && polygon) payload.polygon = polygon;
        const res = await fetchJson(`/api/instant-quote/${companySlug}/measure`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctl.signal,
        });
        setPreview(res);
      } catch (err) {
        // A preview that fails is not an error the homeowner needs to see —
        // they haven't asked for anything yet. The panel keeps its empty state
        // and submitting still works, because /request measures again itself.
        //
        // One exception: a measurement the server REFUSED as not a house
        // (gutters — a shed, a strip mall, a pin two lots over). That is not a
        // hiccup, it is the answer, and the sentence the server wrote for it
        // is the one thing the homeowner should read instead of a range.
        setPreview(
          err?.data?.reason === "needs_site_visit"
            ? { refused: err.message, measurement: err.data?.partial || null }
            : null,
        );
      } finally {
        setPreviewing(false);
      }
    }, 600);
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livePreview, companySlug, trade?.trade, address, polygon, JSON.stringify(intake), lang]);

  // ── Inside the company's service area? ───────────────────────────────────
  //
  // Asked of whichever address the form carries for this trade — the
  // measured one or the job site — once typing has settled. The route says
  // nothing for a company with no area, and nothing when it cannot place the
  // address; only an explicit "outside" prints the sentence, and it never
  // blocks the submit. Best-effort: a failed check is silence, not a verdict.
  //
  // The verdict is tagged with the address it answered, and the note below
  // is DERIVED from that match — so a corrected address drops a stale
  // "outside" on the next keystroke without an effect clearing state.
  const jobAddress = byAddress(trade?.measure) ? address : siteAddress;
  const jobPostal = siteJurisdiction.postalCode || "";
  useEffect(() => {
    if (!trade || jobAddress.trim().length < 5) return;
    const asked = jobAddress.trim();
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ address: asked });
        if (jobPostal) qs.set("postalCode", jobPostal);
        const res = await fetchJson(`/api/service-area/${companySlug}?${qs}`, { signal: ctl.signal });
        setAreaVerdict(res && typeof res === "object" ? { ...res, address: asked } : null);
      } catch {
        // Silence — see above.
      }
    }, 800);
    return () => {
      ctl.abort();
      clearTimeout(timer);
    };
  }, [companySlug, trade, jobAddress, jobPostal]);
  const areaNote = areaVerdict && areaVerdict.address === jobAddress.trim() ? areaVerdict : null;

  async function submit() {
    setSubmitting(true);
    setSubmitErr("");
    try {
      const payload = {
        trade: trade.trade,
        intake,
        materialKey,
        ...contact,
        // The language the form was read in — the draft, the lead and the
        // email are created in it (non-negotiable #6).
        language: lang,
        whenNeeded,
        answers,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      };
      if (byAddress(trade.measure)) payload.address = address;
      else if (siteAddress.trim()) {
        payload.address = siteAddress.trim();
        // Only the pieces Google actually returned. The server normalises the
        // country and ignores anything it doesn't recognise.
        const { city, province, country, postalCode, county } = siteJurisdiction;
        Object.assign(payload, { city, province, country, postalCode, county });
      }
      if (byTrace(trade.measure)) payload.polygon = polygon;
      if (trade.measure === "lawn_address") {
        if (polygon) payload.polygon = polygon;
        payload.intake = { ...intake, programKey: lawnPick.programKey, addOnKeys: lawnPick.addOnKeys };
      }
      if (media.length) payload.media = media;
      // The index only. The server owns the dollars behind it — a form that
      // posted "budget: 10000" could be edited to say anything (#5).
      if (budgetIndex !== null) payload.budgetBandIndex = budgetIndex;
      const res = await fetchJson(`/api/instant-quote/${companySlug}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // The full report — the page the estimate becomes once the price is
      // out (app/estimate-report/[token]). When the server made one, the
      // homeowner goes there; the confirmation below is the fallback for a
      // draft with no report.
      if (res?.reportUrl && typeof window !== "undefined") {
        window.location.assign(res.reportUrl);
        return;
      }
      setResult(res);
      if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setSubmitErr(err.message || t.submitFailed);
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
  // ── Which questions this trade asks, and which it insists on ─────────────
  //
  // Per trade, from the payload (lib/estimate/formFields.js): photos, budget,
  // when, notes, phone, email and the job address are each required,
  // optional or hidden as the owner set them, with the address already locked
  // to required where the estimator measures from it or a service area has
  // to be checked. The defaults are what this form always did. The request
  // route applies the same table, so this list is a courtesy and the server
  // is the gate.
  const fields = trade?.fields || DEFAULT_FORM_FIELDS;
  const rule = contactRule(fields);
  const missing = [
    !trade && t.missing.whatYouNeed,
    trade && !jobDescribed && t.missing.jobDetails,
    needsMaterial && !materialKey && t.missing.anOption,
    trade?.measure === "lawn_address" && !lawnPick.programKey && t.missing.aProgram,
    trade && !byAddress(trade.measure) && fields.address === "required" && siteAddress.trim().length < 5 && t.missing.jobAddress,
    trade && fields.timeline === "required" && !whenNeeded && t.missing.whenNeeded,
    trade && !contact.name && t.missing.yourName,
    trade && !contactSatisfied(fields, contact) &&
      (rule === "both" ? t.missing.phoneAndEmail : rule === "phone" ? t.missing.yourPhone : rule === "email" ? t.missing.yourEmail : t.missing.emailOrPhone),
    trade && fields.budget === "required" && budgetBands.length > 0 && budgetIndex === null && t.missing.yourBudget,
    trade && fields.photos === "required" && media.length === 0 && t.missing.onePhoto,
  ].filter(Boolean);

  // The promise in the hero and the word on the button both follow the trade's
  // mode, so neither can advertise something the panel won't do.
  const display = trade?.estimateDisplay || "after_submit";
  const heroSubhead = !trade
    ? // Nothing picked yet, and the modes are PER TRADE — a company can gate
      // roofing and show a range for lawns. Promising either one here would be
      // a coin flip, and half of them would be a promise the panel then breaks.
      t.heroNoTrade
    : display === "gated"
      ? t.heroGated
      : display === "range"
        ? t.heroRange
        : t.heroAfterSubmit;
  const submitCta = display === "after_submit" ? t.ctaReveal : t.ctaGet;

  // The preview only counts while the form still describes the job it was
  // priced for. Derived, not stored: the moment they clear the address, the
  // figure that belonged to it stops being shown, with no extra render.
  const livePreviewShown = livePreview ? preview : null;

  // The pills. Drawn wherever the form is — above the trade chooser, and on
  // the load/error screens too, since a French speaker staring at an English
  // error has no other way to ask for French.
  const languagePills = (
    <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label={t.languageLabel}>
      {INSTANT_QUOTE_LANGUAGES.map((code) => {
        const on = code === lang;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={on}
            onClick={() => chooseLanguage(code)}
            className={`rounded-full border px-3 min-h-9 text-xs font-semibold ${
              on ? "border-transparent" : "border-border bg-card text-foreground hover:border-foreground/30"
            }`}
            // The lit pill is a fill carrying text: fillPair's measured pair,
            // with accentText as the edge so a pale brand still has a shape.
            style={on ? { background: chip.bg, color: chip.fg, borderColor: chip.border || theme.accentText } : undefined}
          >
            {t.languageNames[code]}
          </button>
        );
      })}
    </div>
  );

  if (loadErr) {
    return (
      <FormLook look={look}>
        <Centered embedded={embedded}>
          <div className="text-center space-y-3">
            <div className="flex justify-center">{languagePills}</div>
            <p className="text-red-600">{loadErr}</p>
            {loadErrStatus !== 404 && <RequestQuoteLink companySlug={companySlug} t={t} />}
          </div>
        </Centered>
      </FormLook>
    );
  }
  if (!data) {
    return <FormLook look={look}><Centered embedded={embedded}><Loader2 className="animate-spin text-muted-foreground" /></Centered></FormLook>;
  }
  if (!data.trades.length) {
    return (
      <FormLook look={look}>
        <Centered embedded={embedded}>
          <div className="text-center space-y-3">
            <div className="flex justify-center">{languagePills}</div>
            <p className="text-muted-foreground">{t.notAvailable}</p>
            <RequestQuoteLink companySlug={companySlug} t={t} />
          </div>
        </Centered>
      </FormLook>
    );
  }

  // No `--brand` custom property on the root any more: it was set on this div
  // and read by nothing in the tree below it. A value written and never read
  // is the shape of a control that looks wired up and isn't.
  //
  // min-h-screen only when standalone. Inside an iframe "the screen" is the
  // iframe itself, so the root could never measure shorter than whatever
  // height the snippet started with — EmbedFrame would post that number
  // back, the host would set it, and the frame would grow but never shrink.
  // min-h-0 lets the embed report what it actually is.
  //
  // (These notes sit ABOVE the return: a line comment between a JSX opening
  // tag and its child is text, and shipped as such once FormLook wrapped
  // this root.)
  return (
    <FormLook look={look}>
    <div className={embedded ? "min-h-0 bg-muted/30" : "min-h-screen bg-muted/30"} lang={lang}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header. Not drawn when embedded: the iframe sits inside the
            company's own website, under the company's own logo, and a second
            one here reads as somebody else's widget. */}
        {!embedded && (
          <div className="flex items-center gap-3 mb-8">
            {data.company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.company.logoUrl} alt={data.company.name} className="h-10 w-auto" />
            ) : (
              // The logo stand-in. On the raw brand a white-branded company got
              // a white square on a white page — which reads as "the logo failed
              // to load", not as a company with no logo. fillPair's background is
              // visible whatever the brand.
              <div
                className="h-10 w-10 rounded-lg border"
                style={{ background: solid.bg, borderColor: theme.accentText }}
              />
            )}
            <div>
              <h1 className="text-lg font-bold text-foreground">{data.company.name}</h1>
              <p className="text-xs text-muted-foreground">{t.instantEstimate}</p>
            </div>
          </div>
        )}

        {/* Hero. The promise made here has to match what the panel actually
            does, so the second line is chosen from the trade's display mode
            rather than hardcoded: telling someone they will "see a range right
            away" and then showing them a gated notice is the same broken
            promise as a button that does nothing. */}
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground">{t.heroTitle}</h2>
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
            {/* The language, first: it is the one control that changes every
                other word on the page, so it sits above the first question. */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground">{t.languageLabel}</span>
              {languagePills}
            </div>

            {result ? (
              <>
                <SuccessCard result={result} company={data.company} theme={theme} t={t} />
                {/* The next step, offered where they are rather than left to a
                    phone call neither side makes. Only when the company can
                    actually take a booking — no active event type, or the visit
                    mode switched off, and this is silently absent instead of a
                    button onto an empty calendar. The details they typed are
                    carried in as props, so nothing is retyped and the calendar
                    can filter slots by travel from the first query. */}
                {data.booking?.canBookVisit && (
                  <BookVisitPanel
                    slug={data.booking.slug}
                    quoteId={result.quoteId}
                    contact={{ ...contact, address: jobAddress }}
                    copy={{ title: t.bookTitle, body: t.bookBody, cta: t.bookCta }}
                  />
                )}
              </>
            ) : (
              <>
                <Section title={t.whatDoYouNeed} required>
                  <div className="grid grid-cols-2 gap-2">
                    {data.trades.map((tr) => (
                      <button
                        key={tr.trade}
                        onClick={() => pickTrade(tr)}
                        // min-h-11: 44px is the floor for a thumb, and picking
                        // the trade is the first thing anyone does here.
                        className={`text-left rounded-lg border px-3 py-2.5 min-h-11 text-sm font-medium ${
                          trade?.trade === tr.trade
                            ? "border-transparent"
                            : "border-border bg-card text-foreground hover:border-foreground/30"
                        }`}
                        // The selected chip was `text-white` on the raw brand,
                        // so a white or pale-yellow brand made the trade the
                        // homeowner just picked the only unreadable one.
                        style={
                          trade?.trade === tr.trade
                            ? {
                                background: chip.bg,
                                color: chip.fg,
                                // The chip's EDGE, which is a separate
                                // question from its label. fillPair guarantees
                                // the label is legible on the fill and says
                                // nothing about the fill against the page —
                                // silver is 1.82:1 there, so the chip had no
                                // shape even once its text was readable.
                                borderColor: chip.border || theme.accentText,
                              }
                            : undefined
                        }
                      >
                        {tr.label}
                      </button>
                    ))}
                  </div>
                </Section>

                {trade && (
                  <Section title={t.aboutProperty}>
                    {byAddress(trade.measure) && (
                      <label className="flex flex-col gap-1">
                        <span className="text-sm text-muted-foreground flex items-center gap-1"><MapPin size={14} /> {t.propertyAddress}</span>
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder={t.addressPlaceholder}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                      </label>
                    )}

                    {byTrace(trade.measure) && (
                      <LawnMap
                        mapsKey={data.mapsKey}
                        companySlug={companySlug}
                        onArea={(sqft, path) => setPolygon(path)}
                        t={t}
                        area={trade.measure === "area_polygon"}
                      />
                    )}

                    {/* Lawn care is sized from the address without a trace
                        (parcel − roof − driveway, or the minimum band, and
                        the panel says which). The trace is offered as the
                        CORRECTION, closed by default, never required. */}
                    {trade.measure === "lawn_address" && (
                      <div className="mt-3">
                        <button
                          type="button"
                          onClick={() => setTracing((v) => !v)}
                          aria-expanded={tracing}
                          className="text-sm font-medium underline text-foreground min-h-8"
                        >
                          {lawnEstimateCopy(lang).traceCta}
                        </button>
                        {tracing && (
                          <div className="mt-2">
                            <p className="text-xs text-muted-foreground mb-2">{lawnEstimateCopy(lang).traceHint}</p>
                            <LawnMap
                              mapsKey={data.mapsKey}
                              companySlug={companySlug}
                              centerAddress={address}
                              onArea={(sqft, path) => setPolygon(path)}
                              t={t}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {trade.measure === "item_picker" && (
                      <ItemPicker
                        items={trade.items || []}
                        jobTypes={trade.jobTypes || []}
                        intake={intake}
                        setIntake={setIntake}
                        t={t}
                      />
                    )}

                    {inputs.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {inputs.map((f) => (
                          <label key={f.key} className="flex flex-col gap-1">
                            <span className="text-sm text-muted-foreground">{f.labelText}{f.required ? " *" : ""}</span>
                            {f.type === "select" ? (
                              <select
                                value={intake[f.key] ?? f.defaultValue ?? ""}
                                onChange={(e) => setIntake({ ...intake, [f.key]: e.target.value })}
                                className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                              >
                                {!f.defaultValue && <option value="">{t.select}</option>}
                                {f.optionsText.map(([v, l]) => (
                                  <option key={v} value={v}>{l}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="number"
                                value={intake[f.key] ?? ""}
                                placeholder={f.placeholderText}
                                onChange={(e) => setIntake({ ...intake, [f.key]: e.target.value })}
                                className="rounded-lg border border-border bg-background px-2 py-2 text-sm"
                              />
                            )}
                          </label>
                        ))}
                      </div>
                    )}

                    {/* Only under an address the measurement itself uses; the
                        job-site section below carries its own. */}
                    {byAddress(trade.measure) && <OutsideAreaNote verdict={areaNote} company={data.company} lang={lang} />}
                  </Section>
                )}

                {/* Lawn care: the programs as cards and the add-ons as
                    checkboxes. Names arrive with the page; prices arrive
                    with the measurement, and only in "range" mode. */}
                {trade?.measure === "lawn_address" && trade.lawn && (
                  <Section title={t.yourProgram}>
                    <LawnCareOffer
                      offer={trade.lawn}
                      priced={livePreviewShown?.offer || null}
                      pick={lawnPick}
                      onPick={setLawnPick}
                      language={lang}
                      currency={currency}
                      theme={theme}
                      solid={solid}
                    />
                  </Section>
                )}

                {/* The material choice comes from the page load, not from a
                    measurement — the names are the company's own and carry no
                    rates, so there was never a reason to make someone measure
                    before they could pick one. Prices, where the mode allows
                    them at all, appear in the panel and only in the panel. */}
                {trade?.materials?.length > 1 && (
                  <Section title={t.whichOption} required>
                    <div className="space-y-2">
                      {trade.materials.map((m) => {
                        const selected = materialKey === m.key;
                        return (
                          <button
                            key={m.key}
                            onClick={() => setMaterialKey(m.key)}
                            className={`w-full text-left rounded-lg border px-4 py-3 min-h-11 text-sm font-medium text-foreground ${
                              selected ? "border-transparent" : "border-border hover:border-foreground/30"
                            }`}
                            // The ring is the ONLY thing marking a selection —
                            // the border is dropped at the same time. Drawn in
                            // the raw brand it disappeared on a white or
                            // pale-yellow brand, leaving the chosen option
                            // looking LESS selected than the others.
                            // accentText is measured against paper.
                            style={selected ? { boxShadow: `0 0 0 2px ${theme.accentText}` } : undefined}
                          >
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {/* ── When, and the trade's own question(s) ──────────────
                    Required, and its options depend on the trade: someone
                    with a burst pipe answers "today", a roof "this season".
                    The trade questions under it are the one or two facts
                    the company wants before driving out. Chips, same as the
                    budget bands beneath — the same kind of question. */}
                {trade && whenOptions.length > 0 && fields.timeline !== "hidden" && (
                  <Section title={q.whenTitle} required={fields.timeline === "required"}>
                    <div className="grid grid-cols-2 gap-2">
                      {whenOptions.map((o) => {
                        const selected = whenNeeded === o.key;
                        return (
                          <button
                            key={o.key}
                            type="button"
                            onClick={() => setWhenNeeded(o.key)}
                            aria-pressed={selected}
                            className={`rounded-lg border px-3 py-2 min-h-11 text-sm font-medium text-foreground text-left ${
                              selected ? "border-transparent" : "border-border hover:border-foreground/30"
                            }`}
                            style={selected ? { boxShadow: `0 0 0 2px ${theme.accentText}` } : undefined}
                          >
                            {q.timeline[o.key]}
                          </button>
                        );
                      })}
                    </div>
                    {tradeQuestions.map((qq) => (
                      <div key={qq.key} className="mt-3">
                        <p className="text-sm text-muted-foreground mb-1.5">{q.questions[qq.key]}</p>
                        <div className="flex flex-wrap gap-2">
                          {qq.options.map((opt) => {
                            const selected = answers[qq.key] === opt;
                            return (
                              <button
                                key={opt}
                                type="button"
                                aria-pressed={selected}
                                // Tapping the chosen one again clears it — the
                                // question is optional and a mis-tap needs a
                                // way back to "didn't say".
                                onClick={() =>
                                  setAnswers((a) => {
                                    const next = { ...a };
                                    if (selected) delete next[qq.key];
                                    else next[qq.key] = opt;
                                    return next;
                                  })
                                }
                                className={`rounded-full border px-3 min-h-10 text-sm font-medium text-foreground ${
                                  selected ? "border-transparent" : "border-border hover:border-foreground/30"
                                }`}
                                style={selected ? { boxShadow: `0 0 0 2px ${theme.accentText}` } : undefined}
                              >
                                {q.options[opt] || opt}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </Section>
                )}

                {/* Budget sits with the contact details, not with the
                    measurements: it's a qualifying question, and nothing picked
                    here moves the estimate by a cent. Asked next to the job
                    itself it reads as "tell us what you'll pay and we'll charge
                    it", which is exactly what a homeowner is afraid of. */}
                {trade && budgetBands.length > 0 && fields.budget !== "hidden" && (
                  <Section title={t.yourBudget} required={fields.budget === "required"}>
                    <div className="grid grid-cols-2 gap-2">
                      {budgetBands.map((b) => {
                        const selected = budgetIndex === b.index;
                        return (
                          <button
                            key={b.index}
                            type="button"
                            onClick={() => setBudgetIndex(b.index)}
                            className={`rounded-lg border px-3 py-2 min-h-11 text-sm font-medium text-foreground ${
                              selected ? "border-transparent" : "border-border hover:border-foreground/30"
                            }`}
                            // Same measured ring as the material picker above.
                            style={selected ? { boxShadow: `0 0 0 2px ${theme.accentText}` } : undefined}
                          >
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                  </Section>
                )}

                {trade && !byAddress(trade.measure) && fields.address !== "hidden" && (
                  <Section title={t.whereIsJob} required={fields.address === "required"}>
                    <AddressAutocomplete
                      value={siteAddress}
                      // Typing after picking invalidates the components that
                      // came with the pick — keeping them would attach the
                      // previous suggestion's province to a different address.
                      onChange={(v) => {
                        setSiteAddress(v);
                        setSiteJurisdiction({});
                      }}
                      // address-jurisdiction: keeps city, province, country.
                      // This kept the formatted string alone, so a homeowner
                      // who picked a real suggestion still produced a client
                      // the tax resolver could say nothing about. The postal
                      // code and county go to the client record too, so the
                      // client this creates carries what a hand-added one does.
                      onPlaceSelected={(place) => {
                        setSiteAddress(place.address);
                        setSiteJurisdiction({
                          city: place.city || "",
                          province: place.province || "",
                          country: place.country || "",
                          postalCode: place.postalCode || "",
                          county: place.county || "",
                        });
                      }}
                      placeholder={t.jobAddressPlaceholder}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    />
                    <OutsideAreaNote verdict={areaNote} company={data.company} lang={lang} />
                  </Section>
                )}

                {trade && (
                  <Section title={t.yourDetails} required>
                    <div className="space-y-3">
                      <input
                        placeholder={t.namePlaceholder}
                        value={contact.name}
                        onChange={(e) => setContact({ ...contact, name: e.target.value })}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      />
                      {/* Hidden by the owner means not drawn; required means the
                          asterisk the name field already carries. Either way
                          the request route holds a POST to the same rule. */}
                      {fields.email !== "hidden" && (
                        <input
                          placeholder={fields.email === "required" ? `${t.emailPlaceholder} *` : t.emailPlaceholder}
                          type="email"
                          value={contact.email}
                          onChange={(e) => setContact({ ...contact, email: e.target.value })}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                      )}
                      {/* Same formatter as the back office (lib/validation.js),
                          so a number typed in a driveway is stored the way staff
                          type it — one shape in the database, not two. */}
                      {fields.phone !== "hidden" && (
                        <input
                          placeholder={fields.phone === "required" ? `${t.phonePlaceholder} *` : t.phonePlaceholder}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          value={contact.phone}
                          onChange={(e) => setContact({ ...contact, phone: formatPhoneInput(e.target.value) })}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                      )}
                    </div>
                  </Section>
                )}

                {trade && fields.photos !== "hidden" && (
                  <Section title={t.photos} required={fields.photos === "required"}>
                    <MediaUploader
                      uploadUrl={`/api/self-quote/${companySlug}/upload`}
                      value={media}
                      onChange={setMedia}
                      // The uploader's own words, from the self-quote table
                      // (the same control, the same eight languages) rather
                      // than the app catalogue: the person uploading is not a
                      // member of the company.
                      label={uploadCopy.uploadLabel}
                      hint={uploadCopy.uploadHint}
                      documentLabel={uploadCopy.uploadDocumentFallback}
                      busyLabel={uploadCopy.uploadBusy}
                      limitLabel={uploadCopy.uploadLimit}
                      failedLabel={uploadCopy.uploadFailed}
                      rejectedLabel={uploadCopy.uploadRejected}
                      tooLargeLabel={uploadCopy.uploadTooLarge}
                      removeLabel={uploadCopy.uploadRemove}
                    />
                  </Section>
                )}

                {/* The free-text note — always present, for the thing no
                    chip could have asked. Capped at the 2000 the server
                    keeps, so nothing is silently cut after they pressed
                    submit. */}
                {trade && fields.notes !== "hidden" && (
                  <Section title={q.notesTitle}>
                    <textarea
                      rows={3}
                      maxLength={2000}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={q.notesPlaceholder}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y"
                    />
                  </Section>
                )}

                {trade && (
                  <div>
                    <button
                      onClick={submit}
                      disabled={submitting || missing.length > 0}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-3 min-h-11 text-sm font-semibold disabled:opacity-50 w-full"
                      // The one control this page exists to get pressed. It was
                      // `text-white` on the raw brand: white on white for the
                      // tenant whose brand IS #ffffff, and 1.82:1 on the one
                      // whose brand is silver. fillPair measures the pair.
                      // The border is not decoration: a mid-tone brand keeps
                      // its own fill (fillPair only moves it when the LABEL
                      // needs it), and a silver button on a white page has no
                      // visible edge without one.
                      style={{ background: solid.bg, color: solid.fg, borderColor: solid.border || theme.accentText, borderWidth: solid.borderWidth }}
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
                        {t.stillNeeded(missing.join(", "))}
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
                        <RequestQuoteLink companySlug={companySlug} t={t} className="mt-1 text-red-700" />
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
              theme={theme}
              solid={solid}
              language={lang}
              t={t}
              currency={currency}
              company={data.company}
              companySlug={companySlug}
              lawnPick={lawnPick}
              address={jobAddress}
              contact={contact}
            />
          </div>
        </div>

        {/* Only claimed where it's true — the trades that read imagery. */}
        {fromImagery(trade?.measure) && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            {t.poweredBy}
          </p>
        )}
      </div>
    </div>
    </FormLook>
  );
}

// The one honest line about the service area, and only for an explicit
// "outside". `inside: null` is "we could not place the address", and a
// sentence there would be a guess dressed as a verdict. Never a block: the
// submit button is untouched.
function OutsideAreaNote({ verdict, company, lang }) {
  if (!verdict || verdict.configured !== true || verdict.inside !== false) return null;
  return (
    <p className="mt-2 text-xs rounded-lg bg-amber-50 text-amber-900 border border-amber-200 px-3 py-2">
      {serviceAreaCopy(lang).outside(company.name, verdict.radiusKm || null, verdict.city || "")}
    </p>
  );
}

// The junk-removal measurement: a job type, a list of items with quantities,
// and the access surcharges. The browser only ever holds item KEYS + counts —
// no prices; the server reprices from the company's rates (non-negotiable #5).
// Item and job-type labels arrive with the payload, already in the page's
// language; the fixed strings come from the table.
function ItemPicker({ items, jobTypes, intake, setIntake, t }) {
  const selected = Array.isArray(intake.items) ? intake.items : [];
  const qtyOf = (key) => selected.find((i) => i.key === key)?.quantity || 0;
  const setQty = (key, qn) => {
    const next = selected.filter((i) => i.key !== key);
    if (qn > 0) next.push({ key, quantity: qn });
    setIntake({ ...intake, items: next });
  };
  const accepted = items.filter((i) => !i.notAccepted);
  const refused = items.filter((i) => i.notAccepted);
  const toggle = (k) => setIntake({ ...intake, [k]: !intake[k] });

  return (
    <div className="space-y-4">
      {jobTypes.length > 0 && (
        <div>
          <p className="text-sm text-muted-foreground mb-1.5">{t.whatKindOfJob}</p>
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
        <p className="text-sm text-muted-foreground mb-1.5">{t.whatNeedsToGo}</p>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {accepted.map((it) => (
            <div key={it.key} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm text-foreground">{it.label}</span>
              <Stepper q={qtyOf(it.key)} onChange={(nq) => setQty(it.key, nq)} t={t} />
            </div>
          ))}
        </div>
      </div>

      {refused.length > 0 && (
        // Named, not hidden — a homeowner who has a propane tank needs to know
        // now, not when the truck arrives and refuses it.
        <p className="text-xs text-muted-foreground">
          {t.cantTake(refused.map((r) => r.label).join(", "))}
        </p>
      )}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t.harder}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-foreground">{t.flightsOfStairs}</span>
          <Stepper q={Number(intake.stairsFlights) || 0} onChange={(nq) => setIntake({ ...intake, stairsFlights: nq })} t={t} />
        </div>
        {[
          ["disassembly", t.disassembly],
          ["demolition", t.demolition],
          ["longCarry", t.longCarry],
          ["noElevator", t.noElevator],
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

function Stepper({ q, onChange, t }) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, q - 1))}
        className="h-7 w-7 rounded-full border border-border text-foreground disabled:opacity-40"
        disabled={q <= 0}
        aria-label={t.fewer}
      >
        −
      </button>
      <span className="w-6 text-center text-sm tabular-nums text-foreground">{q}</span>
      <button
        type="button"
        onClick={() => onChange(q + 1)}
        className="h-7 w-7 rounded-full border border-border text-foreground"
        aria-label={t.more}
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
function EstimatePanel({ trade, result, preview, previewing, theme, solid, language, t, currency, company, companySlug, lawnPick, address, contact }) {
  const lawnCopy = lawnEstimateCopy(language);
  const isLawn = trade?.measure === "lawn_address";
  const rangeLabel = isLawn ? lawnCopy.total : t.estimatedRange;

  // Lawn care, before submit: the total is the sum of the server's own
  // per-item prices for the program and add-ons picked — the cards carry
  // them — so ticking a box changes the figure without a round trip. After
  // submit it is the server's total for the keys posted, as for every trade.
  const lawnLiveTotal = isLawn && !result && preview?.offer ? lawnPickTotal(preview.offer, lawnPick) : null;
  const shown = result?.estimate
    || (result ? null : isLawn ? (lawnLiveTotal != null ? { low: lawnLiveTotal, high: lawnLiveTotal } : null) : preview?.options?.[0] || null);
  // The range as ONE string, or null. estimateRange refuses to format a range
  // with a missing end rather than filling it with a zero — so a half-arrived
  // payload draws the "still working it out" state instead of promising a
  // floor of nothing. The locale follows the document language; the CURRENCY is
  // the company's and is not negotiable by the reader's browser.
  //
  // A program is a price, not a range: when the two ends are equal the one
  // figure prints to the cent, as the company's card states it.
  const locale = instantQuoteLocale(language);
  const rangeText = shown
    ? shown.low === shown.high
      ? estimateMoneyCents(Number(shown.low), currency, locale)
      : estimateRange(shown.low, shown.high, currency, locale)
    : null;
  const measurement = result?.measurement || preview?.measurement || null;
  const financing = result?.financing || preview?.financing || null;
  const locked = !result && trade?.estimateDisplay === "after_submit" && trade.lockedMessage;
  const gatedNote = !result && trade?.estimateDisplay === "gated" && trade.gatedMessage;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h2 className="text-base font-bold text-foreground mb-3">{t.yourEstimate}</h2>

      {shown && rangeText ? (
        <div className="rounded-xl border border-border overflow-hidden text-center px-4 py-6">
          <div className="text-xs text-muted-foreground mb-1.5">{rangeLabel}</div>
          {/* accentText, not the raw brand. This is the biggest number on the
              page and it was drawn in the company's hex on a white card, which
              measures 1.00:1 for the tenant whose brand is #ffffff. */}
          <div className="text-3xl font-bold" style={{ color: theme.accentText }}>
            {rangeText}
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
              {t.minimumApplied}
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
            <div className="text-3xl font-bold" style={{ color: theme.accentText }}>
              {trade.lockedMessage.placeholder}
            </div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center px-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center"
              // The lock chip sits ON the blurred card, so both halves need
              // measuring: a wash of a white brand is white, and the icon in
              // the raw brand on top of it is white on white.
              style={{ background: solid.bg, border: `1px solid ${theme.accentText}` }}
            >
              <Lock size={20} style={{ color: solid.fg }} />
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
              {preview?.refused || gatedNote || (trade ? t.fillInForm : t.pickService)}
            </p>
          )}
        </div>
      )}

      {locked && <p className="text-xs text-muted-foreground mt-3">{trade.lockedMessage.body}</p>}

      {/* Lawn care: the estimated size and the sentence saying where it came
          from — a parcel, a trace, or the minimum band — beside the figure
          AND beside the empty state, because "pick a program" needs the size
          the programs are priced at. Never "measured" for a band. */}
      {isLawn && measurement?.lawn && (
        <div className="mt-3 rounded-lg bg-muted/50 px-3 py-2">
          <div className="text-xs text-muted-foreground">{lawnCopy.lawnSizeLabel}</div>
          <div className="text-lg font-bold text-foreground">{measurement.lawn.sizeText}</div>
          {(measurement.lawn.notes || []).map((line) => (
            <p key={line} className="text-xs text-muted-foreground mt-1">{line}</p>
          ))}
        </div>
      )}
      {isLawn && !shown && preview?.offer && !result && (
        <p className="text-xs text-muted-foreground mt-2">{lawnCopy.selectProgram}</p>
      )}

      {/* The measured facts behind the figure. Only ever rendered next to a
          figure that exists, because "22 squares" on its own answers a question
          nobody asked. */}
      {shown && measurement && !isLawn && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-3">
          {measurement.squares != null && <span><strong className="text-foreground">{measurement.squares}</strong> {t.squares}</span>}
          {measurement.areaSqft != null && <span><strong className="text-foreground">{Math.round(measurement.areaSqft).toLocaleString(locale)}</strong> {t.sqft}</span>}
          {measurement.predominantPitch && <span><strong className="text-foreground">{measurement.predominantPitch.rise}/12</strong> {t.pitch}</span>}
          {measurement.gutterFt != null && <span><strong className="text-foreground">{measurement.gutterFt}</strong> {t.ftOfGutter}</span>}
          {measurement.downspouts != null && <span><strong className="text-foreground">{measurement.downspouts}</strong> {t.downspouts}</span>}
        </div>
      )}
      {/* Gutters: the two sentences the server wrote in the form's
          language — "measured from aerial imagery of your roofline · imagery
          date …" and "an estimate, not a contract". They replace the generic
          disclaimer below for this trade rather than sitting beside it. */}
      {shown && Array.isArray(measurement?.notes) && measurement.notes.length > 0 && (
        <div className="mt-3 space-y-1">
          {measurement.notes.map((line) => (
            <p key={line} className="text-xs text-muted-foreground">{line}</p>
          ))}
        </div>
      )}
      {/* Shown beside a figure — or beside a REFUSAL, where it is the whole
          explanation: the building under the pin is the one the sentence is
          about, and a homeowner who can see it is a shed will fix the address. */}
      {(shown || preview?.refused || (isLawn && measurement?.lawn)) && measurement?.satelliteImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={measurement.satelliteImageUrl} alt={t.propertyAlt} className="w-full rounded-lg border border-border mt-3" />
      )}

      {/* "This doesn't look right?" — under every figure read off imagery,
          and under a refusal. Two humans-in-the-loop: the company's number,
          and a call-back request that flags the lead for an on-site visit.
          The estimate itself is untouched. */}
      {fromImagery(trade?.measure) && (shown || preview?.refused || result) && (
        <MeasurementDoubt
          companySlug={companySlug}
          companyPhone={company.phone || null}
          language={language}
          trade={trade.trade}
          address={address}
          quoteId={result?.quoteId || null}
          contact={contact}
          measurementSummary={measurementSummaryText(measurement, trade.measure, lawnCopy)}
          theme={theme}
          solid={solid}
        />
      )}

      {/* Said where a figure is shown OR promised, never on the empty state —
          disclaiming a number that isn't there yet is noise. Only the roof and
          the lawn are read from imagery; a door count "measured from satellite"
          is a claim the company would have to defend. */}
      {(shown || locked) && trade && !(shown && measurement?.notes?.length) && (
        <p className="text-xs text-muted-foreground mt-3">
          {t.disclaimer(t.measureSource[trade.measure] || t.measureSource.other, company.name)}
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
              className="inline-block mt-3 border px-4 py-2 min-h-11 rounded-lg text-sm font-semibold leading-7"
              style={{ background: solid.bg, color: solid.fg, borderColor: theme.accentText }}
            >
              {t.seeFinancing}
            </a>
          )}
        </div>
      )}

      {result && (
        <p className="text-xs text-muted-foreground mt-4 text-center">{t.reference(result.reference)}</p>
      )}
    </div>
  );
}

// One short line for the reviewer: what the homeowner was looking at when
// they said it did not look right. Facts the panel already shows, never a
// price. Staff-facing, so the units stay the estimator's.
function measurementSummaryText(m, measure, lawnCopy) {
  if (!m) return "";
  if (measure === "lawn_address" && m.lawn) {
    return `${lawnCopy.lawnSizeLabel}: ${m.lawn.sizeText}${m.lawn.source ? ` (${m.lawn.source})` : ""}`;
  }
  if (measure === "gutter_address") return [m.gutterFt != null && `${m.gutterFt} ft gutter`, m.downspouts != null && `${m.downspouts} downspouts`].filter(Boolean).join(", ");
  if (measure === "roof_address") return [m.squares != null && `${m.squares} squares`, m.areaSqft != null && `${Math.round(m.areaSqft)} sq ft`, m.predominantPitch && `${m.predominantPitch.rise}/12`].filter(Boolean).join(", ");
  if (m.areaSqft != null) return `${Math.round(m.areaSqft)} sq ft traced`;
  return "";
}

function SuccessCard({ result, company, theme, t }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      {/* accentText, not the raw brand: this tick is the confirmation that the
          form went through, and on a white or pale brand it was drawn in a
          colour the card already is. */}
      <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: theme.accentText }} />
      <h2 className="text-lg font-bold text-foreground mb-1">{t.allSet}</h2>
      <p className="text-sm text-muted-foreground mb-4">{t.hasYourDetails(company.name)}</p>
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

// Same min-h rule as the main root: a loading spinner or a "not available
// here" notice inside an iframe must not pin the frame at viewport height.
function Centered({ children, embedded = false }) {
  return (
    <div className={`${embedded ? "min-h-0 py-10" : "min-h-screen"} flex items-center justify-center p-6`}>
      {children}
    </div>
  );
}
