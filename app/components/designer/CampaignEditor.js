"use client";

// app/components/designer/CampaignEditor.js
//
// The multi-ratio campaign editor: tabs across every lib/marketing/ratios.js
// AD_RATIOS frame for one MarketingDesign, each frame's adjustments saved to
// its own MarketingDesignLayout row, plus "download all" which rasterises
// every ratio at once. This is "the feature, not a detail" per the
// coordinator's brief — the mechanics are documented at length below because
// getting the ratio-to-network-request routing wrong is a silent-data-
// corruption bug, not a cosmetic one.
//
// ══ Why this is its own ssr:false component, not inline in the page ═══════
//
// "Download all" rasterises every ratio through an offscreen fabric
// StaticCanvas (see rasterize() below), which means this file imports
// "fabric" directly. fabric@5.3.0-browser touches window/document at import
// time (DesignerLoader.js's own module doc). A dynamic `import("fabric")`
// inside a click handler looked like it would dodge that — it doesn't:
// Turbopack still resolves the specifier while analysing the module graph
// for BOTH the browser and the SSR bundle, even though the import call
// itself only ever executes client-side, and fabric's UMD wrapper has an
// `else` branch that `require("jsdom")` — a package this repo does not
// install, on purpose, because nothing here runs fabric under Node. Building
// the ordinary page that used to hold this logic failed with exactly that
// "Can't resolve 'jsdom'" error. Moving the fabric-touching code into a
// component reached only through next/dynamic(..., { ssr: false }) — see
// CampaignEditorLoader.js — is what DesignerLoader.js already does for
// Editor.js, for the identical reason; this is the same fix applied one
// layer up.
//
// ══ Why a tab click doesn't call editor.changeRatio() directly ═════════════
//
// Editor.js's save chain is built fresh on every render that changes its
// `saveCallback` prop identity (Editor.js's own debouncedSave is a useMemo
// keyed on it; useHistory's `save` closes over that; useEditor's `editor` is
// a useMemo closing over `save`). This file's saveCallback is deliberately
// re-created — via useCallback keyed on `activeRatio` STATE, not a ref — every
// time the active tab changes, specifically so a save that was ALREADY
// in-flight when the tab changed keeps calling the OLD closure (tagged for
// the OLD ratio) instead of being redirected to the new one by a mutable ref
// that the debounce's delayed callback would read at the wrong time.
//
// The consequence: `editor` itself is a NEW object after `activeRatio`
// changes, but only once React has re-rendered — not synchronously inside the
// click handler that called setActiveRatio(). Calling editor.changeRatio()
// right there would still be holding the OLD editor (tagged for the ratio
// being LEFT), so the reflow it triggers would save under the wrong tab. The
// pendingActionRef + useEffect below defers the actual changeRatio()/
// loadJson() call until AFTER that re-render has produced the new `editor`,
// via the onEditorReady wire added to Editor.js for exactly this.
//
// ══ Known coupling ══════════════════════════════════════════════════════════
//
// app/components/designer/SettingsSidebar.js also renders the AD_RATIOS
// presets (a general "resize the canvas" tool, unrelated to this component)
// and calls the same editor.changeRatio(). Using THAT control instead of a
// tab here reflows the canvas without going through pendingActionRef, so
// this component's `activeRatio` state would not follow it — the next
// autosave would still be tagged with whatever tab was last selected here.
// The tab bar below is the sanctioned way to switch ratios in the campaign
// editor; the general resize tool predates this component and is not
// disabled here.
//
// ══ Slides (carousels) and templates — 2026-09-29 ═══════════════════════════
//
// A design can hold 2–10 slides (lib/marketing/slides.js). Each slide has its
// own layout per format, exactly like slide 1 always had; the slide strip
// switches slide the same deferred way a tab switches format (pendingActionRef
// below), and the save callback is re-created per SLIDE as well as per format
// for the same in-flight-save reason. Slide 1 keeps its original URL
// (…/layouts/<ratio>); slide N+1 adds ?slide=N.
//
// Applying a template writes every slide in every format through that same
// save route — the template's own 4:5 / 9:16 / 1.91:1 layouts, and the other
// tabs this design shows derived from them with reflow() — so an applied
// template is an ordinary edit: fingerprinted, approvable, and never a
// half-replaced design with one format left over from before.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fabric } from "fabric";
import {
  ArrowLeft,
  BadgeCheck,
  BookmarkPlus,
  CalendarDays,
  Download,
  Loader2,
  Plus,
  Share2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError, showError } from "@/lib/clientErrors";
import DesignerLoader from "@/app/components/designer/DesignerLoader";
import PublishModal from "@/app/components/designer/PublishModal";
import TikTokPublishModal from "@/app/components/designer/TikTokPublishModal";
import ApprovalModal from "@/app/components/designer/ApprovalModal";
import { JSON_KEYS } from "@/lib/designer/constants";
import { downloadFile } from "@/lib/designer/utils";
import { placeholdersIn } from "@/lib/designer/placeholders";
import {
  DEFAULT_RATIO,
  ratio as ratioByKey,
  reflow,
  overflowing,
  assetFilename,
  openingRatio,
} from "@/lib/marketing/ratios";
import { destinationRatio, visibleRatios } from "@/lib/marketing/destinations";
import { MAX_SLIDES, groupSlides, reflowSourceKey } from "@/lib/marketing/slides";

