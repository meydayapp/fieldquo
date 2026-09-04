"use client";

// app/components/designer/ApprovalModal.js
//
// Review the asset, fix the words, approve it. The one screen between "the
// designer made a post" and anything leaving the building.
//
// ══ Why this is a separate dialog from PublishModal ═══════════════════════
//
// Because it is reachable when publishing is not. Instagram and Facebook
// publishing is hidden entirely for a real company until Meta's App Review
// clears `pages_manage_posts` / `instagram_content_publish`
// (lib/social/metaSpecs.js's isSocialPublishingVisible, and
// CampaignEditor.js's own comment on why the button is absent rather than
// disabled). If approval lived inside the publish dialog, the approval step
// would be invisible to every real company on the platform — a gate nobody
// can reach is not a gate.
//
// It is also where the WORDS are edited, and that is the load-bearing half.
// The caption used to be typed into the publish dialog and never stored,
// which is exactly what made an approval impossible: there was nothing
// persistent to approve. It is saved on the design now
// (app/api/marketing/designer/designs/[id] PATCH), and saving it withdraws
// any standing approval, because a sign-off on words that later changed is a
// signature on something nobody read.
//
// ══ What this screen will not pretend ═════════════════════════════════════
//
// Approving does not post anything. It marks the asset ready and unlocks the
// schedule/post path — which, for a real company today, ends in a queue and
// says so in plain words rather than in a button that fails at Meta. See the
// "what happens next" block at the bottom: every destination is either live
// (download, copy) or named as blocked, with what it is blocked on.
import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
  Download,
  Loader2,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { INSTAGRAM_CAPTION_SPEC, validateCaption } from "@/lib/social/metaSpecs";

/**
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {{id: string, name: string}} props.design
 * @param {(ratioKey: string) => Promise<{dataUrl: string, width: number, height: number}|null>} props.preparePublishAsset
 * @param {() => string[]} [props.getCanvasPhotoUrls]  every photo URL on the
 *   live canvas — backs "Write it for me". Optional: without it the button
 *   isn't rendered, rather than rendered and broken.
 * @param {() => void} [props.onDownloadAll]  hands the contractor the files
 *   for the ad platform they are actually able to upload to. See the ads note
 *   in the "next" block below for why this is a download and not an upload.
 * @param {boolean} [props.socialVisible]  whether Instagram/Facebook
 *   posting exists at all for this company.
 * @param {() => void} [props.onOpenPublish]
 * @param {(state: string) => void} [props.onStateChange]  so the toolbar badge
 *   follows an approval made in here without a page reload.
 */
