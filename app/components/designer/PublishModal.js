"use client";

// app/components/designer/PublishModal.js
//
// The "publish this design to Instagram/Facebook" confirmation dialog,
// opened from CampaignEditor.js's Publish button.
//
// ══ Why this exists as its own file, and its own honest state ═════════════
//
// Publishing is outward-facing and irreversible — a real post, to a real
// audience, under the contractor's own brand, with no unsend. That is a
// bigger commitment than the "delete this design?" window.confirm() this
// screen already had before this file, and app/components/SendConfirmModal.js
// already established the pattern for exactly this kind of screen (see its
// own header) — a rendered modal that names the specific thing being
// committed to, rather than a browser-native confirm() an automated click
// sails through unnoticed. This dialog goes further than that one because
// there is more to confirm: which account, which image, and a caption with
// real length limits, not just a recipient string.
//
// ══ Why the Publish button can render even though nothing can publish yet ══
//
// lib/social/metaConnection.js's getMetaConnection() always returns
// connected: false in this build — there is no Meta OAuth/token layer wired
// in yet (see that file's header). AGENTS.md's rule is "don't render a dead
// button", not "don't render a button for an unfinished feature" — the
// difference is what happens when it's clicked. A dead button clicks and
// does nothing, or fakes success. This one always opens a real dialog: the
// caption editor and image preview below are fully functional today (they
// validate against Meta's real rules, useful on its own before the
// connection ever lands), and the one thing that's honestly not available —
// the actual Meta call — is stated in plain language instead of offered.
// That's the "Coming soon panel is honest" half of the same rule, applied to
// the one part of the screen that truly isn't finished.
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock,
  FlaskConical,
  Loader2,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
// lucide-react 1.x dropped brand/trademark icons (Facebook, Instagram, …) —
// there is no icon here to stand in for either platform, so the checkbox
// labels below carry the platform by name/handle alone rather than reaching
// for a lookalike icon that isn't actually either brand's mark.
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import {
  validateCaption,
  validateImageForInstagram,
  INSTAGRAM_CAPTION_SPEC,
  isValidFacebookScheduleTime,
  isValidScheduleTime,
  FACEBOOK_SCHEDULE_MIN_MINUTES,
  FACEBOOK_SCHEDULE_MAX_DAYS,
} from "@/lib/social/metaSpecs";

