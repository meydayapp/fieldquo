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
import { useCallback, useState } from "react";
import { AlertTriangle, Loader } from "lucide-react";

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
        body: JSON.stringify({ prompt: value }),
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