// Renders `doc` (a parsed fabric document) to a data URL on an offscreen
// canvas, never touching the live editor. `format` defaults to "png" for
// "download all" (unchanged behaviour); the social publish flow below passes
// "jpeg" because Instagram's Content Publishing API only accepts JPEG
// (lib/social/metaSpecs.js's INSTAGRAM_IMAGE_SPEC) — a PNG export would fail
// on Meta's side with an error naming a format nobody on this screen chose.
// Resolves with the pixel size actually rendered, not just the data URL: the
// publish flow validates that size against Instagram's aspect-ratio rule
// before ever uploading it.
function rasterize(doc, fallbackWidth, fallbackHeight, format = "png") {
  return new Promise((resolve) => {
    const el = document.createElement("canvas");
    const canvas = new fabric.StaticCanvas(el, { width: fallbackWidth, height: fallbackHeight });
    canvas.loadFromJSON(doc, () => {
      const clip = canvas.getObjects().find((o) => o.name === "clip");
      const width = clip?.width ?? fallbackWidth;
      const height = clip?.height ?? fallbackHeight;
      const left = clip?.left ?? 0;
      const top = clip?.top ?? 0;
      // The clip rect's position on the (much larger, pannable) edit canvas
      // is wherever the live editor happened to centre it when this layout
      // was saved — not necessarily (0,0). useEditor.js's own
      // generateSaveOptions() gets away with cropping straight from
      // left/top because the LIVE canvas always fills the browser window,
      // which is bigger than the crop rectangle it's cutting out of. This
      // offscreen canvas has no window to inherit a size from, so it is
      // sized explicitly to contain the crop before cropping it.
      canvas.setDimensions({ width: left + width, height: top + height });
      // JPEG has no alpha channel — an unset canvas background composites
      // transparent pixels as BLACK per the canvas spec, which would turn
      // any design with see-through areas into a black rectangle behind the
      // artwork the moment it's exported for social. PNG already has no such
      // problem (alpha survives), so this only applies to the jpeg path.
      if (format === "jpeg") canvas.backgroundColor = "#ffffff";
      canvas.renderAll();
      // quality:0.92 keeps the file well under Instagram's 8MB cap at these
      // pixel sizes without a visible loss on a phone screen.
      const dataUrl = canvas.toDataURL({
        format,
        quality: format === "jpeg" ? 0.92 : undefined,
        width,
        height,
        left,
        top,
      });
      canvas.dispose();
      resolve({ dataUrl, width, height });
    });
  });
}

/** Slide 1 keeps the URL it always had; slide N+1 is ?slide=N. */
function layoutUrl(designId, ratioKey, slide) {
  return `/api/marketing/designer/designs/${designId}/layouts/${ratioKey}${slide > 0 ? `?slide=${slide}` : ""}`;
}

/** An empty frame: the workspace rect alone, at the origin. */
function blankDoc(frame) {
  return {
    version: "5.3.0",
    objects: [
      {
        type: "rect",
        name: "clip",
        originX: "left",
        originY: "top",
        left: 0,
        top: 0,
        width: frame.width,
        height: frame.height,
        fill: "#ffffff",
        stroke: null,
        strokeWidth: 0,
        scaleX: 1,
        scaleY: 1,
        angle: 0,
        opacity: 1,
        selectable: false,
        hasControls: false,
      },
    ],
  };
}

// How long the editor's own debounced autosave (500ms, Editor.js) needs to
// land before a slide is removed or a template replaces the design. A save
// still waiting in the debounce is tagged with the slide it was made on; if
// it fired AFTER the slides were renumbered it would write the old picture
// over the slide that moved into that position.
const SETTLE_MS = 800;
const settle = () => new Promise((resolve) => setTimeout(resolve, SETTLE_MS));

/**
 * @param {Object} props
 * @param {Object} props.design - the loaded MarketingDesign, with `layouts`
 *   (each `{ ratioKey, json, width, height }`), `slideLayouts` (carousel
 *   slides 2..n) and `campaign.name`.
 * @param {() => void} [props.onBack]
 */