export default function ApprovalModal({
  isOpen,
  onClose,
  design,
  preparePublishAsset,
  getCanvasPhotoUrls,
  onDownloadAll,
  socialVisible = false,
  onOpenPublish,
  onStateChange,
}) {
  const { t } = useTranslation();

  const [approval, setApproval] = useState(null); // null = loading
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState([]);
  // What the server last confirmed. Compared against `caption` so the screen
  // can tell "you have unsaved words" from "these words are approved" — two
  // states that look identical if you only track one string.
  const [savedCaption, setSavedCaption] = useState("");
  const [asset, setAsset] = useState(null);
  const [assetLoading, setAssetLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyGenerating, setCopyGenerating] = useState(false);
  const [copyMeta, setCopyMeta] = useState(null);
  const [copied, setCopied] = useState(false);

  const apply = useCallback(
    (data) => {
      setApproval(data);
      setCaption(data.caption || "");
      setSavedCaption(data.caption || "");
      setHashtags(data.hashtags || []);
      onStateChange?.(data.state);
    },
    [onStateChange],
  );

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setError("");
    setCopyMeta(null);
    setCopied(false);
    setApproval(null);
    (async () => {
      const res = await fetch(`/api/marketing/designer/designs/${design.id}/approval`);
      if (cancelled) return;
      if (!res.ok) {
        await reportResponseError(res);
        // A load failure is NOT "not approved" — saying so would invite
        // somebody to re-approve something they already approved, which is
        // how a gate becomes a reflex. lib/loadState.js's own convention:
        // null means "not known", and the screen says that instead.
        setError(t("app.marketingDesigner.approval.loadError", "Couldn't load the approval state."));
        return;
      }
      const data = await res.json();
      if (!cancelled) apply(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, design.id, apply, t]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setAsset(null);
    setAssetLoading(true);
    (async () => {
      try {
        const generated = await preparePublishAsset("instagram_post");
        if (!cancelled) setAsset(generated);
      } catch {
        if (!cancelled) setAsset(null);
      } finally {
        if (!cancelled) setAssetLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, preparePublishAsset]);

  const captionCheck = validateCaption(caption);
  const dirty = caption !== savedCaption;

  async function saveWords() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/marketing/designer/designs/${design.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, hashtags }),
      });
      if (!res.ok) {
        await reportResponseError(res);
        setError(t("app.marketingDesigner.approval.saveError", "Couldn't save these words."));
        return false;
      }
      setSavedCaption(caption);
      // Saving the words withdraws any approval server-side; reflect that
      // here rather than leaving a stale "Approved" badge on screen.
      setApproval((prev) => (prev ? { ...prev, state: "not_approved", approvedAt: null } : prev));
      onStateChange?.("not_approved");
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    setBusy(true);
    setError("");
    try {
      // Words first, so the fingerprint the server takes covers what is on
      // screen. Approving without this would sign off on the previously
      // saved caption while the person is looking at an edited one.
      if (dirty) {
        const saved = await saveWords();
        if (!saved) return;
      }
      const res = await fetch(`/api/marketing/designer/designs/${design.id}/approval`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          data?.message ||
            t("app.marketingDesigner.approval.approveError", "Couldn't approve this design."),
        );
        return;
      }
      apply(data);
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/marketing/designer/designs/${design.id}/approval`, {
        method: "DELETE",
      });
      if (!res.ok) {
        await reportResponseError(res);
        setError(t("app.marketingDesigner.approval.withdrawError", "Couldn't withdraw the approval."));
        return;
      }
      apply(await res.json());
    } finally {
      setBusy(false);
    }
  }

  async function handleGenerateCopy() {
    const photoUrls = getCanvasPhotoUrls?.() || [];
    if (!photoUrls.length) {
      setError(t("app.marketingDesigner.publishModal.copyNoPhotos"));
      return;
    }
    setCopyGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/designer/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrls }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || t("app.marketingDesigner.publishModal.copyError"));
        return;
      }
      if (!data.photosUsed) {
        setError(t("app.marketingDesigner.publishModal.copyNoUsablePhotos"));
        return;
      }
      setCaption(data.caption || "");
      setHashtags(data.hashtags || []);
      setCopyMeta(data);
    } finally {
      setCopyGenerating(false);
    }
  }

  function addHashtagsToCaption() {
    if (!hashtags.length) return;
    const missing = hashtags.filter((h) => !caption.toLowerCase().includes(h.toLowerCase()));
    if (!missing.length) return;
    setCaption(`${caption.trim()}\n\n${missing.join(" ")}`.trim());
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(
        hashtags.length && !caption.includes(hashtags[0])
          ? `${caption}\n\n${hashtags.join(" ")}`.trim()
          : caption,
      );
      setCopied(true);
    } catch {
      // Clipboard access can be refused outright (an insecure origin, a
      // permissions policy). Saying nothing would look like it worked.
      setError(t("app.marketingDesigner.approval.copyFailed", "Your browser wouldn't let us copy that."));
    }
  }

  if (!isOpen) return null;

  const state = approval?.state;
  const approved = state === "approved";

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={busy ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            {t("app.marketingDesigner.approval.title", "Review & approve")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("app.action.close", "Close")}
            className="text-muted-foreground hover:text-foreground min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {approval === null && !error && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            {t("app.marketingDesigner.approval.loading", "Checking this design…")}
          </div>
        )}

        {approval && (
          <div className="space-y-4">
            {/* The state, named — including the third one. "Changed since it
                was approved" is not the same as "never approved", and telling
                somebody the second when the first is true sends them looking
                for a button they already pressed. */}
            <StateBanner state={state} approvedByName={approval.approvedByName} t={t} />

            {/* The rendered asset. The square crop, because it is the one
                every destination here accepts. */}
            <div className="rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center min-h-[160px]">
              {assetLoading && <Loader2 size={20} className="animate-spin text-muted-foreground" />}
              {!assetLoading && !asset && (
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

            {/* The words */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <label
                  htmlFor="approval-caption"
                  className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
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

              {getCanvasPhotoUrls && (
                <button
                  type="button"
                  onClick={handleGenerateCopy}
                  disabled={copyGenerating || busy}
                  className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-foreground disabled:opacity-60 min-h-[44px]"
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
                id="approval-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder={t("app.marketingDesigner.publishModal.captionPlaceholder")}
                rows={5}
                className="w-full rounded-lg border border-border bg-background p-2.5 text-base sm:text-sm resize-none"
              />

              {copyMeta && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {copyMeta.grounded
                    ? t("app.marketingDesigner.publishModal.copyGrounded")
                    : t("app.marketingDesigner.publishModal.copyGeneric")}
                </p>
              )}

              {hashtags.length > 0 && (
                <div className="mt-2">
                  <div className="flex flex-wrap gap-1">
                    {hashtags.map((h) => (
                      <span
                        key={h}
                        className="text-[11px] leading-none px-2 py-1.5 rounded-full bg-muted text-foreground"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addHashtagsToCaption}
                    className="mt-1.5 text-xs font-medium text-foreground underline min-h-[44px]"
                  >
                    {t("app.marketingDesigner.approval.addHashtags", "Add these to the caption")}
                  </button>
                </div>
              )}

              {dirty && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-400 flex items-start gap-1">
                  <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                  {t(
                    "app.marketingDesigner.approval.unsavedWords",
                    "These words aren't saved yet. Approving saves them first.",
                  )}
                </p>
              )}
            </div>

            {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-2">
              {approved ? (
                <button
                  type="button"
                  onClick={handleWithdraw}
                  disabled={busy}
                  className="flex-1 border border-border rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60 min-h-[44px]"
                >
                  {t("app.marketingDesigner.approval.withdraw", "Withdraw approval")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={busy || !approval.layoutCount}
                  className="flex-1 bg-inverted text-inverted-foreground rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-1.5 min-h-[44px]"
                >
                  {busy ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                  {t("app.marketingDesigner.approval.approve", "Approve this post")}
                </button>
              )}
            </div>

            {!approval.layoutCount && (
              <p className="text-xs text-muted-foreground">
                {t(
                  "app.marketingDesigner.approval.nothingToApprove",
                  "There's no saved artwork on this design yet. Edit it and it saves as you go.",
                )}
              </p>
            )}

            {/* ── What can actually happen next ────────────────────────────
                Only rendered once approved, because before that none of it
                is available — and every row below is either a control that
                really works or a sentence saying what it is waiting on.
                Nothing here is a button that fails at the carrier. */}
            {approved && <NextSteps
              t={t}
              socialVisible={socialVisible}
              onOpenPublish={onOpenPublish}
              onDownloadAll={onDownloadAll}
              onCopyCaption={copyCaption}
              copied={copied}
            />}
          </div>
        )}

        {error && !approval && (
          <p className="text-sm text-red-600 dark:text-red-400 py-4">{error}</p>
        )}
      </div>
    </div>
  );
}

function StateBanner({ state, approvedByName, t }) {
  if (state === "approved") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-foreground">
        <Check size={16} className="mt-0.5 shrink-0" />
        <span>
          {approvedByName
            ? t("app.marketingDesigner.approval.approvedBy", "Approved by {name}.", {
                name: approvedByName,
              })
            : t("app.marketingDesigner.approval.approvedState", "Approved and ready to go out.")}
        </span>
      </div>
    );
  }
  if (state === "stale") {
    return (
      <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
        <TriangleAlert size={16} className="mt-0.5 shrink-0" />
        <span>
          {t(
            "app.marketingDesigner.approval.staleState",
            "This changed after it was approved. Have another look, then approve it again.",
          )}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
      <TriangleAlert size={16} className="mt-0.5 shrink-0" />
      <span>
        {t(
          "app.marketingDesigner.approval.notApprovedState",
          "Not approved yet. Nothing can be scheduled or posted until it is.",
        )}
      </span>
    </div>
  );
}

/**
 * The destinations, each one honest about itself.
 *
 * Three of them, and only two are controls:
 *
 *   • Schedule or post — a real button, and only when this company can reach
 *     Instagram/Facebook at all. For a real company that means
 *     META_APP_ID/META_APP_SECRET configured AND Meta's App Review cleared for
 *     `pages_manage_posts` / `instagram_content_publish`; until then the
 *     button is ABSENT and the sentence below says what it is waiting on. A
 *     disabled button with a tooltip would be the dead control AGENTS.md opens
 *     with, and so would a live one that fails at Meta.
 *   • Download for ads — a real download, right now. FieldQuo cannot create
 *     the ad for them: `ads_management` is behind the same App Review as the
 *     posting scopes, and the Meta integration in this build reads insights
 *     only (docs/META-ADS-INTEGRATION.md). So the honest hand-off is the files
 *     and the words, which is what a person uploads into Ads Manager in about
 *     a minute. Building an "Send to ads" button that queued something
 *     nowhere would be worse than saying this.
 *   • Copy the caption — a real clipboard write, paired with the download.
 */
function NextSteps({ t, socialVisible, onOpenPublish, onDownloadAll, onCopyCaption, copied }) {
  return (
    <div className="border-t border-border pt-3 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {t("app.marketingDesigner.approval.nextLabel", "What next")}
      </p>

      {socialVisible ? (
        <button
          type="button"
          onClick={onOpenPublish}
          className="w-full bg-inverted text-inverted-foreground rounded-full px-4 py-2.5 text-sm font-semibold min-h-[44px]"
        >
          {t("app.marketingDesigner.approval.openPublish", "Schedule or post it")}
        </button>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t(
            "app.marketingDesigner.approval.metaPending",
            "Posting straight to Instagram and Facebook is waiting on Meta's app review. Until that clears, download the post and put it up from your own account — it takes a minute and nothing is lost.",
          )}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        {onDownloadAll && (
          <button
            type="button"
            onClick={onDownloadAll}
            className="flex-1 border border-border rounded-full px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <Download size={14} />
            {t("app.marketingDesigner.approval.downloadForAds", "Download every size")}
          </button>
        )}
        <button
          type="button"
          onClick={onCopyCaption}
          className="flex-1 border border-border rounded-full px-4 py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5 min-h-[44px]"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied
            ? t("app.marketingDesigner.approval.captionCopied", "Caption copied")
            : t("app.marketingDesigner.approval.copyCaption", "Copy the caption")}
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        {t(
          "app.marketingDesigner.approval.adsNote",
          "For a paid ad, upload the downloaded file in Meta Ads Manager. FieldQuo can't create the ad for you — that needs a Meta permission we haven't been granted yet.",
        )}
      </p>
    </div>
  );
}
