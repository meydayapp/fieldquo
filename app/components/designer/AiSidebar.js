"use client";

// app/components/designer/AiSidebar.js
//
// AI image generation — restored per the owner's 2026-08-30 correction, and
// the ONE premium piece of this port: every other editor feature is free.
// Gated on the `image_generation` spend kind + the "marketing_designer"
// feature key via lib/designer/aiImageAdapter.js (POSTed through
// app/api/designer/generate/route.js). Same TODO seam as RemoveBgSidebar —
// the vendor call itself lands in a sibling worktree's lib/ai/images.js.
//
// The source clone's ai-sidebar.tsx called useGenerateImage() + usePaywall()
// straight into a mutation with no visible price and a boolean "blocked".
// This version fetches useAiImageStatus() BEFORE rendering the button live,
// so a company that can't afford it — or whose deployment hasn't wired the
// vendor yet — sees a disabled control with the specific reason, never a
// button that looks clickable and fails after the fact.
//
// Two things the owner named directly, both fixed here:
//
//   - The placeholder was the source clone's own sample prompt verbatim —
//     "An astronaut riding a horse on mars, hd, dramatic lighting". This
//     tool's actual audience is a painter or roofer making a Facebook ad, not
//     a stock-art hobbyist; the placeholder and the `rows` count (10, taller
//     than most phone screens have room for once a keyboard is up) are both
//     rewritten for that person.
//   - "No prompt or anything of the sort" traced to the refusal state
//     rendering the reason block ABOVE a separately-disabled form — two
//     stacked, visually unrelated things, with a barely-visible greyed-out
//     textarea easy to miss under a message that reads like the whole
//     feature is gone. The textarea and button now always render; when
//     `status.allowed` is false the reason sits INSIDE the same form, right
//     above the input it's explaining, so a company that can't afford this
//     yet still sees "here's the prompt box, here's why it's off" as one
//     panel instead of an error page hiding a dead control.
//
// ── 2026-09-02: the reason was honest and still a dead end ─────────────────
//
// The owner opened this panel, was told he had no AI credit, and had nowhere
// to go: the sentence named the shortfall to the cent and the screen offered
// no way to pay it. That is the same failure one step past the one fixed
// above — a control that correctly explains itself and still cannot be got
// past. The refusal now carries a top-up offer (lib/ai/topupOffer.js) and this
// panel opens app/components/ai/AiCreditTopupDialog.js on it, from BOTH the
// pre-click status and a 402 on submit, because the balance can drain between
// the two.
//
// ── 2026-09-03: start from one of YOUR photos ──────────────────────────────
//
// The reference-image path existed end to end and no screen could reach it:
// lib/ai/provider.js's generateImage() routes to images.edit when a reference
// is present, lib/ai/images.js fetches and resizes the photo, and
// lib/designer/aiImageAdapter.js already forwarded
// `payload.referencePhotoUrl` — background removal is that same edit path
// with a fixed prompt, which is how we know it works. What was missing was a
// control to supply one, and a route that passed it on
// (app/api/designer/generate/route.js built `{ prompt }` and dropped the
// rest).
//
// Two sources, because contractors have photos in two places: one already on
// the canvas (a job photo they dragged in), and one on the phone in their
// hand. Both end up as a Cloudinary URL from this deployment's own uploader,
// which is what the route insists on before it will fetch anything
// server-side.
//
// ── Why the prompt hint is three lines and not a tutorial ─────────────────
//
// Contractors write bad briefs — "make me an ad" — and the fix people reach
// for is a wall of prompt-engineering advice nobody reads. The three lines
// below say what this tool actually does, in the order it matters: it edits
// the photo you attach, it does not know your prices, and it is not the way
// to make a before/after (the job-post composer on the designer index is).
// Every one of them is a fact about this build, not a technique.
import { useCallback, useRef, useState } from "react";
import { AlertTriangle, ImagePlus, Loader, X } from "lucide-react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";
import {
  useAiImageStatus,
  centsToDollars,
  disabledReasonText,
} from "@/app/components/designer/hooks/useAiImageStatus";
import {
  AiCreditTopupDialog,
  useAiCreditTopup,
} from "@/app/components/ai/AiCreditTopupDialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function AiSidebar({ editor, activeTool, onChangeActiveTool }) {
  const { t } = useTranslation();
  const active = activeTool === "ai";
  const { status, loading, refresh } = useAiImageStatus(active);

  const [value, setValue] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // The photo the generation is built FROM, or null for an unconditioned
  // generation — which is what this panel did before and still does when
  // nothing is attached.
  const [reference, setReference] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [picking, setPicking] = useState(false);
  const fileInputRef = useRef(null);

  // Photos already on the canvas, read at the moment the picker is opened
  // rather than kept in state — the canvas mutates on every drag and this
  // only needs the answer when somebody looks. Same reasoning as
  // CampaignEditor.js's getCanvasPhotoUrls().
  const canvasPhotos = () => {
    const objects = editor?.canvas?.getObjects?.() || [];
    return [
      ...new Set(
        objects
          .filter((o) => o.type === "image" && typeof o.getSrc === "function")
          .map((o) => o.getSrc())
          .filter((src) => typeof src === "string" && /^https:\/\//.test(src)),
      ),
    ].slice(0, 12);
  };

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    // Cleared immediately so choosing the SAME file twice still fires change.
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || t("app.aiImage.uploadFailed", "That photo wouldn't upload."));
        return;
      }
      setReference(data.url);
    } catch {
      setError(t("app.aiImage.networkError"));
    } finally {
      setUploading(false);
    }
  }

  // Coming back from Stripe, the panel is closed and `value` is empty — a
  // fresh mount of the whole editor. Reopening the tool is what makes the
  // trip feel like one interruption rather than two: the prompt is where they
  // left it, the balance is topped up, and the button is live. What is NOT
  // done here is pressing it for them; see AiCreditTopupDialog.js's rule 3.
  const onResume = useCallback(
    (pending) => {
      if (typeof pending?.prompt === "string") setValue(pending.prompt);
      onChangeActiveTool("ai");
    },
    [onChangeActiveTool],
  );

  const topup = useAiCreditTopup({
    pendingKey: "designer.ai",
    onResume,
    // The status endpoint, not the payment result, is what re-enables the
    // button. "Paid" and "affordable" are different facts and only the second
    // one is this panel's business.
    onCredited: refresh,
  });

  const onClose = () => onChangeActiveTool("select");

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!status?.allowed) return;

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/designer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // referencePhotoUrl, when attached, is what routes this at the vendor
        // to images.edit instead of images.generate — see the route.
        body: JSON.stringify({ prompt: value, referencePhotoUrl: reference || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 402 is "you're short by exactly this much", and the body carries the
        // offer. Handled here as well as on the pre-click status because
        // another image or a photo review can drain the balance in between —
        // and a refusal at that moment is the one most likely to read as a bug.
        if (res.status === 402 && data?.topup) {
          topup.open(data);
          return;
        }
        // The route's own message when it has one — it is the specific
        // refusal, already written for this case. The catalogue string is the
        // fallback for a body that carries none.
        setError(data.error || t("app.aiImage.error"));
        return;
      }
      editor?.addImage(data.url);
      setValue("");
    } catch {
      setError(t("app.aiImage.networkError"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
        active ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title={t("app.aiImage.title")}
        description={
          // Priced once the status has landed, plain until then. Both forms
          // are catalogue entries rather than one sentence with the amount
          // appended, because "— $0.12 each" is not a suffix in every language.
          status?.priceCents
            ? t("app.aiImage.subtitlePriced", {
                price: centsToDollars(status.priceCents),
              })
            : t("app.aiImage.subtitle")
        }
      />
      <div className="overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader className="size-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && (
          <form onSubmit={onSubmit} className="space-y-4 p-4">
            {!status?.allowed && (
              <div className="space-y-2 rounded-lg border bg-muted/50 p-3">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                  <span>{disabledReasonText(status, t)}</span>
                </div>
                {/* Only where money is the problem, and only where the reason
                    came with an offer. A "feature switched off" or "vendor not
                    wired" refusal gets no button, because buying credit would
                    change nothing about either. */}
                {status?.topup && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 w-full"
                    onClick={() => topup.open(status)}
                  >
                    {t("app.aiTopup.buyCredit", "Add AI credit")}
                  </Button>
                )}
              </div>
            )}
            {/* ── The photo this is built FROM ───────────────────────────
                Attached: the vendor EDITS this picture. Empty: it invents
                one from the words alone. Both are real behaviours of this
                button, so the panel names which one is about to happen
                instead of leaving it to be discovered from the result. */}
            <div className="space-y-1.5">
              <Label>{t("app.aiImage.referenceLabel", "Start from a photo")}</Label>
              {reference ? (
                <div className="flex items-center gap-2 rounded-lg border p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={reference}
                    alt={t("app.aiImage.referenceAlt", "The photo this image will be built from")}
                    className="size-14 rounded object-cover"
                  />
                  <p className="flex-1 text-xs text-muted-foreground">
                    {t("app.aiImage.referenceAttached", "Your photo will be edited, not replaced.")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setReference(null)}
                    aria-label={t("app.aiImage.referenceRemove", "Remove this photo")}
                    className="flex size-9 items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 flex-1"
                    disabled={uploading || submitting}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader className="size-3.5 animate-spin" />
                    ) : (
                      <ImagePlus className="size-3.5" />
                    )}
                    {t("app.aiImage.referenceUpload", "Upload")}
                  </Button>
                  {/* Only offered when there IS something to pick. A picker
                      over an empty canvas is a button that opens nothing. */}
                  {canvasPhotos().length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 flex-1"
                      disabled={submitting}
                      onClick={() => setPicking((v) => !v)}
                    >
                      {t("app.aiImage.referenceFromCanvas", "Use one on the canvas")}
                    </Button>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              {picking && !reference && (
                <div className="grid grid-cols-3 gap-2">
                  {canvasPhotos().map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => {
                        setReference(url);
                        setPicking(false);
                      }}
                      className="overflow-hidden rounded border"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-16 w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-image-prompt">{t("app.aiImage.promptLabel")}</Label>
              <Textarea
                id="ai-image-prompt"
                disabled={!status?.allowed || submitting}
                placeholder={t("app.aiImage.promptPlaceholder")}
                rows={4}
                required
                minLength={3}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t("app.aiImage.notOnDocuments")}
              </p>
              {/* Three facts about this build, not prompt-engineering advice
                  — see this file's header for why it stops at three. */}
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>
                  {reference
                    ? t(
                        "app.aiImage.hintWithPhoto",
                        "Say what to change about the photo — \u201cput this door on a plain white background\u201d.",
                      )
                    : t(
                        "app.aiImage.hintNoPhoto",
                        "With no photo attached it invents one. Attach a real photo if the picture is meant to be your work.",
                      )}
                </li>
                <li>{t("app.aiImage.hintNoPrices", "It doesn\u2019t know your prices or your service area \u2014 type any number you want on it yourself.")}</li>
                <li>{t("app.aiImage.hintUseJobPost", "For a before/after from a real job, use \u201cMake a post from a job\u201d on the designer list instead.")}</li>
              </ul>
            </div>
            <Button disabled={!status?.allowed || submitting} type="submit" className="w-full">
              {submitting ? t("app.aiImage.generating") : t("app.aiImage.generate")}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>
        )}
      </div>
      <ToolSidebarClose onClick={onClose} />
      {/* Rendered inside the panel, which is `hidden` when another tool is
          selected — and that is correct: every path that opens this dialog
          either happens while the panel is active or reopens it first
          (onResume above). */}
      <AiCreditTopupDialog {...topup.dialogProps} capturePending={() => ({ prompt: value })} />
    </aside>
  );
}
