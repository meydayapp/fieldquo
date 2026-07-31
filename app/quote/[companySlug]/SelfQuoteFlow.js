// app/quote/[companySlug]/SelfQuoteFlow.js
//
// The form itself. Three steps, in the order a stranger will tolerate.
//
// ── Why the service comes first and contact details come last ───────────────
//
// The instinct is to ask for name and email up front, because that's the thing
// the company actually wants. It's also the fastest way to lose someone: a
// form that opens with "email address" from a company you were only curious
// about gets closed.
//
// Picking a service is a low-commitment tap that answers a question the
// visitor already knows the answer to. By the time they've told you it's a
// kitchen with forty doors, they've invested enough to finish. This is the
// same reason the internal builder starts with the client and this one ends
// with them — different audiences, opposite order.
//
// ── No prices ───────────────────────────────────────────────────────────────
//
// This produces a LEAD, not a quote. The endpoint returns no rates and this
// page shows none. A self-serve figure a contractor hasn't seen is one they
// may have to honour, and publishing a rate card openly hands it to every
// competitor in the city. What it does instead is arrive at the callback with
// the size of the job already known.
//
// ── Renders inside an iframe ────────────────────────────────────────────────
//
// Same constraint as the booking flow: no fixed positioning, no viewport-
// height units, no assumption about surrounding width.
"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, ArrowLeft, Building2, AlertCircle } from "lucide-react";
import { readableForeground } from "@/lib/brand/colour";
import MediaUploader from "@/app/components/MediaUploader";

const FALLBACK_ACCENT = "#06356b";

