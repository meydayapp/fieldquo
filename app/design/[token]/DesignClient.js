"use client";

// app/design/[token]/DesignClient.js
//
// The homeowner's view of their own kitchen.
//
// A stranger with no account, often on a phone, often on a bad connection, in a
// driveway. So: the contractor's name and logo at the top, no FieldQuo anywhere
// except the small footer, and no prices — see the route for why.
//
// What they can do is move cabinets and change the finish. What they can't do
// is change what any of it costs. The contractor is notified, compares, and
// decides; nothing here reprices anything on its own.

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Loader2, Check, Save } from "lucide-react";
import { designerTheme } from "@/lib/kitchen/designerTheme";
import KitchenDesigner from "@/app/components/kitchen/KitchenDesigner";

export default function DesignClient() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [design, setDesign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    fetch(`/api/kitchen-design/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "This design link isn't working.");
        }
        return res.json();
      })
      .then((d) => {
        if (!live) return;
        setData(d);
        setDesign(d.kitchenConfig);
      })
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [token]);

  const onChange = useCallback((next) => {
    setDesign(next);
    setSaved(false);
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/kitchen-design/${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitchenConfig: design }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        // Shown inline. A homeowner has no error toast, no support channel and
        // no second attempt in mind — the message has to be on the screen next
        // to the button they just pressed.
        setError(d.error || "That didn't save. Check your connection and try again.");
        return;
      }
      setSaved(true);
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center p-8">
        <Loader2 size={22} className="animate-spin text-neutral-400" />
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className="min-h-screen grid place-items-center p-8 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold text-neutral-900">
            This link isn&apos;t working
          </h1>
          <p className="text-sm text-neutral-600 mt-2">{error}</p>
          <p className="text-sm text-neutral-600 mt-4">
            Reply to the email your quote came in and they&apos;ll send a new one.
          </p>
        </div>
      </main>
    );
  }

  // Always light. A quote and the drawing that goes with it are documents — a
  // kitchen that arrives dark because the homeowner's phone is in dark mode is
  // a drawing that looks wrong. Same rule as the quote and portal pages.
  const theme = designerTheme({ brandColor: data.companyBrandColor }, false);

  return (
    <main className="min-h-screen bg-white">
      <header className="border-b border-neutral-200">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          {data.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.companyLogoUrl}
              alt={data.companyName}
              className="h-9 w-auto max-w-[10rem] object-contain"
            />
          ) : (
            <span className="font-bold text-neutral-900">{data.companyName}</span>
          )}
          <div className="ml-auto text-right">
            <p className="text-xs text-neutral-500">Quote {data.quoteNumber}</p>
            {data.clientName && (
              <p className="text-sm font-medium text-neutral-900">{data.clientName}</p>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-5 space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 min-w-[14rem]">
            <h1 className="text-xl font-bold text-neutral-900">Your kitchen</h1>
            <p className="text-sm text-neutral-600 mt-1">
              {data.locked
                ? "This is the layout on your quote."
                : "Move things around and try different finishes. When you save, " +
                  `${data.companyName} gets your version and will confirm the price.`}
            </p>
          </div>

          {!data.locked && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !design}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: theme.gold }}
            >
              {saving ? (
                <Loader2 size={15} className="animate-spin" />
              ) : saved ? (
                <Check size={15} />
              ) : (
                <Save size={15} />
              )}
              {saving ? "Sending…" : saved ? "Sent to your contractor" : "Save my version"}
            </button>
          )}
        </div>

        {saved && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Saved. {data.companyName} has been told, and will get back to you
            with an updated price if anything changed.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* clientMode hides the pricing panel entirely — that panel is the
            company's rate card. See the route. */}
        <KitchenDesigner
          value={design}
          onChange={onChange}
          theme={theme}
          clientMode
          readOnly={data.locked}
        />
      </div>

      <footer className="max-w-6xl mx-auto px-4 py-8 text-center text-xs text-neutral-400">
        {data.companyName}
      </footer>
    </main>
  );
}