// The datetime-local picker's own min/max — the INTERSECTION of Facebook's
// Meta-enforced window and FieldQuo's own Instagram window, so a single
// control stays honest whichever platform(s) end up checked. Facebook's is
// the tighter window on both ends (10min/75days vs FieldQuo's own 5min/
// 180days for Instagram — see metaSpecs.js) so it's the one the widget's
// browser-native min/max attributes use; the real per-platform check still
// happens server-side either way, this is only the picker's guardrail.
function scheduleBounds(now) {
  return {
    min: new Date(now.getTime() + FACEBOOK_SCHEDULE_MIN_MINUTES * 60 * 1000),
    max: new Date(now.getTime() + FACEBOOK_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000),
  };
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time with no offset — the
// browser interprets a bare value that way on both read and write, which is
// exactly what keeps this DST-safe: no manual offset math happens anywhere
// in this file, only Date's own local-time getters and its own parsing of
// what the input hands back.
function toLocalInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// The only two AD_RATIOS crops this dialog will ever offer — both verified
// compliant with Instagram's 4:5–1.91:1 aspect-ratio gate in
// lib/social/metaSpecs.js's own comment on INSTAGRAM_COMPLIANT_RATIO_KEY. A
// Story (9:16) or TikTok crop is never offered here, because Instagram's
// feed endpoint would reject it outright rather than letter-box it.
const SHAPES = [
  { key: "instagram_post", labelKey: "app.marketingDesigner.publishModal.shapeSquare" },
  { key: "facebook_feed", labelKey: "app.marketingDesigner.publishModal.shapeLandscape" },
];

const CAPTION_ERROR_KEYS = {
  empty: "app.marketingDesigner.publishModal.captionEmpty",
  too_long: "app.marketingDesigner.publishModal.captionTooLong",
  too_many_hashtags: "app.marketingDesigner.publishModal.tooManyHashtags",
  too_many_mentions: "app.marketingDesigner.publishModal.tooManyMentions",
};

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {{id:string,name:string,campaign?:{name?:string}}} props.design
 * @param {(ratioKey: string) => Promise<{dataUrl:string,width:number,height:number}|null>} props.preparePublishAsset
 * @param {() => string[]} props.getCanvasPhotoUrls  every photo URL currently
 *   on the canvas — see CampaignEditor.js's own comment on this function.
 *   Backs the "Generate with AI" caption button below; optional so this
 *   modal doesn't break if a future caller doesn't wire it, in which case
 *   the button simply doesn't render (see the render guard below it).
 */
export default function PublishModal({ isOpen, onClose, design, preparePublishAsset, getCanvasPhotoUrls }) {
  const { t } = useTranslation();

  const [connection, setConnection] = useState(null); // null = loading
  const [ratioKey, setRatioKey] = useState(SHAPES[0].key);
  const [asset, setAsset] = useState(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetFailed, setAssetFailed] = useState(false);
  const [caption, setCaption] = useState("");
  const [platforms, setPlatforms] = useState({ facebook: false, instagram: false });
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // { facebook?: {...}, instagram?: {...} }
  const [submitError, setSubmitError] = useState("");
  // Off by default — publishing now is the common case, and the picker only
  // adds a control for the contractor to see when they actually want it.
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleValue, setScheduleValue] = useState(""); // datetime-local string, local time
  // Demo-only — see this file's mock badge below. "none" is the default and
  // the only value a real connection's request ever effectively carries,
  // since the API refuses this field outright unless connection.mock.
  const [mockFailure, setMockFailure] = useState("none");

  // The AI caption generator's own, separate busy/error/result state — kept
  // apart from submitting/submitError above because generating a caption and
  // publishing the post are two independent actions a person can retry
  // independently; conflating them would grey out the wrong control while
  // the other one runs.
  const [copyGenerating, setCopyGenerating] = useState(false);
  const [copyError, setCopyError] = useState("");
  const [copyMeta, setCopyMeta] = useState(null); // last generateMarketingCopy() result

  // Reset per-open, not per-unmount — the modal is kept mounted (isOpen
  // just returns null) so CampaignEditor doesn't remount PublishModal, and
  // therefore doesn't lose editorInstance wiring, every time it's toggled.
  useEffect(() => {
    if (!isOpen) return;
    setCopyError("");
    setCopyMeta(null);
    setResults(null);
    setSubmitError("");
    setConnection(null);
    setScheduleOn(false);
    setScheduleValue("");
    setMockFailure("none");
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/marketing/designer/designs/${design.id}/publish`);
      if (cancelled) return;
      if (!res.ok) {
        await reportResponseError(res);
        setConnection({ connected: false });
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setConnection(data);
      setPlatforms({
        facebook: Boolean(data.connected),
        instagram: Boolean(data.connected && data.instagramUsername),
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, design?.id]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setAsset(null);
    setAssetFailed(false);
    setAssetLoading(true);
    (async () => {
      try {
        const generated = await preparePublishAsset(ratioKey);
        if (cancelled) return;
        if (!generated) {
          setAssetFailed(true);
        } else {
          setAsset(generated);
        }
      } catch {
        if (!cancelled) setAssetFailed(true);
      } finally {
        if (!cancelled) setAssetLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, ratioKey, preparePublishAsset]);

  const captionCheck = useMemo(() => validateCaption(caption), [caption]);
  const imageCheck = useMemo(
    () => (asset ? validateImageForInstagram({ width: asset.width, height: asset.height }) : null),
    [asset],
  );

  const wantsInstagram = platforms.instagram;
  const anyPlatform = platforms.facebook || platforms.instagram;
  // Instagram's caption limit is the tighter of the two — enforced whenever
  // Instagram is a target, same rule the API route re-checks server-side.
  // A Facebook-only post only needs a non-empty caption.
  const captionOk = wantsInstagram ? captionCheck.ok : caption.trim().length > 0;
  const imageOk = !wantsInstagram || Boolean(imageCheck?.ok);

  const scheduledForDate = scheduleOn && scheduleValue ? new Date(scheduleValue) : null;
  // Client-side guardrail only — a UX nicety, not the real gate. The API
  // re-checks the exact same windows itself (isValidFacebookScheduleTime,
  // isValidScheduleTime) before ever touching Meta, per platform, because a
  // browser's clock and validation are never trusted for anything that
  // costs money or posts publicly (AGENTS.md non-negotiable #5's discipline
  // applied here to "is this a legal time" instead of "is this a legal
  // price"). Facebook and Instagram get their OWN real windows checked
  // rather than the picker's intersected one, so a request that happens to
  // squeak past the tighter UI guardrail because only Instagram is checked
  // still gets Instagram's real (wider) window applied server-side.
  const scheduleOk =
    !scheduleOn ||
    (Boolean(scheduledForDate) &&
      !Number.isNaN(scheduledForDate?.getTime()) &&
      (!platforms.facebook || isValidFacebookScheduleTime(scheduledForDate)) &&
      (!platforms.instagram || isValidScheduleTime(scheduledForDate)));

  const canSubmit =
    connection?.connected &&
    anyPlatform &&
    captionOk &&
    imageOk &&
    scheduleOk &&
    Boolean(asset) &&
    !submitting;

  // ── "Generate with AI" — the AI context bridge, reached from the one ────
  //     place a caption actually gets typed
  //
  // Deliberately reads the canvas at the MOMENT this is pressed (a function
  // call, not a prop kept in sync) — see CampaignEditor.js's
  // getCanvasPhotoUrls() header. Grounded via POST /api/designer/copy →
  // lib/ai/marketingCopy.js, which is the only thing between "generate a
  // caption" and a caption claiming work that was never done — see that
  // file's own header for the argument. This button does not know or care
  // whether the result is grounded; it shows whatever the server reports
  // (`copyMeta.grounded`) so the person composing the post can see for
  // themselves whether it was written from real scope-of-work data or is
  // generic copy because none was found.
  async function handleGenerateCopy() {
    const photoUrls = getCanvasPhotoUrls?.() || [];
    if (!photoUrls.length) {
      setCopyError(t("app.marketingDesigner.publishModal.copyNoPhotos"));
      return;
    }
    setCopyGenerating(true);
    setCopyError("");
    try {
      const res = await fetch("/api/designer/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setCopyError(data?.error || t("app.marketingDesigner.publishModal.copyError"));
        return;
      }
      if (!data.photosUsed) {
        // Every photo on the canvas was excluded (issue-tagged, or the
        // request carried nothing usable at all) — a real, distinct answer
        // from "the vendor failed", so it gets its own sentence rather than
        // the generic error above.
        setCopyError(t("app.marketingDesigner.publishModal.copyNoUsablePhotos"));
        return;
      }
      const hashtagLine = data.hashtags?.length ? `\n\n${data.hashtags.join(" ")}` : "";
      setCaption(`${data.caption}${hashtagLine}`.trim());
      setCopyMeta(data);
    } finally {
      setCopyGenerating(false);
    }
  }

  async function handlePublish() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/marketing/designer/designs/${design.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratioKey,
          platforms: Object.entries(platforms)
            .filter(([, on]) => on)
            .map(([key]) => key),
          caption,
          imageBase64: asset.dataUrl,
          scheduledFor: scheduledForDate ? scheduledForDate.toISOString() : undefined,
          // Only ever acted on server-side when connection.mock is true —
          // sending it for a real connection is simply ignored there.
          simulateFailure:
            connection?.mock && mockFailure !== "none" ? mockFailure : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body?.message || t("app.marketingDesigner.publishModal.genericError"));
        await reportResponseError(res);
        return;
      }
      const data = await res.json();
      setResults(data.results || {});
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const done = Boolean(results);
  const loadingConnection = connection === null;
  const notConnected = !loadingConnection && !connection.connected;

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={submitting ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {t("app.marketingDesigner.publishModal.title")}
          </h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {/* Required whenever connection.mock is true, per
            docs/SOCIAL-SCHEDULING.md: convincing in shape, but never allowed
            to look identical to the real thing — this is FieldQuo's own
            back office, so naming FieldQuo here is the honest choice rather
            than a vague "demo mode." Nothing downstream (the caption, the
            image, the schedule picker) looks any different — only this
            badge and the failure-simulation control below it exist because
            of `mock`. */}
        {connection?.mock && !done && (
          <div className="flex items-center gap-1.5 bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold px-2.5 py-1 rounded-full w-fit mb-3">
            <FlaskConical size={12} />
            {t("app.marketingDesigner.publishModal.mockBadge", "FieldQuo demo mock — no real post is made")}
          </div>
        )}

        {loadingConnection && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 size={16} className="animate-spin" />
            {t("app.marketingDesigner.publishModal.checkingConnection")}
          </div>
        )}

        {notConnected && (
          <div className="bg-muted rounded-lg p-4 text-center">
            <p className="text-sm font-semibold text-foreground mb-1">
              {t("app.marketingDesigner.publishModal.notConnectedTitle")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("app.marketingDesigner.publishModal.notConnectedBody")}
            </p>
          </div>
        )}

        {connection?.connected && !done && (
          <div className="space-y-4">
            {/* Platform choice */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {t("app.marketingDesigner.publishModal.platformsLabel")}
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={platforms.facebook}
                    onChange={(e) => setPlatforms((p) => ({ ...p, facebook: e.target.checked }))}
                  />
                  {t("app.marketingDesigner.publishModal.facebook")}
                  {connection.pageName ? ` — ${connection.pageName}` : ""}
                </label>
                <label
                  className={`flex items-center gap-2 text-sm ${
                    connection.instagramUsername ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={platforms.instagram}
                    disabled={!connection.instagramUsername}
                    onChange={(e) => setPlatforms((p) => ({ ...p, instagram: e.target.checked }))}
                  />
                  {t("app.marketingDesigner.publishModal.instagram")}
                  {connection.instagramUsername ? ` — @${connection.instagramUsername}` : ""}
                </label>
                {!connection.instagramUsername && (
                  <p className="text-xs text-muted-foreground pl-6">
                    {t("app.marketingDesigner.publishModal.instagramUnavailable")}
                  </p>
                )}
              </div>
            </div>

            {/* Shape */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                {t("app.marketingDesigner.publishModal.shapeLabel")}
              </p>
              <div className="flex gap-2">
                {SHAPES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setRatioKey(s.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                      ratioKey === s.key
                        ? "bg-inverted text-inverted-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {t(s.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            {/* Preview — the actual pixels that will be sent, not a placeholder */}
            <div className="rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center min-h-[160px]">
              {assetLoading && <Loader2 size={20} className="animate-spin text-muted-foreground" />}
              {!assetLoading && assetFailed && (
                <p className="text-xs text-muted-foreground p-4 text-center">
                  {t("app.marketingDesigner.publishModal.previewError")}
                </p>
              )}
              {!assetLoading && asset && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={asset.dataUrl}
                  alt={t("app.marketingDesigner.publishModal.previewAlt")}
                  className="max-h-64 w-auto object-contain"
                />
              )}
            </div>
            {wantsInstagram && imageCheck && !imageCheck.ok && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <TriangleAlert size={12} />
                {t("app.marketingDesigner.publishModal.imageNotCompliant")}
              </p>
            )}

            {/* Caption */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("app.marketingDesigner.publishModal.captionLabel")}
                </label>
                <span
                  className={`text-xs ${
                    captionCheck.counts.length > INSTAGRAM_CAPTION_SPEC.maxLength
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {t("app.marketingDesigner.publishModal.captionCount", {
                    length: captionCheck.counts.length,
                  })}
                </span>
              </div>

              {/* Only rendered when the caller actually wired the canvas
                  reader — see this component's own prop doc. Not gated on
                  anything else: unlike Publish, generating a caption doesn't
                  need Meta connected at all. */}
              {getCanvasPhotoUrls && (
                <button
                  type="button"
                  onClick={handleGenerateCopy}
                  disabled={copyGenerating}
                  className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-foreground disabled:opacity-60"
                >
                  {copyGenerating ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  {copyGenerating
                    ? t("app.marketingDesigner.publishModal.copyGenerating")
                    : t("app.marketingDesigner.publishModal.copyGenerate")}
                </button>
              )}

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t("app.marketingDesigner.publishModal.captionPlaceholder")}
                rows={4}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-sm resize-none"
              />
              {wantsInstagram && !captionCheck.ok && caption.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {captionCheck.errors
                    .filter((e) => e !== "empty")
                    .map((e) => (
                      <li key={e} className="text-xs text-amber-600 dark:text-amber-400">
                        {t(CAPTION_ERROR_KEYS[e] || e)}
                      </li>
                    ))}
                </ul>
              )}
              {copyError && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <TriangleAlert size={12} className="shrink-0" />
                  {copyError}
                </p>
              )}
              {/* Honesty about what the caption is actually grounded in —
                  the same instinct as showing a price/balance on a refusal
                  rather than "something went wrong": the person composing a
                  post under their own brand can see whether this came from
                  real scope-of-work data or is generic copy, before they
                  post it. */}
              {copyMeta && !copyError && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {copyMeta.grounded
                    ? t("app.marketingDesigner.publishModal.copyGrounded")
                    : t("app.marketingDesigner.publishModal.copyGeneric")}
                  {copyMeta.photosExcludedIssue > 0 &&
                    " " +
                      t("app.marketingDesigner.publishModal.copyExcludedIssue", {
                        count: copyMeta.photosExcludedIssue,
                      })}
                </p>
              )}
            </div>

            {/* Scheduling — see docs/SOCIAL-SCHEDULING.md. Facebook holds a
                scheduled post itself (Meta's own native scheduler);
                Instagram never touches Meta until the moment this fires —
                FieldQuo's own queue and cron do the holding. Neither
                distinction is worth surfacing here: the contractor picked a
                date and time, and what happens behind it is this feature's
                job to get right, not theirs to reason about. */}
            <div className="border-t border-border pt-3">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={scheduleOn}
                  onChange={(e) => {
                    setScheduleOn(e.target.checked);
                    if (e.target.checked && !scheduleValue) {
                      // A sane default one hour out, so the picker never
                      // opens on a value that's already invalid (the
                      // "now" it would otherwise default to fails every
                      // window's minimum).
                      setScheduleValue(toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000)));
                    }
                  }}
                />
                <Clock size={13} />
                {t("app.marketingDesigner.publishModal.scheduleToggle", "Schedule for later")}
              </label>
              {scheduleOn && (
                <div className="mt-2">
                  <input
                    type="datetime-local"
                    value={scheduleValue}
                    min={toLocalInputValue(scheduleBounds(new Date()).min)}
                    max={toLocalInputValue(scheduleBounds(new Date()).max)}
                    onChange={(e) => setScheduleValue(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(
                      "app.marketingDesigner.publishModal.scheduleHint",
                      "Facebook: 10 minutes to 75 days out. Instagram: at least 5 minutes out — FieldQuo holds it and posts it for you at the right moment.",
                    )}
                  </p>
                  {!scheduleOk && scheduleValue && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                      <TriangleAlert size={12} />
                      {t("app.marketingDesigner.publishModal.scheduleInvalid", "Choose a time inside the windows above.")}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Demo-only — see the mock badge above. Lets an operator show
                the two failure states a real account can hit without
                waiting for either to happen naturally. */}
            {connection?.mock && (
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t("app.marketingDesigner.publishModal.simulateFailureLabel", "Simulate a failure (demo)")}
                </label>
                <select
                  value={mockFailure}
                  onChange={(e) => setMockFailure(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                >
                  <option value="none">
                    {t("app.marketingDesigner.publishModal.simulateFailureNone", "None — succeed normally")}
                  </option>
                  <option value="rate_limited">
                    {t("app.marketingDesigner.publishModal.simulateFailureRateLimited", "Meta's posting limit reached")}
                  </option>
                  <option value="container_error">
                    {t("app.marketingDesigner.publishModal.simulateFailureContainerError", "Meta rejects the image")}
                  </option>
                </select>
              </div>
            )}

            {submitError && (
              <p className="text-xs text-red-600 dark:text-red-400">{submitError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="flex-1 border border-border rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {t("app.marketingDesigner.publishModal.cancel")}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={!canSubmit}
                className="flex-1 bg-inverted text-inverted-foreground rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {submitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {submitting
                  ? t("app.marketingDesigner.publishModal.publishing")
                  : scheduleOn
                    ? t("app.marketingDesigner.publishModal.confirmSchedule", "Schedule")
                    : t("app.marketingDesigner.publishModal.confirm")}
              </button>
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-3">
            {Object.entries(results).map(([platform, r]) => (
              <ResultRow key={platform} platform={platform} result={r} t={t} />
            ))}
            <button
              type="button"
              onClick={onClose}
              className="w-full border border-border rounded-full px-4 py-2.5 text-sm font-semibold mt-2"
            >
              {t("app.marketingDesigner.publishModal.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ platform, result, t }) {
  const platformLabel = platform === "instagram" ? "Instagram" : "Facebook";

  if (result.status === "published") {
    return (
      <div className="flex items-start gap-2 bg-muted rounded-lg p-3 text-sm text-foreground">
        <Check size={16} className="mt-0.5 shrink-0" />
        <span>{t("app.marketingDesigner.publishModal.resultPublished", { platform: platformLabel })}</span>
      </div>
    );
  }

  if (result.status === "scheduled") {
    const when = result.scheduledFor ? new Date(result.scheduledFor) : null;
    return (
      <div className="flex items-start gap-2 bg-muted rounded-lg p-3 text-sm text-foreground">
        <Clock size={16} className="mt-0.5 shrink-0" />
        <span>
          {when && !Number.isNaN(when.getTime())
            ? t("app.marketingDesigner.publishModal.resultScheduled", {
                platform: platformLabel,
                when: when.toLocaleString(),
              })
            : t("app.marketingDesigner.publishModal.resultScheduledNoTime", { platform: platformLabel })}
        </span>
      </div>
    );
  }

  if (result.status === "rate_limited") {
    return (
      <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <span>{t("app.marketingDesigner.publishModal.resultRateLimited", { platform: platformLabel })}</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/40 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      <span>
        {t("app.marketingDesigner.publishModal.resultFailed", {
          platform: platformLabel,
          message: result.message || "",
        })}
      </span>
    </div>
  );
}