export default function SelfQuoteFlow({ companySlug }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [details, setDetails] = useState({});
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState([]); // photos/videos of the job
  const [contact, setContact] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/self-quote/${companySlug}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(d?.error || "This link isn't valid.");
        setData(d);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  async function submit(e) {
    e.preventDefault();
    setError("");

    // Checked here as well as server-side, because being told "provide an
    // email or phone" after a page reload is how people give up.
    if (!contact.name.trim()) return setError("Please tell us your name.");
    if (!contact.email.trim() && !contact.phone.trim()) {
      return setError("Add an email or a phone number so we can reply.");
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/self-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companySlug,
          ...contact,
          categoryId: service?.id || null,
          description,
          details,
          media,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "Couldn't send your request.");
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Shell>
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-black/10 rounded w-1/3" />
          <div className="h-40 bg-black/10 rounded-xl" />
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell>
        <div className="bg-white border border-black/10 rounded-2xl p-8 text-center">
          <p className="text-lg font-semibold text-[#2d2520]">{loadError}</p>
          <p className="text-sm text-[#2d2520]/60 mt-2">
            Check the link, or get in touch with the company directly.
          </p>
        </div>
      </Shell>
    );
  }

  const c = data.company || {};
  const accent = c.brandColor || FALLBACK_ACCENT;
  const accentOn = readableForeground(accent);
  const services = data.services || [];

  if (done) {
    return (
      <Shell>
        <Card accent={accent}>
          <div className="px-6 sm:px-8 py-10 text-center">
            <div
              className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4"
              style={{ backgroundColor: accent, color: accentOn }}
            >
              <Check size={26} />
            </div>
            <h1 className="text-xl font-bold text-[#2d2520]">
              Thanks — we&apos;ve got it
            </h1>
            <p className="text-sm text-[#2d2520]/70 mt-2 max-w-sm mx-auto">
              {c.name} will be in touch
              {contact.email ? ` at ${contact.email}` : ""} to talk through the
              details and get you a price.
            </p>
            {c.phone && (
              <p className="text-sm text-[#2d2520]/60 mt-4">
                Need it sooner?{" "}
                <a href={`tel:${c.phone}`} className="underline font-medium">
                  {c.phone}
                </a>
              </p>
            )}
          </div>
        </Card>
      </Shell>
    );
  }

  return (
    <Shell>
      <Card accent={accent}>
        <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-black/5 flex items-center gap-3">
          {c.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.logoUrl}
              alt={c.name}
              className="h-10 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: accent, color: accentOn }}
            >
              <Building2 size={18} />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-semibold text-[#2d2520] truncate">{c.name}</div>
            <div className="text-xs text-[#2d2520]/55">Request a quote</div>
          </div>
        </div>

        {/* Progress. Three dots rather than a bar: a bar implies a percentage
            and invites the question "how much is left", which the answer
            "two more taps" answers better. */}
        <div className="px-6 sm:px-8 pt-4 flex items-center gap-1.5">
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ backgroundColor: n <= step ? accent : `${accent}22` }}
            />
          ))}
        </div>

        <div className="px-6 sm:px-8 py-5">
          {/* ── 1. What do you need? ─────────────────────────────────── */}
          {step === 1 && (
            <>
              <h2 className="font-semibold text-[#2d2520] mb-1">
                What can we help with?
              </h2>
              <p className="text-sm text-[#2d2520]/60 mb-4">
                Pick the closest match — we&apos;ll sort out the detail.
              </p>

              {services.length === 0 ? (
                <p className="text-sm text-[#2d2520]/60">
                  This company hasn&apos;t set up their services yet. Get in
                  touch with them directly
                  {c.phone ? ` on ${c.phone}` : ""}.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setService(s);
                        setDetails({});
                        setStep(2);
                      }}
                      className="text-left rounded-xl border border-black/10 px-4 py-3 text-sm font-medium text-[#2d2520] hover:border-black/25 transition-colors"
                      style={
                        service?.id === s.id
                          ? { borderColor: accent, backgroundColor: `${accent}0f` }
                          : undefined
                      }
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── 2. How big is it? ────────────────────────────────────── */}
          {step === 2 && service && (
            <>
              <BackLink onClick={() => setStep(1)} />
              <h2 className="font-semibold text-[#2d2520] mb-1">
                {service.label}
              </h2>
              <p className="text-sm text-[#2d2520]/60 mb-4">
                Rough numbers are fine — nothing here is binding.
              </p>

              {service.fields?.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {service.fields.map((f) => (
                    <div key={f.key}>
                      <label className="text-xs text-[#2d2520]/60">
                        {f.label}
                      </label>
                      {f.type === "select" ? (
                        <select
                          value={details[f.key] || ""}
                          onChange={(e) =>
                            setDetails((p) => ({ ...p, [f.key]: e.target.value }))
                          }
                          className="w-full mt-1 border border-black/15 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          <option value="">—</option>
                          {(f.options || []).map((o) => (
                            <option key={o} value={o}>
                              {String(o).replace(/_/g, " ")}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="number"
                          inputMode="numeric"
                          value={details[f.key] || ""}
                          onChange={(e) =>
                            setDetails((p) => ({ ...p, [f.key]: e.target.value }))
                          }
                          className="w-full mt-1 border border-black/15 rounded-lg px-3 py-2 text-sm"
                          placeholder="0"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <label className="text-xs text-[#2d2520]/60">
                Anything else we should know?
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Photos, timing, access, anything unusual…"
                className="w-full mt-1 border border-black/15 rounded-lg px-3 py-2 text-sm"
              />

              <button
                type="button"
                onClick={() => setStep(3)}
                className="w-full mt-4 py-3 rounded-full text-sm font-bold"
                style={{ backgroundColor: accent, color: accentOn }}
              >
                Continue
              </button>
            </>
          )}

          {/* ── 3. Where do we send it? ──────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={submit}>
              <BackLink onClick={() => setStep(2)} />
              <h2 className="font-semibold text-[#2d2520] mb-1">
                Where should we send it?
              </h2>
              <p className="text-sm text-[#2d2520]/60 mb-4">
                One of email or phone is enough.
              </p>

              <div className="space-y-3">
                <input
                  required
                  value={contact.name}
                  onChange={(e) =>
                    setContact((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="Your name"
                  className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  type="email"
                  value={contact.email}
                  onChange={(e) =>
                    setContact((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="Email"
                  className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  type="tel"
                  value={contact.phone}
                  onChange={(e) =>
                    setContact((p) => ({ ...p, phone: e.target.value }))
                  }
                  placeholder="Phone"
                  className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm"
                />
                <input
                  value={contact.address}
                  onChange={(e) =>
                    setContact((p) => ({ ...p, address: e.target.value }))
                  }
                  placeholder="Where's the job? (optional)"
                  className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm"
                />
                <MediaUploader
                  uploadUrl={`/api/self-quote/${companySlug}/upload`}
                  value={media}
                  onChange={setMedia}
                />
              </div>

              {error && (
                <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 py-3 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: accent, color: accentOn }}
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                Send my request
              </button>

              {/* Says what happens next. "Submit" with no follow-through is
                  the reason people fill a form and then ring anyway. */}
              <p className="text-xs text-[#2d2520]/50 mt-3 text-center">
                No obligation. {c.name} will get back to you with a price.
              </p>
            </form>
          )}
        </div>
      </Card>
    </Shell>
  );
}

function Shell({ children }) {
  // Padding rather than min-h-screen: this renders inside a 600px iframe as
  // often as it does standalone.
  return (
    <div className="bg-[#f5f2ec] py-8 px-4">
      <div className="max-w-lg mx-auto">{children}</div>
    </div>
  );
}

function Card({ accent, children }) {
  return (
    <div className="bg-white border border-black/10 rounded-2xl overflow-hidden shadow-sm">
      <div className="flex h-1.5">
        <div className="flex-[2]" style={{ backgroundColor: accent }} />
        <div className="flex-1" style={{ backgroundColor: `${accent}99` }} />
      </div>
      {children}
    </div>
  );
}

function BackLink({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs text-[#2d2520]/55 hover:text-[#2d2520] mb-3"
    >
      <ArrowLeft size={13} /> Back
    </button>
  );
}
