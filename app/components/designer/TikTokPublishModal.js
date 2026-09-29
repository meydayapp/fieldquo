"use client";

// app/components/designer/TikTokPublishModal.js
//
// "Post to TikTok" — the composer TikTok's Content Sharing Guidelines mandate
// (developers.tiktok.com/doc/content-sharing-guidelines, read 2026-09-29),
// opened from the Publish dialog's TikTok destination (PublishModal.js), or
// straight from the designer's Publish button when TikTok is the only
// destination this company has. Either way only when a TikTok account is
// connected (CampaignEditor.js tiktokReady). Two explicit actions: "Post to
// TikTok" (Direct Post, scope video.publish) and "Send to TikTok as a draft"
// (MEDIA_UPLOAD into the creator's TikTok inbox, scope video.upload).
//
// ── Its own dialog, not a fourth checkbox in PublishModal ─────────────────
//
// PublishModal is built around one image and one caption going to Facebook
// and Instagram together, in shapes Instagram accepts. TikTok needs a
// different shape (the 9:16 layout), a different set of mandatory controls
// (privacy with no default, commercial disclosure, TikTok's consent line) and
// a different lifecycle (sent → processing → posted, minutes later). Folding
// those into the Meta dialog would make every Meta post read TikTok's rules
// and every TikTok post read Meta's. The GATES are shared instead: the same
// approval, the same read-only caption, the same "Edit the words" door.
//
// ── What TikTok requires here, and where ──────────────────────────────────
//
//   creator nickname (fresh creator_info)   → "Posting to …", fetched on open
//   privacy dropdown, NO default            → COMPOSER_DEFAULTS.privacyLevel
//   interaction toggles off / greyed        → "Allow comments" (photo posts
//                                             have no Duet/Stitch)
//   commercial disclosure + labels          → the disclosure block
//   consent line (+ Branded Content Policy) → consentLine()
//   preview, no watermark                   → the actual rendered JPEG
//   "may take a few minutes"                → the processing note + the poll
//   unaudited: private only                 → the notice at the top
//
// ── Video posts use this same composer ────────────────────────────────────
//
// Given `video` (a shaped VideoPost — app/app/marketing/designer/video/[id])
// instead of `design`, the composer posts that clip: the preview is the
// video itself, "Duet" and "Stitch" appear beside "Allow comments" (the
// guidelines' three interactions for a video, each greyed out when
// creator_info says the creator has it off), the clip's length is checked
// against creator_info's max_video_post_duration_sec before Post is enabled,
// and the request goes to /api/marketing/video-posts/[id]/tiktok. Everything
// TikTok mandates is the same code path for both — one composer, not two
// copies that drift.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Clock, Inbox, Loader2, Lock, PencilLine, RotateCcw, Send, TriangleAlert, X } from "lucide-react";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { TIKTOK_SETTINGS_PATH } from "@/lib/tiktok/settingsPath";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson } from "@/lib/fetchJson";
import {
  COMPOSER_DEFAULTS,
  PRIVATE_LEVEL,
  TIKTOK_BRANDED_CONTENT_URL,
  TIKTOK_ERRORS,
  TIKTOK_MUSIC_USAGE_URL,
  TIKTOK_RATIO_KEY,
  brandedContentBlockedBy,
  commercialLabel,
  consentLine,
  privacyOptionBlockedBy,
  validateTikTokPhoto,
  validateTikTokDraft,
  validateTikTokPost,
} from "@/lib/tiktok/specs";
import { checkForPlatform } from "@/lib/marketing/videoPost";

const POLL_INTERVAL_MS = 5000;
// ~3 minutes. TikTok says a post "may take a few minutes"; past this the
// dialog says it is still processing and that closing is fine — the webhook
// and the next status read will still record the outcome.
const POLL_MAX_ATTEMPTS = 36;

