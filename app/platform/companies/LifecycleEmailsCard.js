// app/platform/companies/LifecycleEmailsCard.js
//
// The trial sequence's two platform-owned inputs, beside the next-steps card:
// WHO the personal day-3 note is from, and the customer stories the day-5
// help letter may show. lib/lifecycle/settings.js says what each field does;
// /api/platform/lifecycle-emails reads for every admin and writes for a
// superadmin, and this card draws the editors only for the role the route
// accepts (never a control the API refuses after the click).
//
// The state is said in words, honestly: until a name AND a reply-to are set,
// the personal note is NOT being sent, and the card says exactly that rather
// than showing an empty form that looks like a working feature. The same for
// the stories: none listed, no block in the letter.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";

const EMPTY_SENDER = { name: "", title: "", replyTo: "", phone: "", bookingUrl: "" };
const KIND_LABELS = {
  feature_payments: "Nudge: card payments",
  feature_booking: "Nudge: online booking",
  feature_quote: "Nudge: first quote",
  feature_import: "Nudge: import clients",
  milestone_booking: "Milestone: booking page live",
  milestone_payments: "Milestone: Stripe connected",
  milestone_quote: "Milestone: first quote sent",
  personal_checkin: "Personal day-3 note",
  help_articles: "Day-5 help articles",
  trial_ended: "Trial ended",
  win_back: "Win-back (14 days after a cancellation)",
  newsletter: "Product updates (monthly)",
};

