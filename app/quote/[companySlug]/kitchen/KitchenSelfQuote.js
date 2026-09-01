"use client";

// app/quote/[companySlug]/kitchen/KitchenSelfQuote.js
//
// "Design your own kitchen and we'll price it."
//
// The top of the funnel: a stranger on the contractor's website, no account, no
// quote, usually on a phone. So the whole page carries the CONTRACTOR's name and
// logo and never FieldQuo's — a homeowner comparing three quotes shouldn't be
// able to tell two of them run the same software.
//
// ── Draw first, ask for details second ────────────────────────────────────
//
// The form is deliberately at the END. Asking for a name and phone number
// before someone has done anything is where this kind of page loses people;
// asking after they've spent ten minutes laying out their kitchen is asking
// someone who is already invested. They can play with it as long as they like
// and nothing is sent until they press the button.
//
// ── No prices, on purpose ──────────────────────────────────────────────────
//
// Not a limitation — the product decision. A layout can be drawable and
// unbuildable, and a cabinet maker quotes by hand for exactly that reason. So
// this page promises "we'll come back with a price", the drawing goes to the
// company as a lead, and a human prices it. Showing an instant number here
// would mean either publishing the rate card or inventing a figure the
// contractor never agreed to.

import { useState } from "react";
import { Loader2, Check, Send, Ruler } from "lucide-react";
import { designerTheme } from "@/lib/kitchen/designerTheme";
import KitchenDesigner from "@/app/components/kitchen/KitchenDesigner";
import { KitchenSheet } from "@/app/components/kitchen/PlanSvg";
import { DISCLOSURE } from "@/lib/voice/disclosure";

export default function KitchenSelfQuote({ company }) {
  const [design, setDesign] = useState(null);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState("");
  const [showSheet, setShowSheet] = useState(false);

  const theme = designerTheme({ brandColor: company.brandColor }, false);
  const placed = design?.elements?.length || 0;

  async function submit(e) {
    e.preventDefault();
    setError("");

    if (!placed) {
      setError("Add at least one cabinet to your layout first.");
      return;
    }
    if (!form.name.trim() || (!form.email.trim() && !form.phone.trim())) {
      setError("We need your name and either an email or a phone number.");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/self-quote/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companySlug: company.slug, ...form, design }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Inline, not a toast. A homeowner has no error tray and no second
        // guess about what went wrong — the message belongs next to the button
        // they just pressed.
        setError(data.error || "That didn't send. Check your connection and try again.");
        return;
      }
      setSent(data.message || "Thanks — we'll be in touch with a price.");
    } catch {
      setError("That didn't send. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <main className="min-h-dvh bg-white grid place-items-center p-6">
        <div className="max-w-md text-center">
          <div
            className="mx-auto h-14 w-14 rounded-full grid place-items-center"
            style={{ backgroundColor: theme.gold }}
          >
            <Check size={26} className="text-white" strokeWidth={3} />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 mt-5">Sent</h1>
          <p className="text-sm text-neutral-600 mt-2">{sent}</p>
          <p className="text-xs text-neutral-500 mt-6">
            Keep an eye on your {form.email ? "email" : "phone"} — your quote will
            arrive there, and you&apos;ll be able to adjust the layout again
            before you approve it.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-white">
      <header className="border-b border-neutral-200 sticky top-0 bg-white z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          {company.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={company.logoUrl}
              alt={company.name}
              className="h-8 w-auto max-w-[9rem] object-contain"
            />
          ) : (
            <span className="font-bold text-neutral-900">{company.name}</span>
          )}
          {placed > 0 && (
            <span className="ml-auto text-xs text-neutral-500">
              {placed} piece{placed === 1 ? "" : "s"} placed
            </span>
          )}
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Design your kitchen</h1>
          <p className="text-sm text-neutral-600 mt-1.5 max-w-2xl">
            Set your room size, drop in cabinets and appliances, and pick your
            colours. When it looks right, send it to {company.name}{" "}
            and they&apos;ll come back with a price. Nothing is sent until you
            press the button.
          </p>
        </div>

        {/* clientMode: no pricing panel, no rate card. See the route. */}
        <KitchenDesigner value={design} onChange={setDesign} theme={theme} clientMode />

        {placed > 0 && (
          <div className="border border-neutral-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowSheet((v) => !v)}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-neutral-900 bg-neutral-50"
            >
              <Ruler size={15} style={{ color: theme.gold }} />
              {showSheet ? "Hide" : "See"} the finished drawing
              <span className="ml-auto text-xs font-normal text-neutral-500">
                plan &amp; elevations
              </span>
            </button>
            {/* The presentation sheet, from the same design. Worth showing
                BEFORE they send: it's what the contractor will see and what
                ends up on the quote, and seeing it is what makes someone
                confident enough to hand over their phone number. */}
            {showSheet && (
              <div className="p-3 bg-white">
                <KitchenSheet
                  design={design}
                  title="Your kitchen"
                  subtitle={`${Math.round((design?.room?.width || 0) / 12)}' × ${Math.round(
                    (design?.room?.depth || 0) / 12,
                  )}' room`}
                />
              </div>
            )}
          </div>
        )}

        <form
          onSubmit={submit}
          className="border border-neutral-200 rounded-xl p-5 space-y-4 bg-neutral-50"
        >
          <div>
            <h2 className="font-bold text-neutral-900">Where do we send the price?</h2>
            <p className="text-sm text-neutral-600 mt-1">
              {company.name} will price your layout and send it over. No obligation.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Your name" required>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                autoComplete="name"
                className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 bg-white text-neutral-900"
              />
            </Field>
            <Field label="Phone">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 bg-white text-neutral-900"
              />
            </Field>
            <Field label="Email">
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                type="email"
                autoComplete="email"
                inputMode="email"
                className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 bg-white text-neutral-900"
              />
            </Field>
            <Field label="Address of the job">
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                autoComplete="street-address"
                className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 bg-white text-neutral-900"
              />
            </Field>
          </div>

          <Field label="Anything else they should know?">
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Timing, budget, whether you're keeping the appliances…"
              className="w-full px-3 py-2.5 rounded-lg border border-neutral-300 bg-white text-neutral-900"
            />
          </Field>

          {error && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold text-white disabled:opacity-50"
            style={{ backgroundColor: theme.gold }}
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {sending ? "Sending…" : "Send my layout for a price"}
          </button>
          <p className="text-xs text-neutral-500">
            You&apos;ll get a written quote back — this page doesn&apos;t give
            you a price on the spot, because {company.name} checks the layout is
            buildable first.
          </p>
          {/* The disclosure, verbatim from lib/voice/outbound.js — the same
              string that gets stored as the consent record, so what we can
              prove they saw is literally what was rendered. Two copies drift,
              and the one that drifts is the one in the evidence. */}
          <p className="text-xs text-neutral-500">{DISCLOSURE.self_quote}</p>
        </form>
      </div>

      <footer className="max-w-5xl mx-auto px-4 py-10 text-center text-xs text-neutral-400">
        {company.name}
      </footer>
    </main>
  );
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-neutral-800">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}