// Our own refusal codes (lib/tiktok/specs.js validateTikTokPost and the route)
// that have a sentence under app.tiktok.error.*, beside TikTok's own.
const LOCAL_CODES = [
  "privacy_required",
  "no_privacy_option",
  "comment_disabled_by_creator",
  "commercial_choice_required",
  "branded_content_private",
  "description_too_long",
  "creator_info_missing",
  "upload_failed",
  "status_unavailable",
  "not_available",
  "forbidden",
  "file_too_large",
  "duet_disabled_by_creator",
  "stitch_disabled_by_creator",
  "not_vertical",
  "rendition_not_ready",
  "too_long",
  "too_long_for_creator",
  "caption_changed",
  "cover_offset_out_of_range",
  "video_size_check_failed",
  "caption_too_long",
];
const KNOWN_CODES = new Set([...Object.keys(TIKTOK_ERRORS), ...LOCAL_CODES]);

/** A code → the sentence. An unknown code is quoted, never hidden. */
function errorText(t, code, vars) {
  if (code === "not_approved") return t("app.marketingDesigner.publishModal.approvalNeeded");
  if (code === "approval_stale") return t("app.marketingDesigner.publishModal.approvalStale");
  if (KNOWN_CODES.has(code)) return t(`app.tiktok.error.${code}`, vars);
  return t("app.tiktok.error.unknown", { code: code || "?" });
}