export default function LifecycleEmailsCard() {
  const { isSuperadmin } = usePlatformAdmin();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [sender, setSender] = useState(EMPTY_SENDER);
  const [stories, setStories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");

  const apply = (res) => {
    setData(res);
    setSender({ ...EMPTY_SENDER, ...(res.personalSender || {}) });
    setStories(Array.isArray(res.stories) ? res.stories : []);
  };

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      apply(await fetchJson("/api/platform/lifecycle-emails"));
      setStatus("ready");
    } catch (err) {
      setError(err.message || "Could not load the trial-sequence settings.");
      setStatus("failed");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(body, label) {
    setSaving(true);
    setSaved("");
    setError("");
    try {
      apply(await fetchJson("/api/platform/lifecycle-emails", { method: "PUT", body }));
      setSaved(label);
    } catch (err) {
      setError(err.message || "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  const field = (key, label, props = {}) => (
    <label className="text-sm text-foreground">
      <span className="block text-xs text-muted-foreground mb-1">{label}</span>
      <input
        {...props}
        value={sender[key]}
        onChange={(e) => setSender((s) => ({ ...s, [key]: e.target.value }))}
        className="w-full sm:w-64 border border-border rounded-lg px-3 py-2 bg-background text-foreground"
      />
    </label>
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-3">
        <Mail size={18} className="text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold text-foreground">Trial sequence emails</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Hourly, in each company&apos;s own 9am–6pm: a nudge for each feature not set up yet (card payments, online
            booking, first quote, importing clients) about every two days through day 10, skipped once it&apos;s done; a
            &ldquo;you did it&rdquo; letter the day after the booking page goes live, Stripe connects or the first quote
            goes out; a personal note on day 3; real help articles on day 5; and the trial-ended letter. Never two
            lifecycle emails on the same day, never to a demo, a test address, the do-not-contact list, or someone who
            switched tips off. Full schedule: docs/ONBOARDING-EMAILS.md.
          </p>

          {status === "loading" && (
            <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </p>
          )}
          {status === "failed" && (
            <p className="text-sm text-red-700 dark:text-red-300 mt-3">
              {error}{" "}
              <button type="button" onClick={load} className="underline underline-offset-2">
                Retry
              </button>
            </p>
          )}

          {status === "ready" && data && (
            <>
              {data.sentByKind && (
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-foreground">
                  {Object.entries(data.sentByKind).map(([k, n]) => (
                    <li key={k} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{KIND_LABELS[k] || k}</span>
                      <span className="tabular-nums">{n} sent</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground">Personal day-3 note</h3>
                <p className={`text-sm mt-1 ${data.personalReady ? "text-foreground" : "text-amber-800 dark:text-amber-300"}`}>
                  {data.personalReady
                    ? `Sending from ${data.personalSender.name}${data.personalSender.title ? `, ${data.personalSender.title}` : ""}; replies go to ${data.personalSender.replyTo}.`
                    : "Not being sent: no name and reply-to are set. The note is never sent from a made-up person — set the real sender below and it starts with the next company that reaches day 3."}
                </p>
                {isSuperadmin ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      save({ personalSender: sender }, "Sender saved.");
                    }}
                    className="mt-3 flex flex-wrap items-end gap-3"
                  >
                    {field("name", "Name (required)", { autoComplete: "off" })}
                    {field("title", "Title (optional)")}
                    {field("replyTo", "Reply-to email (required)", { type: "email" })}
                    {field("phone", "Phone (optional)", { type: "tel" })}
                    {field("bookingUrl", "Booking link, https (optional)", { type: "url" })}
                    <button type="submit" disabled={saving} className="bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold min-h-11 disabled:opacity-60">
                      {saving ? "Saving…" : "Save sender"}
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-muted-foreground mt-2">Only a superadmin can change this.</p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground">Customer stories in the day-5 letter</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {stories.length
                    ? `${stories.length} listed. A letter shows up to two: the company's trade first, then stories filed under no trade.`
                    : "None listed, so the letter has no stories block. Only add real stories with a real link — nothing is ever invented."}{" "}
                  Images must be hosted by FieldQuo (www.fieldquo.com or FieldQuo&apos;s Cloudinary).
                </p>
                {isSuperadmin ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      save({ stories }, "Stories saved.");
                    }}
                    className="mt-3 space-y-3"
                  >
                    {stories.map((s, i) => (
                      <div key={i} className="flex flex-wrap items-end gap-2 border border-border rounded-lg p-3">
                        {[
                          ["title", "Title"],
                          ["url", "Link (https)"],
                          ["imageUrl", "Image (optional)"],
                        ].map(([k, label]) => (
                          <label key={k} className="text-sm text-foreground">
                            <span className="block text-xs text-muted-foreground mb-1">{label}</span>
                            <input
                              value={s[k] || ""}
                              onChange={(e) => setStories((list) => list.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                              className="w-full sm:w-56 border border-border rounded-lg px-3 py-2 bg-background text-foreground"
                            />
                          </label>
                        ))}
                        <label className="text-sm text-foreground">
                          <span className="block text-xs text-muted-foreground mb-1">Trade</span>
                          <select
                            value={s.trade || ""}
                            onChange={(e) => setStories((list) => list.map((x, j) => (j === i ? { ...x, trade: e.target.value } : x)))}
                            className="border border-border rounded-lg px-3 py-2 bg-background text-foreground"
                          >
                            <option value="">Any trade</option>
                            {(data.storyTrades || []).map((tr) => (
                              <option key={tr} value={tr}>
                                {tr.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => setStories((list) => list.filter((_, j) => j !== i))}
                          className="inline-flex items-center gap-1 text-sm text-red-700 dark:text-red-300 min-h-11 px-2"
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap items-center gap-3">
                      {stories.length < (data.storiesMax || 8) && (
                        <button
                          type="button"
                          onClick={() => setStories((list) => [...list, { title: "", url: "", imageUrl: "", trade: "" }])}
                          className="inline-flex items-center gap-1 text-sm underline text-foreground min-h-11"
                        >
                          <Plus size={14} /> Add a story
                        </button>
                      )}
                      <button type="submit" disabled={saving} className="bg-inverted text-inverted-foreground px-4 py-2 rounded-lg text-sm font-semibold min-h-11 disabled:opacity-60">
                        {saving ? "Saving…" : "Save stories"}
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>

              {saved && <p className="text-sm text-green-700 dark:text-green-300 mt-3">{saved}</p>}
              {error && <p className="text-sm text-red-700 dark:text-red-300 mt-3">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
