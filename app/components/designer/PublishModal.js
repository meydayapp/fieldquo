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
import { Check, Loader2, Send, TriangleAlert, X } from "lucide-react";
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
} from "@/lib/social/metaSpecs";

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
 */
export default function PublishModal({ isOpen, onClose, design, preparePublishAsset }) {
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

  // Reset per-open, not per-unmount — the modal is kept mounted (isOpen
  // just returns null) so CampaignEditor doesn't remount PublishModal, and
  // therefore doesn't lose editorInstance wiring, every time it's toggled.
  useEffect(() => {
    if (!isOpen) return;
    setResults(null);
    setSubmitError("");
    setConnection(null);
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
  const canSubmit =
    connection?.connected && anyPlatform && captionOk && imageOk && Boolean(asset) && !submitting;

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
            </div>

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
