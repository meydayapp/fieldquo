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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { fabric } from "fabric";
import { ArrowLeft, CalendarDays, Download, Share2, TriangleAlert } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import DesignerLoader from "@/app/components/designer/DesignerLoader";
import PublishModal from "@/app/components/designer/PublishModal";
import { JSON_KEYS } from "@/lib/designer/constants";
import { downloadFile } from "@/lib/designer/utils";
import {
  AD_RATIOS,
  DEFAULT_RATIO,
  ratio as ratioByKey,
  reflow,
  overflowing,
  assetFilename,
} from "@/lib/marketing/ratios";

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

/**
 * @param {Object} props
 * @param {Object} props.design - the loaded MarketingDesign, with `layouts`
 *   (each `{ ratioKey, json, width, height }`) and `campaign.name`.
 * @param {() => void} [props.onBack]
 */
export function CampaignEditor({ design, onBack }) {
  const { t } = useTranslation();

  const [activeRatio, setActiveRatio] = useState(() => {
    const has = (design.layouts || []).some((l) => l.ratioKey === DEFAULT_RATIO);
    return has ? DEFAULT_RATIO : design.layouts?.[0]?.ratioKey || DEFAULT_RATIO;
  });
  const [warnings, setWarnings] = useState(() => {
    const initial = {};
    for (const l of design.layouts || []) {
      const frame = ratioByKey(l.ratioKey);
      if (!frame) continue;
      const overflow = overflowing(l.json, frame);
      if (overflow.length) initial[l.ratioKey] = overflow;
    }
    return initial;
  });
  const [editorInstance, setEditorInstance] = useState(undefined);
  const [downloading, setDownloading] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
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

  // Keyed by ratioKey -> { json (parsed object), width, height }. A ref, not
  // state: read synchronously from inside the tab-click handler and the
  // download-all loop, neither of which should wait on a re-render to see a
  // save that just landed.
  const layoutsRef = useRef(
    Object.fromEntries(
      (design.layouts || []).map((l) => [l.ratioKey, { json: l.json, width: l.width, height: l.height }]),
    ),
  );
  // { type: "load", doc } | { type: "reflow", ratioKey } | null
  const pendingActionRef = useRef(null);

  // Re-created per active ratio ON PURPOSE — see this file's module doc.
  const saveCallback = useCallback(
    async (values) => {
      const ratioKey = activeRatio;
      const res = await fetch(
        `/api/marketing/designer/designs/${design.id}/layouts/${ratioKey}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      if (!res.ok) {
        await reportResponseError(res);
        // Rethrown so Editor.js's own debouncedSave sees the rejection and
        // sets saveStatus to "error" — its documented contract, not
        // reinvented here.
        throw new Error("save failed");
      }
      const saved = await res.json();
      layoutsRef.current = {
        ...layoutsRef.current,
        [ratioKey]: { json: saved.json, width: saved.width, height: saved.height },
      };
      const frame = ratioByKey(ratioKey);
      const overflow = frame ? overflowing(saved.json, frame) : [];
      setWarnings((prev) => ({ ...prev, [ratioKey]: overflow.length ? overflow : undefined }));
    },
    [design.id, activeRatio],
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
    const saved = layoutsRef.current[ratioKey];
    pendingActionRef.current = saved
      ? { type: "load", doc: saved.json }
      : { type: "reflow", ratioKey };
    setActiveRatio(ratioKey);
  }

  // The "what document, what pixel size, for this one ratio" resolution —
  // live-on-screen if it's the open tab (so a download or a publish never
  // ships a stale version of the tab you're LOOKING at, which would be its
  // own dead-control failure), else the saved layout, else a fresh reflow()
  // for a ratio nobody has opened yet. Shared by handleDownloadAll's loop
  // below and preparePublishAsset() (PublishModal.js's caller) — both need
  // the exact same answer to "what would ratio X actually render as right
  // now", and this was two copies of that question before the social flow
  // needed to ask it a second time.
  const resolveRatioFrame = useCallback(
    (ratioKey) => {
      if (!editorInstance) return null;
      const liveWorkspace = editorInstance.getWorkspace();
      const liveFrame = liveWorkspace
        ? { width: liveWorkspace.width, height: liveWorkspace.height }
        : null;

      if (ratioKey === activeRatio && liveFrame) {
        return { doc: editorInstance.canvas.toJSON(JSON_KEYS), frame: liveFrame };
      }

      const saved = layoutsRef.current[ratioKey];
      if (saved) {
        return { doc: saved.json, frame: { width: saved.width, height: saved.height } };
      }

      if (liveFrame) {
        const r = ratioByKey(ratioKey);
        if (!r) return null;
        const liveDoc = editorInstance.canvas.toJSON(JSON_KEYS);
        return {
          doc: reflow(liveDoc, liveFrame, { width: r.width, height: r.height }),
          frame: { width: r.width, height: r.height },
        };
      }

      return null;
    },
    [editorInstance, activeRatio],
  );

  async function handleDownloadAll() {
    if (!editorInstance || downloading) return;
    setDownloading(true);
    try {
      for (const r of AD_RATIOS) {
        const resolved = resolveRatioFrame(r.key);
        if (!resolved) continue;

        // eslint-disable-next-line no-await-in-loop
        const { dataUrl } = await rasterize(resolved.doc, resolved.frame.width, resolved.frame.height, "png");
        downloadFile(dataUrl, "png", assetFilename(design?.campaign?.name, r.key));
        // A browser blocks a burst of same-tick downloads as a popup storm;
        // spacing them out is what keeps all five actually landing.
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => setTimeout(resolve, 200));
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

  // For PublishModal: rasterise ONE ratio as a JPEG (Instagram's required
  // format — see the rasterize() header) and hand back the data URL plus the
  // pixel size actually rendered, so the modal can run
  // lib/social/metaSpecs.js's validateImageForInstagram() against the REAL
  // output before anything is uploaded, not against AD_RATIOS' nominal
  // width/height which a hand-adjusted layout may no longer match exactly.
  const preparePublishAsset = useCallback(
    async (ratioKey) => {
      const resolved = resolveRatioFrame(ratioKey);
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

  // Computed ONCE, off the design this component mounted with — Editor.js
  // reads initialData through a useRef on mount and never again (its own
  // module doc), so recomputing this on every activeRatio change would be
  // dead weight, not a reload. Tab switches go through pendingActionRef/
  // loadJson/changeRatio instead. Empty deps is deliberate for that reason.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialData = useMemo(() => {
    const saved = layoutsRef.current[activeRatio];
    if (saved) {
      return { json: JSON.stringify(saved.json), width: saved.width, height: saved.height };
    }
    const frame = ratioByKey(activeRatio) || ratioByKey(DEFAULT_RATIO);
    return { width: frame.width, height: frame.height };
  }, []);

  const anyOverflow = Object.values(warnings).some((w) => w && w.length > 0);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border bg-card px-3 py-2 flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground shrink-0 pr-2"
        >
          <ArrowLeft size={14} /> {t("app.marketingDesigner.backToDesigns")}
        </button>

        <div className="h-5 w-px bg-border shrink-0" />

        <div data-tour="designer-ratios" className="flex items-center gap-1 shrink-0">
          {AD_RATIOS.map((r) => {
            const isActive = r.key === activeRatio;
            const hasSaved = Boolean(layoutsRef.current[r.key]);
            const hasWarning = Boolean(warnings[r.key]?.length);
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

        <div className="flex-1" />

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
          <>
            <Link
              href="/app/marketing/designer/calendar"
              className="flex items-center gap-2 border border-border text-foreground px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <CalendarDays size={13} />
              {t("app.marketingDesigner.calendarLink", "Calendar")}
            </Link>
            <button
              type="button"
              onClick={() => setPublishOpen(true)}
              disabled={!editorInstance}
              className="flex items-center gap-2 bg-inverted text-inverted-foreground px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap disabled:opacity-60 shrink-0"
            >
              <Share2 size={13} />
              {t("app.marketingDesigner.publish")}
            </button>
          </>
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
        />
      </div>

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
          getCanvasPhotoUrls={getCanvasPhotoUrls}
        />
      )}
    </div>
  );
}