// One composer, three kinds of post: a design's single photo, a carousel
// design's photos (slideCount > 1, TikTok photo mode), and a video post
// (`video`, TikTok video Direct Post / inbox). TikTok's own UX rules are the
// same for all three, so they live once.
export default function TikTokPublishModal({ isOpen, onClose, design, preparePublishAsset, onOpenApproval, slideCount = 1, video }) {
  const { t } = useTranslation();
  const caller = usePermissions();
  const canConnect = !caller?.role || isBillingAdmin(caller.role);

  const [meta, setMeta] = useState(null); // GET /designs/[id]/tiktok
  const [creator, setCreator] = useState(null); // { creatorInfo, privacyOptions, audited } | { error }
  const [asset, setAsset] = useState(null);
  // Slides 2..n of a carousel design — one photo-mode post, every image in
  // TikTok's 9:16 (lib/marketing/destinations.js).
  const [extraAssets, setExtraAssets] = useState([]);
  const [assetState, setAssetState] = useState("idle"); // idle | loading | failed | ready
  const [choice, setChoice] = useState(COMPOSER_DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null); // { code, fix }
  const [result, setResult] = useState(null); // { id, status, failure?, stillProcessing? }
  const pollRef = useRef(null);
  const isVideo = Boolean(video);
  const endpoint = isVideo
    ? `/api/marketing/video-posts/${video.id}/tiktok`
    : `/api/marketing/designer/designs/${design?.id}/tiktok`;

  // Everything resets per open — including creator_info, which TikTok requires
  // to be the latest each time the composer is shown.
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setMeta(null);
    setCreator(null);
    setChoice(COMPOSER_DEFAULTS);
    setSubmitError(null);
    setResult(null);
    (async () => {
      try {
        const data = await fetchJson(endpoint);
        if (!cancelled) setMeta(data);
      } catch (err) {
        if (!cancelled) setMeta({ loadError: err.message });
      }
    })();
    (async () => {
      try {
        const data = await fetchJson("/api/tiktok/creator-info");
        if (!cancelled) setCreator(data);
      } catch (err) {
        if (!cancelled) setCreator({ error: { code: err.code || (err.status ? "creator_info_missing" : "network") } });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, endpoint]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    setAsset(null);
    setExtraAssets([]);
    setAssetState("loading");
    // A video post's asset is its prepared 9:16 rendition — already made by
    // Cloudinary; nothing is rendered in the browser.
    if (video) {
      if (video.rendition?.state === "ready" && video.rendition.url) {
        setAsset({ videoUrl: video.rendition.url, width: video.rendition.width, height: video.rendition.height });
        setAssetState("ready");
      } else setAssetState("failed");
      return undefined;
    }
    (async () => {
      try {
        const generated = await preparePublishAsset(TIKTOK_RATIO_KEY, 0);
        const extras = [];
        for (let i = 1; i < Math.max(1, slideCount); i++) {
          // eslint-disable-next-line no-await-in-loop
          const more = await preparePublishAsset(TIKTOK_RATIO_KEY, i);
          if (!more) throw new Error("slide render failed");
          extras.push(more);
        }
        if (cancelled) return;
        if (generated) {
          setAsset(generated);
          setExtraAssets(extras);
          setAssetState("ready");
        } else setAssetState("failed");
      } catch {
        if (!cancelled) setAssetState("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, preparePublishAsset, slideCount, video]);

  // Stop polling when the dialog closes or unmounts.
  useEffect(() => {
    if (isOpen) return undefined;
    if (pollRef.current) clearTimeout(pollRef.current);
    return undefined;
  }, [isOpen]);
  useEffect(() => () => pollRef.current && clearTimeout(pollRef.current), []);

  const creatorInfo = creator?.creatorInfo || null;
  const audited = Boolean(creator?.audited ?? meta?.audited);
  const privacyOptions = Array.isArray(creator?.privacyOptions) ? creator.privacyOptions : [];
  const caption = meta?.caption || "";
  const approved = meta?.approval?.state === "approved";

  const check = useMemo(
    () => validateTikTokPost({ ...choice, description: caption, creatorInfo, audited, mediaKind: isVideo ? "video" : "photo" }),
    [choice, caption, creatorInfo, audited, isVideo],
  );
  // The media's own check: TikTok's photo limits for every image of a design
  // (all slides of a carousel); for a video, lib/marketing/videoPost.js
  // checkForPlatform — shape, size, and the creator's own
  // max_video_post_duration_sec from creator_info.
  const photoCheck = useMemo(() => {
    if (!asset) return null;
    if (isVideo) return checkForPlatform("tiktok", { ...video, caption }, { maxVideoPostDurationSec: creatorInfo?.maxVideoPostDurationSec });
    const checks = [asset, ...extraAssets].map((a) => validateTikTokPhoto({ width: a.width, height: a.height }));
    return checks.find((c) => !c.ok) || checks[0];
  }, [asset, extraAssets, isVideo, video, caption, creatorInfo]);
  // Template placeholders still on the design (the route refuses on them). A
  // video post has none — its meta carries no `placeholders`.
  const placeholderCount = Number(meta?.placeholders?.count) || 0;
  const label = commercialLabel(choice);
  const consent = consentLine(choice);
  const brandedBlocked = brandedContentBlockedBy(choice);

  const canSubmit =
    Boolean(creatorInfo) && approved && check.ok && photoCheck?.ok && assetState === "ready" && placeholderCount === 0 && !submitting;
  // "Send to TikTok as a draft" needs no privacy level or disclosure — the
  // creator sets those in TikTok's own editor — but the same approval, the
  // same image and a caption TikTok will take.
  const draftCheck = useMemo(
    () => validateTikTokDraft({ description: caption, creatorInfo, mediaKind: isVideo ? "video" : "photo" }),
    [caption, creatorInfo, isVideo],
  );
  const canDraft =
    Boolean(creatorInfo) && approved && draftCheck.ok && photoCheck?.ok && assetState === "ready" && placeholderCount === 0 && !submitting;

  function set(patch) {
    setChoice((c) => {
      const next = { ...c, ...patch };
      // Turning the disclosure off clears both boxes, so what TikTok is sent
      // is never a box the person can no longer see.
      if (patch.commercialOn === false) {
        next.yourBrand = false;
        next.brandedContent = false;
      }
      return next;
    });
  }

  function poll(id, attempt = 0) {
    pollRef.current = setTimeout(async () => {
      try {
        const row = await fetchJson(`/api/tiktok/publish/${id}`);
        if (row.status === "published" || row.status === "failed" || row.status === "inbox_delivered") {
          setResult({ id, ...row });
          return;
        }
        if (attempt + 1 >= POLL_MAX_ATTEMPTS) {
          setResult({ id, ...row, stillProcessing: true });
          return;
        }
        setResult({ id, ...row });
        poll(id, attempt + 1);
      } catch {
        // A failed status READ is not a failed post — keep the row as it was,
        // stop, and say the status could not be checked.
        setResult((r) => ({ ...(r || { id }), stillProcessing: true, statusUnavailable: true }));
      }
    }, POLL_INTERVAL_MS);
  }

  async function handlePost(mode = "post") {
    if (mode === "draft" ? !canDraft : !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // A carousel's images go up one request each and travel as signed
      // receipts (lib/marketing/slideAssets.js); one image goes in the body,
      // as it always did. A video post's clip is already at Cloudinary, so
      // nothing but the choices travels.
      let slideTokens;
      if (!isVideo && extraAssets.length) {
        slideTokens = [];
        for (const a of [asset, ...extraAssets]) {
          // eslint-disable-next-line no-await-in-loop
          const staged = await fetchJson(`/api/marketing/designer/designs/${design.id}/assets`, {
            method: "POST",
            body: { ratioKey: TIKTOK_RATIO_KEY, imageBase64: a.dataUrl },
          });
          slideTokens.push(staged.token);
        }
      }
      const data = await fetchJson(endpoint, {
        method: "POST",
        body: {
          mode,
          ...(isVideo
            ? { allowDuet: choice.allowDuet, allowStitch: choice.allowStitch }
            : slideTokens
              ? { slideTokens }
              : { imageBase64: asset.dataUrl }),
          caption,
          privacyLevel: choice.privacyLevel,
          allowComment: choice.allowComment,
          commercialOn: choice.commercialOn,
          yourBrand: choice.yourBrand,
          brandedContent: choice.brandedContent,
          // The Post (or Send as a draft) press IS the express consent the
          // guidelines require; the server refuses a request without it.
          consent: true,
        },
      });
      const r = data?.result || {};
      if (r.status === "processing") {
        setResult({ id: r.id, status: "processing", postMode: mode === "draft" ? "MEDIA_UPLOAD" : "DIRECT_POST" });
        poll(r.id);
      } else {
        setSubmitError({ code: r.code, fix: r.fix, retryable: r.retryable });
      }
    } catch (err) {
      // A refusal from the route carries its own code; no status at all is
      // fetchJson's network failure.
      setSubmitError({ code: err.code || (err.status ? `http_${err.status}` : "network"), fix: null });
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const loading = meta === null || creator === null;
  const creatorError = creator?.error || null;
  const done = Boolean(result);

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
          <h2 className="text-lg font-semibold text-foreground">{t("app.tiktokPublish.title")}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label={t("app.marketingDesigner.publishModal.close")}>
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
            <Loader2 size={16} className="animate-spin" />
            {t("app.tiktokPublish.loading")}
          </div>
        )}

        {!loading && meta?.loadError && <p className="text-sm text-red-600 dark:text-red-400">{meta.loadError}</p>}

        {/* creator_info said no — stop here, as the guidelines require, with
            the reason and (when the fix is the connection) the way to it. */}
        {!loading && !meta?.loadError && creatorError && !done && (
          <ErrorBlock t={t} code={creatorError.code} fix={creatorError.fix} canConnect={canConnect} />
        )}

        {!loading && !meta?.loadError && creatorInfo && !done && (
          <div className="space-y-4">
            {!audited && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300" data-tiktok-unaudited>
                <Lock size={14} className="mt-0.5 shrink-0" />
                <span>{t("app.tiktokPublish.unauditedNotice")}</span>
              </p>
            )}

            {!approved && !meta?.approval?.notRequired && (
              <div className="rounded-lg border border-border bg-muted p-3 space-y-2">
                <p className="flex items-start gap-2 text-sm text-foreground">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  <span>{errorText(t, meta?.approval?.state === "stale" ? "approval_stale" : "not_approved")}</span>
                </p>
                {onOpenApproval && (
                  <button type="button" onClick={onOpenApproval} className="w-full rounded-full border border-border px-4 py-2.5 text-sm font-semibold">
                    {t("app.marketingDesigner.approval.badgeReview", "Review & approve")}
                  </button>
                )}
              </div>
            )}

            {/* Which account receives this — TikTok's first requirement. */}
            <div className="flex items-center gap-3">
              {creatorInfo.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={creatorInfo.avatarUrl} alt="" width={36} height={36} className="w-9 h-9 rounded-full object-cover bg-muted shrink-0" />
              ) : null}
              <p className="text-sm font-semibold text-foreground break-words">
                {t("app.tiktokPublish.postingAs", { name: creatorInfo.nickname || creatorInfo.username || "TikTok" })}
              </p>
            </div>
            {/* The same "already posted this?" cue the Meta dialog's history
                gives, so a second press is a decision rather than an accident. */}
            {Array.isArray(meta?.history) && meta.history[0]?.createdAt && (
              <p className="text-xs text-muted-foreground" data-tiktok-last-sent>
                {t("app.tiktokPublish.lastSent", { when: new Date(meta.history[0].createdAt).toLocaleString() })}
              </p>
            )}

            {/* Preview — the actual pixels TikTok will pull. */}
            <div className="rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center min-h-[200px]">
              {assetState === "loading" && <Loader2 size={20} className="animate-spin text-muted-foreground" />}
              {assetState === "failed" && (
                <p className="text-xs text-muted-foreground p-4 text-center">{t("app.marketingDesigner.publishModal.previewError")}</p>
              )}
              {assetState === "ready" && asset && !isVideo && !extraAssets.length && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={asset.dataUrl} alt={t("app.tiktokPublish.previewAlt")} className="max-h-72 w-auto object-contain" />
              )}
              {assetState === "ready" && asset && !isVideo && extraAssets.length > 0 && (
                <div className="flex gap-2 overflow-x-auto p-2 w-full" data-tiktok-slides>
                  {[asset, ...extraAssets].map((a, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={a.dataUrl} alt={t("app.tiktokPublish.previewAlt")} className="max-h-60 w-auto object-contain shrink-0" />
                  ))}
                </div>
              )}
              {assetState === "ready" && asset && isVideo && (
                <video
                  src={asset.videoUrl}
                  controls
                  playsInline
                  muted
                  preload="metadata"
                  aria-label={t("app.videoPost.tiktokPreviewAlt")}
                  className="max-h-72 w-auto"
                />
              )}
              {isVideo && assetState === "failed" && (
                <p className="text-xs text-muted-foreground p-4 text-center">{errorText(t, "rendition_not_ready")}</p>
              )}
            </div>
            {!isVideo && extraAssets.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("app.marketingDesigner.publishModal.slideCount", { value: extraAssets.length + 1 })}
              </p>
            )}
            {placeholderCount > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1" data-tiktok-placeholders>
                <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                {t(
                  "app.marketingDesigner.publishModal.placeholdersBlock",
                  "This design still has {count} template placeholders (a review, a number, a photo…). Replace or delete them in the editor before it can be posted.",
                  { count: placeholderCount },
                )}
              </p>
            )}
            {photoCheck && !photoCheck.ok && !isVideo && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <TriangleAlert size={12} />
                {errorText(t, "picture_size_check_failed")}
              </p>
            )}
            {photoCheck && !photoCheck.ok && isVideo && (
              <ul className="text-xs text-amber-600 dark:text-amber-400 space-y-1" data-tiktok-video-check>
                {photoCheck.errors.map((code) => (
                  <li key={code} className="flex items-center gap-1">
                    <TriangleAlert size={12} className="shrink-0" />
                    {errorText(t, code, {
                      max: String(photoCheck.limits?.maxSeconds ?? ""),
                      seconds: String(Math.round(video.durationSec)),
                    })}
                  </li>
                ))}
              </ul>
            )}

            {/* Caption — read-only, as on the Facebook/Instagram dialog. The
                words are edited where editing withdraws the approval. */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {t("app.marketingDesigner.publishModal.captionLabel")}
              </p>
              <p className="w-full rounded-lg border border-border bg-muted p-2.5 text-sm whitespace-pre-wrap break-words text-foreground">
                {caption || t("app.marketingDesigner.publishModal.captionPlaceholder")}
              </p>
              {onOpenApproval && !isVideo && (
                <button
                  type="button"
                  onClick={onOpenApproval}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  <PencilLine size={12} />
                  {t("app.marketingDesigner.publishModal.editWords", "Edit the words")}
                </button>
              )}
              {check.errors.includes("description_too_long") && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errorText(t, "description_too_long")}</p>
              )}
            </div>

            {/* Privacy — TikTok's options for THIS creator, nothing chosen. */}
            <div>
              <label htmlFor="tiktok-privacy" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("app.tiktokPublish.privacyLabel")}
              </label>
              {privacyOptions.length === 0 ? (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errorText(t, "no_privacy_option")}</p>
              ) : (
                <select
                  id="tiktok-privacy"
                  value={choice.privacyLevel || ""}
                  onChange={(e) => set({ privacyLevel: e.target.value || null })}
                  className="mt-1 w-full rounded-lg border border-border bg-background p-2.5 text-sm"
                  data-tiktok-privacy
                >
                  <option value="" disabled>
                    {t("app.tiktokPublish.privacyPlaceholder")}
                  </option>
                  {privacyOptions.map((o) => {
                    const blocked = privacyOptionBlockedBy(o, choice);
                    return (
                      <option key={o} value={o} disabled={Boolean(blocked)} title={blocked ? errorText(t, blocked) : undefined}>
                        {t(`app.tiktok.privacy.${o}`)}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>

            {/* Interaction — photo posts have "Allow comments" only. */}
            <div>
              <label className={`flex items-center gap-2 text-sm ${creatorInfo.commentDisabled ? "text-muted-foreground" : "text-foreground"}`}>
                <input
                  type="checkbox"
                  checked={choice.allowComment}
                  disabled={creatorInfo.commentDisabled}
                  onChange={(e) => set({ allowComment: e.target.checked })}
                  data-tiktok-allow-comment
                />
                {t("app.tiktokPublish.allowComment")}
              </label>
              {creatorInfo.commentDisabled && (
                <p className="text-xs text-muted-foreground pl-6">{errorText(t, "comment_disabled_by_creator")}</p>
              )}
              {/* Duet and Stitch: a video's other two interactions. Off until
                  ticked; greyed out when the creator has them off in TikTok. */}
              {isVideo && (
                <>
                  <label className={`mt-2 flex items-center gap-2 text-sm ${creatorInfo.duetDisabled ? "text-muted-foreground" : "text-foreground"}`}>
                    <input
                      type="checkbox"
                      checked={choice.allowDuet}
                      disabled={creatorInfo.duetDisabled}
                      onChange={(e) => set({ allowDuet: e.target.checked })}
                      data-tiktok-allow-duet
                    />
                    {t("app.tiktokPublish.allowDuet")}
                  </label>
                  {creatorInfo.duetDisabled && (
                    <p className="text-xs text-muted-foreground pl-6">{errorText(t, "duet_disabled_by_creator")}</p>
                  )}
                  <label className={`mt-2 flex items-center gap-2 text-sm ${creatorInfo.stitchDisabled ? "text-muted-foreground" : "text-foreground"}`}>
                    <input
                      type="checkbox"
                      checked={choice.allowStitch}
                      disabled={creatorInfo.stitchDisabled}
                      onChange={(e) => set({ allowStitch: e.target.checked })}
                      data-tiktok-allow-stitch
                    />
                    {t("app.tiktokPublish.allowStitch")}
                  </label>
                  {creatorInfo.stitchDisabled && (
                    <p className="text-xs text-muted-foreground pl-6">{errorText(t, "stitch_disabled_by_creator")}</p>
                  )}
                </>
              )}
            </div>

            {/* Commercial content disclosure. */}
            <div className="rounded-lg border border-border p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={choice.commercialOn}
                  onChange={(e) => set({ commercialOn: e.target.checked })}
                  data-tiktok-commercial
                />
                {t("app.tiktokPublish.commercialToggle")}
              </label>
              <p className="text-xs text-muted-foreground pl-6">{t("app.tiktokPublish.commercialHelp")}</p>
              {choice.commercialOn && (
                <div className="pl-6 space-y-2">
                  <label className="flex items-start gap-2 text-sm text-foreground">
                    <input type="checkbox" className="mt-1" checked={choice.yourBrand} onChange={(e) => set({ yourBrand: e.target.checked })} />
                    <span>
                      {t("app.tiktokPublish.yourBrand")}
                      <span className="block text-xs text-muted-foreground">{t("app.tiktokPublish.yourBrandHelp")}</span>
                    </span>
                  </label>
                  <label className={`flex items-start gap-2 text-sm ${brandedBlocked ? "text-muted-foreground" : "text-foreground"}`}>
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={choice.brandedContent}
                      disabled={Boolean(brandedBlocked)}
                      onChange={(e) => set({ brandedContent: e.target.checked })}
                    />
                    <span>
                      {t("app.tiktokPublish.brandedContent")}
                      <span className="block text-xs text-muted-foreground">
                        {brandedBlocked ? errorText(t, "branded_content_private") : t("app.tiktokPublish.brandedContentHelp")}
                      </span>
                    </span>
                  </label>
                  {label && (
                    <p className="text-xs text-foreground">
                      {t(label === "paid_partnership" ? "app.tiktokPublish.labelPaidPartnership" : "app.tiktokPublish.labelPromotional")}
                    </p>
                  )}
                  {check.errors.includes("commercial_choice_required") && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{errorText(t, "commercial_choice_required")}</p>
                  )}
                </div>
              )}
            </div>

            {/* TikTok's consent line, then the processing note. */}
            <div className="space-y-1">
              <p className="text-xs text-foreground" data-tiktok-consent={consent}>
                {t(consent === "branded_and_music" ? "app.tiktokPublish.consentBranded" : "app.tiktokPublish.consentMusic")}{" "}
                {consent === "branded_and_music" && (
                  <>
                    <a href={TIKTOK_BRANDED_CONTENT_URL} target="_blank" rel="noopener noreferrer" className="underline">
                      {t("app.tiktokPublish.readBranded")}
                    </a>
                    {" · "}
                  </>
                )}
                <a href={TIKTOK_MUSIC_USAGE_URL} target="_blank" rel="noopener noreferrer" className="underline">
                  {t("app.tiktokPublish.readMusic")}
                </a>
              </p>
              <p className="text-xs text-muted-foreground flex items-start gap-1">
                <Clock size={12} className="mt-0.5 shrink-0" />
                {t("app.tiktokPublish.processingNote")}
              </p>
            </div>

            {submitError && (
              <ErrorBlock t={t} code={submitError.code} fix={submitError.fix} canConnect={canConnect} />
            )}

            <div className="flex gap-3 pt-1">
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
                onClick={() => handlePost("post")}
                disabled={!canSubmit}
                title={check.errors.includes("commercial_choice_required") ? errorText(t, "commercial_choice_required") : undefined}
                className="flex-1 bg-inverted text-inverted-foreground rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
                data-tiktok-post
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? t("app.tiktokPublish.posting") : t("app.tiktokPublish.confirm")}
              </button>
            </div>
            {/* The second, explicit action: TikTok's MEDIA_UPLOAD mode (scope
                video.upload). Nothing is published — the photo lands in the
                creator's TikTok inbox and they finish it in TikTok's editor,
                where privacy and disclosure are chosen instead of here. */}
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => handlePost("draft")}
                disabled={!canDraft}
                className="w-full border border-border rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5"
                data-tiktok-draft
              >
                <Inbox size={14} />
                {t("app.tiktokPublish.sendDraft")}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                {t(isVideo ? "app.tiktokPublish.sendDraftHelpVideo" : "app.tiktokPublish.sendDraftHelp")}
              </p>
            </div>
          </div>
        )}

        {done && (
          <div className="space-y-3">
            <ResultBlock t={t} result={result} canConnect={canConnect} onRetry={() => { setResult(null); setSubmitError(null); }} />
            <button type="button" onClick={onClose} className="w-full border border-border rounded-full px-4 py-2.5 text-sm font-semibold">
              {t("app.marketingDesigner.publishModal.close")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorBlock({ t, code, fix, canConnect }) {
  return (
    <div className="bg-red-50 dark:bg-red-950/40 rounded-lg p-3 text-sm text-red-700 dark:text-red-300 space-y-2" data-tiktok-error={code}>
      <p className="flex items-start gap-2">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <span>{errorText(t, code)}</span>
      </p>
      {fix === "reconnect" && canConnect && (
        <Link href={TIKTOK_SETTINGS_PATH} className="ml-6 inline-flex items-center rounded-full border border-current px-3 py-1.5 text-xs font-semibold">
          {t("app.marketingDesigner.publishModal.openConnectionSettings", "Open connection settings")}
        </Link>
      )}
    </div>
  );
}

function ResultBlock({ t, result, canConnect, onRetry }) {
  if (result.status === "published") {
    return (
      <div className="flex items-start gap-2 bg-muted rounded-lg p-3 text-sm text-foreground" data-tiktok-result="published">
        <Check size={16} className="mt-0.5 shrink-0" />
        <span>{t(result.privacyLevel === PRIVATE_LEVEL ? "app.tiktokPublish.resultPublishedPrivate" : "app.tiktokPublish.resultPublished")}</span>
      </div>
    );
  }
  if (result.status === "inbox_delivered") {
    return (
      <div className="flex items-start gap-2 bg-muted rounded-lg p-3 text-sm text-foreground">
        <Inbox size={16} className="mt-0.5 shrink-0" />
        <span>{t("app.tiktokPublish.resultInbox")}</span>
      </div>
    );
  }
  if (result.status === "failed") {
    const failure = result.failure || {};
    return (
      <div className="space-y-2" data-tiktok-result="failed">
        <ErrorBlock t={t} code={failure.code} fix={failure.fix} canConnect={canConnect} />
        {failure.retryable && (
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-semibold">
            <RotateCcw size={12} />
            {t("app.tiktokPublish.retry")}
          </button>
        )}
      </div>
    );
  }
  // Sent, not finished.
  return (
    <div className="flex items-start gap-2 bg-muted rounded-lg p-3 text-sm text-foreground" data-tiktok-result="processing">
      {result.stillProcessing ? <Clock size={16} className="mt-0.5 shrink-0" /> : <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />}
      <span>
        {result.statusUnavailable
          ? t("app.tiktok.error.status_unavailable")
          : result.stillProcessing
            ? t("app.tiktokPublish.resultStillProcessing")
            : t("app.tiktokPublish.resultProcessing")}
      </span>
    </div>
  );
}