export function CampaignEditor({ design, onBack }) {
  const { t } = useTranslation();

  // Every slide's layouts: [{ [ratioKey]: { json, width, height } }]. A ref,
  // not state: read synchronously from inside the tab/slide handlers and the
  // download and publish loops, none of which should wait on a re-render to
  // see a save that just landed. `layoutVersion` is bumped whenever it
  // changes, for the parts of the screen drawn from it.
  const slidesRef = useRef(groupSlides(design.layouts || [], design.slideLayouts || []));
  const [layoutVersion, setLayoutVersion] = useState(0);
  const bump = () => setLayoutVersion((v) => v + 1);
  const [slideTotal, setSlideTotal] = useState(() => slidesRef.current.length);
  const [activeSlide, setActiveSlide] = useState(0);

  // openingRatio(), not DEFAULT_RATIO directly: the default moved to 4:5 on
  // 2026-09-28, and a design saved before that must keep opening on the square
  // it was laid out on rather than on a portrait tab it has never had.
  const [activeRatio, setActiveRatio] = useState(() =>
    openingRatio((design.layouts || []).map((l) => l.ratioKey)),
  );

  const firstSlideKeys = Object.keys(slidesRef.current[0] || {});
  // The format Instagram gets (lib/marketing/destinations.js) — what the
  // approval dialog previews, so the image an approver signs off on is the
  // image that goes out. The square only for a design laid out square before
  // 4:5 existed; 4:5 for every other.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const publishShape = useMemo(() => destinationRatio("instagram", { savedKeys: firstSlideKeys }), [layoutVersion]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tabs = useMemo(() => visibleRatios(firstSlideKeys), [layoutVersion]);

  const [warnings, setWarnings] = useState(() => {
    const initial = {};
    slidesRef.current.forEach((slideMap, i) => {
      for (const [key, l] of Object.entries(slideMap)) {
        const frame = ratioByKey(key);
        if (!frame) continue;
        const overflow = overflowing(l.json, frame);
        if (overflow.length) initial[`${i}:${key}`] = overflow;
      }
    });
    return initial;
  });
  const [editorInstance, setEditorInstance] = useState(undefined);
  const [downloading, setDownloading] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [busy, setBusy] = useState(null); // null | "slide" | "template"
  const [templatesVersion, setTemplatesVersion] = useState(0);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  // "approved" | "stale" | "not_approved" | null (not known yet).
  //
  // null is a real third value, not a stand-in for "not approved": a failed
  // fetch must not paint an Approved design as unapproved, which would invite
  // somebody to press a button they already pressed. The badge renders nothing
  // until the answer arrives.
  const [approvalState, setApprovalState] = useState(null);
  // Whether Instagram/Facebook publishing is visible AT ALL for this
  // company — see docs/SOCIAL-SCHEDULING.md, "hidden until approved."
  // Starts false (not "loading") deliberately: AGENTS.md's rule is "either
  // it is not there, or it explains itself," and a Publish button that
  // flickers into existence after a fetch resolves is close enough to "not
  // there" that a brief false-start beats rendering a control before this
  // company's own visibility is confirmed. Reuses the SAME per-design
  // publish GET the modal itself calls when opened — one more request on
  // mount, not a second endpoint to keep in sync with it.
  const [socialVisible, setSocialVisible] = useState(false);
  // TikTok, on its own axis: drawn only when this deployment has TikTok's
  // credentials AND this company has an account connected — the button is the
  // destination, so it does not exist until there is somewhere to post. Starts
  // false for the reason socialVisible does. Independent of socialVisible on
  // purpose: Meta's review and TikTok's are separate, and one being pending
  // must not hide the other.
  const [tiktokReady, setTiktokReady] = useState(false);
  const [tiktokOpen, setTiktokOpen] = useState(false);
  // Which publish dialog "Review & approve" was opened from, so approving
  // returns the person to the same one.
  const [approvalReturn, setApprovalReturn] = useState("publish");

  // The approval state for the toolbar badge. Its OWN request rather than a
  // field on the publish GET — that route is about Meta, and for a real
  // company with no Meta app configured the whole publish surface is hidden,
  // while approval is reachable regardless. Hanging one off the other would
  // have made the approval badge disappear for exactly the companies that
  // still need to approve things.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/marketing/designer/designs/${design.id}/approval`);
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (!cancelled) setApprovalState(data.state);
      } catch {
        // Left at null — "not known" — for the reason the state's own comment
        // gives. A network blip must not relabel an approved design.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [design.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/marketing/designer/designs/${design.id}/publish`);
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (!cancelled) setSocialVisible(Boolean(data.visible));
      } catch {
        // Swallowed, same as CompanyPreferencesProvider's own fetch: the
        // safe failure direction for a feature gated on Meta approval is
        // "stays hidden," not "throws and takes the editor down with it."
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [design.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/marketing/designer/designs/${design.id}/tiktok`);
        if (cancelled || !res.ok) return;
        const data = await res.json();
        if (!cancelled) setTiktokReady(Boolean(data.available && data.connected));
      } catch {
        // Same safe direction as the Meta check above: stays hidden.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [design.id]);

  // { type: "load", doc } | { type: "reflow", ratioKey } | null
  const pendingActionRef = useRef(null);

  // Re-created per active ratio AND slide ON PURPOSE — see this file's
  // module doc.
  const saveCallback = useCallback(
    async (values) => {
      const ratioKey = activeRatio;
      const slide = activeSlide;
      const res = await fetch(layoutUrl(design.id, ratioKey, slide), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        await reportResponseError(res);
        // Rethrown so Editor.js's own debouncedSave sees the rejection and
        // sets saveStatus to "error" — its documented contract, not
        // reinvented here.
        throw new Error("save failed");
      }
      const saved = await res.json();
      const next = slidesRef.current.slice();
      next[slide] = { ...(next[slide] || {}), [ratioKey]: { json: saved.json, width: saved.width, height: saved.height } };
      slidesRef.current = next;
      bump();
      const frame = ratioByKey(ratioKey);
      const overflow = frame ? overflowing(saved.json, frame) : [];
      setWarnings((prev) => ({ ...prev, [`${slide}:${ratioKey}`]: overflow.length ? overflow : undefined }));
    },
    [design.id, activeRatio, activeSlide],
  );

  // Fires after EVERY identity change of `editor`, most of which have
  // nothing to do with a ratio switch (a colour picked, a shape selected —
  // see useEditor.js's own useMemo deps). pendingActionRef is what makes that
  // safe: the effect is a no-op unless a tab click just set it, and it clears
  // the ref immediately so it cannot fire twice.
  useEffect(() => {
    if (!editorInstance || !pendingActionRef.current) return;
    const action = pendingActionRef.current;
    pendingActionRef.current = null;

    if (action.type === "load") {
      editorInstance.loadJson(JSON.stringify(action.doc));
    } else {
      editorInstance.changeRatio(action.ratioKey);
    }
  }, [editorInstance]);

  function handleSelectRatio(ratioKey) {
    if (ratioKey === activeRatio) return;
    const saved = slidesRef.current[activeSlide]?.[ratioKey];
    pendingActionRef.current = saved
      ? { type: "load", doc: saved.json }
      : { type: "reflow", ratioKey };
    setActiveRatio(ratioKey);
  }

  /** What slide `i` looks like in format `ratioKey`, when it is not on screen. */
  function docForSlide(i, ratioKey) {
    const map = slidesRef.current[i] || {};
    if (map[ratioKey]) return map[ratioKey].json;
    const target = ratioByKey(ratioKey) || ratioByKey(DEFAULT_RATIO);
    const src = reflowSourceKey(map, target);
    if (src) return reflow(map[src].json, map[src], { width: target.width, height: target.height });
    return blankDoc(target);
  }

  function handleSelectSlide(i) {
    if (i === activeSlide || i < 0 || i >= slidesRef.current.length) return;
    pendingActionRef.current = { type: "load", doc: docForSlide(i, activeRatio) };
    setActiveSlide(i);
  }

  // The "what document, what pixel size, for this ratio of this slide"
  // resolution — live-on-screen if it's the open tab of the open slide (so a
  // download or a publish never ships a stale version of what you're LOOKING
  // at, which would be its own dead-control failure), else the saved layout,
  // else a fresh reflow() of that slide. Shared by handleDownloadAll's loop and
  // preparePublishAsset() — both need the exact same answer to "what would
  // this actually render as right now".
  const resolveRatioFrame = useCallback(
    (ratioKey, slide = 0) => {
      if (!editorInstance) return null;
      const liveWorkspace = editorInstance.getWorkspace();
      const liveFrame = liveWorkspace
        ? { width: liveWorkspace.width, height: liveWorkspace.height }
        : null;
      const onScreen = slide === activeSlide;

      if (onScreen && ratioKey === activeRatio && liveFrame) {
        return { doc: editorInstance.canvas.toJSON(JSON_KEYS), frame: liveFrame };
      }

      const map = slidesRef.current[slide];
      if (!map) return null;
      const saved = map[ratioKey];
      if (saved) {
        return { doc: saved.json, frame: { width: saved.width, height: saved.height } };
      }

      const r = ratioByKey(ratioKey);
      if (!r) return null;
      const target = { width: r.width, height: r.height };
      if (onScreen && liveFrame) {
        const liveDoc = editorInstance.canvas.toJSON(JSON_KEYS);
        return { doc: reflow(liveDoc, liveFrame, target), frame: target };
      }
      const src = reflowSourceKey(map, target);
      if (src) return { doc: reflow(map[src].json, map[src], target), frame: target };
      return null;
    },
    [editorInstance, activeRatio, activeSlide],
  );

  async function handleDownloadAll() {
    if (!editorInstance || downloading) return;
    setDownloading(true);
    try {
      for (let s = 0; s < slidesRef.current.length; s++) {
        for (const r of tabs) {
          const resolved = resolveRatioFrame(r.key, s);
          if (!resolved) continue;

          // eslint-disable-next-line no-await-in-loop
          const { dataUrl } = await rasterize(resolved.doc, resolved.frame.width, resolved.frame.height, "png");
          const name = assetFilename(design?.campaign?.name, r.key).replace(/\.png$/, "");
          // A carousel's files say which slide they are, in order.
          downloadFile(dataUrl, "png", slidesRef.current.length > 1 ? `${name}-${s + 1}` : name);
          // A browser blocks a burst of same-tick downloads as a popup storm;
          // spacing them out is what keeps all of them actually landing.
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } finally {
      setDownloading(false);
    }
  }

  // For PublishModal's "Generate with AI" caption button: every photo URL
  // actually placed on the LIVE canvas right now, read straight off the
  // fabric objects rather than from any saved layout — the same "what's
  // really on screen, not the last save" instinct resolveRatioFrame applies
  // to the active tab. A function, not a memoised value, because the canvas
  // mutates on every drag/add/remove and PublishModal only needs the answer
  // at the moment someone presses the button, not a value kept in sync on
  // every keystroke.
  //
  // fabric.Image objects expose their url via getSrc() — see
  // useEditor.js's addImage(), the one place an image object is ever
  // created here. Filtered to http(s) only: complete() in
  // lib/ai/provider.js would silently drop a data:/blob: URL anyway, and
  // POST /api/designer/copy refuses a request with no usable URLs at all
  // rather than quietly captioning nothing.
  const getCanvasPhotoUrls = useCallback(() => {
    if (!editorInstance?.canvas) return [];
    return editorInstance.canvas
      .getObjects()
      .filter((o) => o.type === "image" && typeof o.getSrc === "function")
      .map((o) => o.getSrc())
      .filter((src) => typeof src === "string" && /^https?:\/\//.test(src));
  }, [editorInstance]);

  // For the publish dialogs: rasterise ONE slide in ONE format as a JPEG
  // (Instagram's required format — see the rasterize() header) and hand back
  // the data URL plus the pixel size actually rendered, so the dialog can run
  // lib/social/metaSpecs.js's checks against the REAL output before anything
  // is uploaded. `slide` defaults to the first — every caller before carousels
  // asked for exactly that.
  const preparePublishAsset = useCallback(
    async (ratioKey, slide = 0) => {
      const resolved = resolveRatioFrame(ratioKey, slide);
      if (!resolved) return null;
      const { dataUrl, width, height } = await rasterize(
        resolved.doc,
        resolved.frame.width,
        resolved.frame.height,
        "jpeg",
      );
      return { dataUrl, width, height };
    },
    [resolveRatioFrame],
  );

  // ── Slides ──────────────────────────────────────────────────────────────

  /** PUT one layout to slide `slide`; returns the saved layout or null. */
  async function putLayout(slide, ratioKey, layout) {
    const res = await fetch(layoutUrl(design.id, ratioKey, slide), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ json: JSON.stringify(layout.json), width: layout.width, height: layout.height }),
    });
    if (!res.ok) {
      await reportResponseError(res);
      return null;
    }
    const saved = await res.json();
    return { json: saved.json, width: saved.width, height: saved.height };
  }

  // "Add slide" starts from a copy of the slide on screen, every format it
  // has — the next slide of a project story usually keeps the same look.
  async function handleAddSlide() {
    if (!editorInstance || busy || slidesRef.current.length >= MAX_SLIDES) return;
    setBusy("slide");
    try {
      const n = slidesRef.current.length;
      const source = { ...(slidesRef.current[activeSlide] || {}) };
      const ws = editorInstance.getWorkspace();
      if (ws) source[activeRatio] = { json: editorInstance.canvas.toJSON(JSON_KEYS), width: ws.width, height: ws.height };
      const copy = {};
      for (const [key, layout] of Object.entries(source)) {
        // eslint-disable-next-line no-await-in-loop
        const saved = await putLayout(n, key, layout);
        if (!saved) return;
        copy[key] = saved;
      }
      slidesRef.current = [...slidesRef.current, copy];
      setSlideTotal(slidesRef.current.length);
      bump();
      pendingActionRef.current = { type: "load", doc: docForSlide(n, activeRatio) };
      setActiveSlide(n);
    } finally {
      setBusy(null);
    }
  }

  async function handleRemoveSlide() {
    if (activeSlide === 0 || busy) return;
    if (!window.confirm(t("app.marketingDesigner.slides.removeConfirm", "Remove this slide? Its layouts in every format are deleted."))) return;
    setBusy("slide");
    try {
      const removing = activeSlide;
      await settle();
      const res = await fetch(`/api/marketing/designer/designs/${design.id}/slides/${removing}`, { method: "DELETE" });
      if (!res.ok) {
        await reportResponseError(res);
        return;
      }
      const next = slidesRef.current.slice();
      next.splice(removing, 1);
      slidesRef.current = next;
      setSlideTotal(next.length);
      setWarnings({});
      bump();
      pendingActionRef.current = { type: "load", doc: docForSlide(removing - 1, activeRatio) };
      setActiveSlide(removing - 1);
    } finally {
      setBusy(null);
    }
  }

  // ── Templates ───────────────────────────────────────────────────────────

  // Called by TemplateSidebar after the person confirmed the replacement.
  const applyTemplate = useCallback(
    async (template) => {
      if (!editorInstance || busy) return false;
      setBusy("template");
      try {
        const res = await fetch(`/api/designer/templates/${template.id}/fill`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          await reportResponseError(res);
          return false;
        }
        const data = await res.json();
        const filled = Array.isArray(data.slides) ? data.slides : [];

        // The two original single-document starters: they only ever replaced
        // the canvas on screen, and still do.
        if (data.legacy) {
          const only = filled[0]?.legacy;
          if (only?.json) editorInstance.loadJson(JSON.stringify(only.json));
          return Boolean(only?.json);
        }
        if (!filled.length) return false;

        // Every tab this design shows gets a layout: the template's own for
        // its three formats, a reflow of the closest one for the rest (a Story
        // from the 9:16, a YouTube thumbnail from the 1.91:1).
        const tabKeys = tabs.map((r) => r.key);
        const next = filled.slice(0, MAX_SLIDES).map((map) => {
          const out = { ...map };
          for (const key of tabKeys) {
            if (out[key]) continue;
            const r = ratioByKey(key);
            const src = reflowSourceKey(map, r);
            if (src) out[key] = { json: reflow(map[src].json, map[src], r), width: r.width, height: r.height };
          }
          return out;
        });

        await settle();
        // Extra slides the template does not have go, last first, so the
        // positions never leave a gap mid-way.
        for (let p = slidesRef.current.length - 1; p >= next.length; p--) {
          // eslint-disable-next-line no-await-in-loop
          const del = await fetch(`/api/marketing/designer/designs/${design.id}/slides/${p}`, { method: "DELETE" });
          if (!del.ok && del.status !== 404) {
            await reportResponseError(del);
            return false;
          }
        }
        const saved = [];
        for (let i = 0; i < next.length; i++) {
          const map = {};
          for (const [key, layout] of Object.entries(next[i])) {
            // eslint-disable-next-line no-await-in-loop
            const s = await putLayout(i, key, layout);
            if (!s) return false;
            map[key] = s;
          }
          saved.push(map);
        }
        slidesRef.current = saved;
        setSlideTotal(saved.length);
        setWarnings({});
        bump();
        const doc = saved[0][activeRatio]?.json || docForSlide(0, activeRatio);
        if (activeSlide === 0) {
          editorInstance.loadJson(JSON.stringify(doc));
        } else {
          pendingActionRef.current = { type: "load", doc };
          setActiveSlide(0);
        }
        return true;
      } finally {
        setBusy(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorInstance, busy, tabs, activeRatio, activeSlide, design.id],
  );

  // "Save as template": the layouts on the SERVER are what becomes the
  // template (the route reads them itself), so the tab on screen is saved
  // first — otherwise the last half-second of editing would be left out.
  async function handleSaveTemplate(e) {
    e?.preventDefault?.();
    const name = templateName.trim();
    if (!name) {
      showError(t("app.marketingDesigner.saveTemplate.nameRequired", "Give the template a name."));
      return;
    }
    if (!editorInstance) return;
    setSavingTemplate(true);
    try {
      const ws = editorInstance.getWorkspace();
      if (ws) {
        try {
          await saveCallback({ json: JSON.stringify(editorInstance.canvas.toJSON(JSON_KEYS)), width: ws.width, height: ws.height });
        } catch {
          return; // saveCallback already reported it
        }
      }
      const res = await fetch("/api/designer/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId: design.id, name }),
      });
      if (!res.ok) {
        await reportResponseError(res);
        return;
      }
      setTemplatesVersion((v) => v + 1);
      setTemplateSaved(true);
      setTemplateName("");
    } finally {
      setSavingTemplate(false);
    }
  }

  // Computed ONCE, off the design this component mounted with — Editor.js
  // reads initialData through a useRef on mount and never again (its own
  // module doc), so recomputing this on every activeRatio change would be
  // dead weight, not a reload. Tab switches go through pendingActionRef/
  // loadJson/changeRatio instead. Empty deps is deliberate for that reason.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialData = useMemo(() => {
    const saved = slidesRef.current[0]?.[activeRatio];
    if (saved) {
      return { json: JSON.stringify(saved.json), width: saved.width, height: saved.height };
    }
    const frame = ratioByKey(activeRatio) || ratioByKey(DEFAULT_RATIO);
    return { width: frame.width, height: frame.height };
  }, []);

  const anyOverflow = Object.values(warnings).some((w) => w && w.length > 0);
  // What is still a template placeholder anywhere on the design — the same
  // count both publish routes refuse on (lib/designer/placeholders.js).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const placeholders = useMemo(() => placeholdersIn(slidesRef.current.flatMap((m) => Object.values(m))), [layoutVersion]);
  const activeMap = slidesRef.current[activeSlide] || {};

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      {/* Wraps before it scrolls. At 1280 with the rail open, a single
          scrolling row put Calendar and Publish past the right edge — the
          one control the page exists for, reachable only by a sideways
          scroll nobody knew to try. The scroll stays for a phone, where the
          ratio tabs alone are wider than the screen. */}
      <div className="shrink-0 border-b border-border bg-card px-3 py-2 flex flex-wrap items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0 pr-2"
        >
          <ArrowLeft size={14} /> {t("app.marketingDesigner.backToDesigns")}
        </button>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* The format tabs: every preset but the square, which only a design
            already laid out square still has (destinations.js). */}
        <div data-tour="designer-ratios" className="flex items-center gap-1 shrink-0">
          {tabs.map((r) => {
            const isActive = r.key === activeRatio;
            const hasSaved = Boolean(activeMap[r.key]);
            const hasWarning = Boolean(warnings[`${activeSlide}:${r.key}`]?.length);
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => handleSelectRatio(r.key)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-inverted text-inverted-foreground"
                    : hasSaved
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted"
                }`}
                title={`${r.width}×${r.height}`}
              >
                {hasWarning && <TriangleAlert size={11} className="text-amber-500" />}
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="h-5 w-px bg-border shrink-0" />

        {/* The slide strip. One slide is an ordinary post; two to ten are a
            carousel on Instagram, a multi-photo post on Facebook and a
            photo-mode post on TikTok. */}
        <div className="flex items-center gap-1 shrink-0" data-designer-slides>
          <span className="text-xs text-muted-foreground pr-1">{t("app.marketingDesigner.slides.label", "Slides")}</span>
          {Array.from({ length: slideTotal }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => handleSelectSlide(i)}
              disabled={Boolean(busy)}
              aria-label={t("app.marketingDesigner.slides.goTo", "Slide {n}", { n: i + 1 })}
              className={`min-w-[28px] h-7 rounded-full text-xs font-semibold ${
                i === activeSlide ? "bg-inverted text-inverted-foreground" : "bg-muted text-foreground"
              }`}
            >
              {i + 1}
            </button>
          ))}
          {slideTotal < MAX_SLIDES && (
            <button
              type="button"
              onClick={handleAddSlide}
              disabled={!editorInstance || Boolean(busy)}
              title={t("app.marketingDesigner.slides.add", "Add a slide")}
              aria-label={t("app.marketingDesigner.slides.add", "Add a slide")}
              className="h-7 w-7 rounded-full border border-border flex items-center justify-center disabled:opacity-60"
            >
              {busy === "slide" ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />}
            </button>
          )}
          {activeSlide > 0 && (
            <button
              type="button"
              onClick={handleRemoveSlide}
              disabled={Boolean(busy)}
              title={t("app.marketingDesigner.slides.remove", "Remove this slide")}
              aria-label={t("app.marketingDesigner.slides.remove", "Remove this slide")}
              className="h-7 w-7 rounded-full border border-border flex items-center justify-center text-muted-foreground disabled:opacity-60"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <div className="flex-1" />

        {placeholders.count > 0 && (
          <span
            data-designer-placeholders
            className="flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2.5 py-1 text-xs font-medium shrink-0"
            title={t(
              "app.marketingDesigner.placeholders.hint",
              "Bracketed text and \"Add a photo\" boxes came from the template. Replace or delete each one — nothing can be posted while one is left.",
            )}
          >
            <TriangleAlert size={12} />
            {t("app.marketingDesigner.placeholders.count", { value: placeholders.count })}
          </span>
        )}

        {busy === "template" && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Loader2 size={12} className="animate-spin" /> {t("app.marketingDesigner.templates.applying", "Applying template…")}
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            setTemplateSaved(false);
            setSaveTemplateOpen(true);
          }}
          disabled={!editorInstance}
          className="flex items-center gap-2 border border-border text-foreground px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-60 shrink-0"
          data-save-template
        >
          <BookmarkPlus size={13} />
          {t("app.marketingDesigner.saveTemplate.button", "Save as template")}
        </button>

        <button
          type="button"
          onClick={handleDownloadAll}
          disabled={downloading || !editorInstance}
          data-tour="designer-download"
          className="flex items-center gap-2 border border-border text-foreground px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-60 shrink-0"
        >
          <Download size={13} />
          {downloading ? t("app.marketingDesigner.downloading") : t("app.marketingDesigner.downloadAll")}
        </button>

        {/* Always rendered, for every company, whatever Meta has approved —
            the gate has to be reachable or it isn't a gate. See
            ApprovalModal.js's header for why approval does not live inside
            the publish dialog. */}
        <button
          type="button"
          onClick={() => setApprovalOpen(true)}
          disabled={!editorInstance}
          data-tour="designer-approve"
          className="flex items-center gap-2 border border-border text-foreground px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-60 shrink-0"
        >
          <BadgeCheck
            size={13}
            className={approvalState === "approved" ? "text-emerald-600 dark:text-emerald-400" : undefined}
          />
          {approvalState === "approved"
            ? t("app.marketingDesigner.approval.badgeApproved", "Approved")
            : approvalState === "stale"
              ? t("app.marketingDesigner.approval.badgeStale", "Re-approve")
              : t("app.marketingDesigner.approval.badgeReview", "Review & approve")}
        </button>

        {/* Both rendered ONLY when socialVisible — docs/SOCIAL-SCHEDULING.md's
            "hide until Meta approves the app" — rather than always-visible-
            but-disabled or always-visible-but-honest-in-the-modal. That was
            the earlier design (see the comment this replaced, and
            PublishModal.js's own header, still accurate for what happens
            once this IS visible): a real company with no Meta connection
            saw a working dialog that explained "not connected yet." The
            owner's later instruction was stricter — nothing about
            Instagram/Facebook should be reachable at all until Meta's own
            App Review clears, for either platform — so the button and the
            dialog behind it are absent rather than explaining themselves,
            for a real company, until metaAppConfigured() is true. A demo
            company (isDemo) is always visible; see
            lib/social/metaConnection.js and metaSpecs.js's
            isSocialPublishingVisible(). */}
        {socialVisible && (
          <Link
            href="/app/marketing/designer/calendar"
            className="flex items-center gap-2 border border-border text-foreground px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <CalendarDays size={13} />
            {t("app.marketingDesigner.calendarLink", "Calendar")}
          </Link>
        )}
        {/* ONE Publish button for every destination. Drawn when Facebook/
            Instagram is visible (as before) OR a TikTok account is connected
            — TikTok's review is separate from Meta's, so either one alone is
            enough. With Meta visible it opens the Publish dialog, where TikTok
            is one more destination; with only TikTok it opens TikTok's own
            composer directly, because a Meta dialog for a company with no
            Meta app would be the dead control this repo removes. */}
        {(socialVisible || tiktokReady) && (
          <button
            type="button"
            onClick={() => (socialVisible ? setPublishOpen(true) : setTiktokOpen(true))}
            disabled={!editorInstance}
            className="flex items-center gap-2 bg-inverted text-inverted-foreground px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-60 shrink-0"
            data-publish-open
          >
            <Share2 size={13} />
            {t("app.marketingDesigner.publish")}
          </button>
        )}
      </div>

      {anyOverflow && (
        <div className="shrink-0 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 text-xs px-3 py-1.5 flex items-center gap-1.5">
          <TriangleAlert size={12} />
          {t("app.marketingDesigner.overflowWarning", {
            count: Object.values(warnings).filter((w) => w && w.length).length,
          })}
        </div>
      )}

      <div className="flex-1 relative min-h-0">
        <DesignerLoader
          initialData={initialData}
          saveCallback={saveCallback}
          onEditorReady={setEditorInstance}
          onApplyTemplate={applyTemplate}
          templatesVersion={templatesVersion}
        />
      </div>

      {saveTemplateOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={savingTemplate ? undefined : () => setSaveTemplateOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveTemplate}
            onClick={(e) => e.stopPropagation()}
            className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-6 space-y-3"
          >
            <h2 className="text-lg font-semibold text-foreground">
              {t("app.marketingDesigner.saveTemplate.title", "Save as a template")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "app.marketingDesigner.saveTemplate.body",
                "Every slide and every format of this design becomes one of your company's templates. Only your team sees it.",
              )}
            </p>
            {templateSaved ? (
              <p className="text-sm text-foreground flex items-center gap-2" data-template-saved>
                <BadgeCheck size={14} className="text-emerald-700 dark:text-emerald-400" />
                {t("app.marketingDesigner.saveTemplate.saved", "Saved. It's under “Your templates” in the Templates panel.")}
              </p>
            ) : (
              <input
                autoFocus
                value={templateName}
                maxLength={80}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={t("app.marketingDesigner.saveTemplate.namePlaceholder", "Template name")}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-background"
              />
            )}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setSaveTemplateOpen(false)}
                disabled={savingTemplate}
                className="flex-1 border border-border rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {templateSaved ? t("app.marketingDesigner.publishModal.close") : t("app.marketingDesigner.publishModal.cancel")}
              </button>
              {!templateSaved && (
                <button
                  type="submit"
                  disabled={savingTemplate || !templateName.trim()}
                  className="flex-1 bg-inverted text-inverted-foreground rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {savingTemplate ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />}
                  {t("app.marketingDesigner.saveTemplate.confirm", "Save template")}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Both halves are load-bearing: socialVisible keeps the whole modal
          out of the tree for a real company with no Meta app configured (a
          disabled Publish button is the dead control this repo removes), and
          getCanvasPhotoUrls is what lets the AI copy generator know which job
          photos are on the canvas. Neither survives without the other. */}
      {socialVisible && (
        <PublishModal
          isOpen={publishOpen}
          onClose={() => setPublishOpen(false)}
          design={design}
          preparePublishAsset={preparePublishAsset}
          savedKeys={firstSlideKeys}
          slideCount={slideTotal}
          onOpenApproval={() => {
            setPublishOpen(false);
            setApprovalReturn("publish");
            setApprovalOpen(true);
          }}
          tiktokConnected={tiktokReady}
          onChooseTikTok={() => {
            setPublishOpen(false);
            setTiktokOpen(true);
          }}
        />
      )}

      {tiktokReady && (
        <TikTokPublishModal
          isOpen={tiktokOpen}
          onClose={() => setTiktokOpen(false)}
          design={design}
          preparePublishAsset={preparePublishAsset}
          slideCount={slideTotal}
          onOpenApproval={() => {
            setTiktokOpen(false);
            setApprovalReturn("tiktok");
            setApprovalOpen(true);
          }}
        />
      )}

      {/* NOT gated on socialVisible — see the toolbar button above. The words
          and the sign-off are the contractor's own business; Meta's App
          Review only decides where the finished thing can go. */}
      <ApprovalModal
        isOpen={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        design={design}
        preparePublishAsset={preparePublishAsset}
        previewShape={publishShape}
        slideCount={slideTotal}
        getCanvasPhotoUrls={getCanvasPhotoUrls}
        onDownloadAll={handleDownloadAll}
        socialVisible={socialVisible || tiktokReady}
        onOpenPublish={() => {
          setApprovalOpen(false);
          // Back to whichever dialog sent the person here to approve; TikTok's
          // composer when Meta publishing is not visible at all.
          if (approvalReturn === "tiktok" || !socialVisible) setTiktokOpen(true);
          else setPublishOpen(true);
        }}
        onStateChange={setApprovalState}
      />
    </div>
  );
}
