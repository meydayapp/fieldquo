"use client";

// app/app/quotes/[id]/kitchen/KitchenPage.js
//
// The contractor's kitchen designer for one quote.
//
// Saving draws the line: the design is stored AND the quote is repriced in the
// same request (see the route). So this page has one primary action, not a
// "save design" and a separate "update the quote" — two buttons is how a quote
// goes out at a price that doesn't match the drawing stapled to it.

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Save, Check, Link2, UserCheck } from "lucide-react";
import { useTheme } from "@/app/providers/ThemeProvider";
import { designerTheme } from "@/lib/kitchen/designerTheme";
import { reportResponseError } from "@/lib/clientErrors";
import KitchenDesigner from "@/app/components/kitchen/KitchenDesigner";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function KitchenPage({ company }) {
  const { t } = useTranslation();
  const { id } = useParams();
  const router = useRouter();
  const { isDark } = useTheme();

  const [data, setData] = useState(null);
  const [design, setDesign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/quotes/${id}/kitchen`)
      .then(async (res) => {
        if (!res.ok) {
          await reportResponseError(res, "Couldn't load this kitchen.");
          return null;
        }
        return res.json();
      })
      .then((d) => {
        if (!live || !d) return;
        setData(d);
        setDesign(d.design);
      })
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [id]);

  // The designer fires on every drag. Kept in state and saved on the button
  // rather than autosaved: each save reprices the quote, and a quote total that
  // moves while someone is still dragging a cabinet around is alarming to watch
  // and expensive to undo.
  const onChange = useCallback((next) => {
    setDesign(next);
    setSaved(false);
  }, []);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/quotes/${id}/kitchen`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design }),
      });
      // reportResponseError raises the global toast — ErrorToast is mounted
      // once in the app layout, so a second inline banner here would show the
      // same failure twice.
      if (!res.ok) {
        await reportResponseError(res, "Couldn't save the design.");
        return;
      }
      setSaved(true);
      // The quote page shows the repriced total, so refresh it behind us.
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function copyClientLink() {
    if (!data?.shareToken) return;
    await navigator.clipboard.writeText(
      `${window.location.origin}/design/${data.shareToken}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-[28rem] bg-accent rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6">
        <p className="text-sm text-muted-foreground">
          {t("app.kitchen.loadError", "This quote couldn't be loaded.")}
        </p>
      </div>
    );
  }

  const locked = data.status !== "draft";
  const theme = designerTheme(company || {}, isDark);

  return (
    <div className="p-4 sm:p-6 max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/app/quotes/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> {data.quoteNumber}
        </Link>
        <h1 className="text-lg sm:text-xl font-semibold text-foreground">
          {t("app.kitchen.title", "Kitchen designer")}
        </h1>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Only offered once the quote has a share token — that's minted when
              the quote is sent. A button that copies a link to a 404 is worse
              than no button. */}
          {data.shareToken ? (
            <button
              type="button"
              onClick={copyClientLink}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:bg-muted"
            >
              {copied ? <Check size={15} /> : <Link2 size={15} />}
              {copied ? t("app.action.copied") : t("app.kitchen.clientLink", "Client link")}
            </button>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("app.kitchen.sendToGetLink", "Send the quote to get a client design link")}
            </span>
          )}

          {!locked && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !design}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : saved ? (
                <Check size={15} />
              ) : (
                <Save size={15} />
              )}
              {saving
                ? t("app.kitchen.pricing", "Pricing…")
                : saved
                  ? t("app.kitchen.savedRepriced", "Saved & repriced")
                  : t("app.kitchen.saveReprice", "Save & reprice quote")}
            </button>
          )}
        </div>
      </div>

      {locked && (
        <div className="rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
          {t(
            "app.kitchen.lockedNote",
            "This quote has already been sent, so the design is read-only. Duplicate the quote to change it — a sent quote is a commitment, and repricing one underneath the client leaves you both looking at different numbers.",
          )}
        </div>
      )}

      {/* The client's own edits, surfaced rather than merged. The contractor
          decides whether to adopt them; silently overwriting their drawing with
          a homeowner's is not a decision software should make. */}
      {data.clientDesign && (
        <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-wrap items-center gap-3">
          <UserCheck size={16} className="text-muted-foreground shrink-0" />
          <p className="text-sm text-foreground flex-1 min-w-[12rem]">
            {t("app.kitchen.clientSavedVersion", "Your client saved their own version of this layout")}
            {data.clientDesignAt
              ? ` ${t("app.kitchen.onDate", { date: new Date(data.clientDesignAt).toLocaleDateString() })}`
              : ""}
            .
          </p>
          {!locked && (
            <button
              type="button"
              onClick={() => {
                setDesign(data.clientDesign);
                setSaved(false);
              }}
              className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted"
            >
              {t("app.kitchen.loadTheirVersion", "Load their version")}
            </button>
          )}
        </div>
      )}

      <KitchenDesigner
        value={design}
        onChange={onChange}
        theme={theme}
        rates={data.rates}
        readOnly={locked}
      />
    </div>
  );
}
