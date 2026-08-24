// app/app/funnels/[id]/page.js
//
// The funnel builder — step list on the left, the selected step's editor in the
// middle, a live branded preview of that step on the right. Publish is blocked
// (server-side too) unless there's a contact step, and the public link + pixels
// + drop-off analytics all live here. English-first, like the funnel itself.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
  Check,
  Copy,
  BarChart3,
  Radio,
} from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { embedSnippet } from "@/lib/embed/snippet";
import { readableForeground } from "@/lib/brand/colour";
import {
  bandFieldsFor,
  choiceFieldsFor,
  estimateStepIssues,
  funnelEstimateSteps,
  DEFAULT_ESTIMATE_ORDER,
} from "@/app/data/funnelBlocks";

const STEP_KINDS = [
  { kind: "intro", label: "Intro" },
  { kind: "question_single", label: "Single choice" },
  { kind: "question_multi", label: "Multiple choice" },
  { kind: "instant_estimate", label: "Instant estimate" },
  { kind: "photo_upload", label: "Photo upload" },
  { kind: "form", label: "Contact form" },
  { kind: "thankyou", label: "Thank you" },
];

function newStep(kind, i) {
  const id = `${kind}_${i}_${Date.now().toString(36)}`;
  switch (kind) {
    case "intro":
      return {
        id,
        kind,
        headline: "Get a quote",
        subhead: "",
        buttonText: "Get started",
      };
    case "question_single":
      return {
        id,
        kind,
        question: "Your question?",
        answers: [
          { id: `a_${Date.now().toString(36)}`, label: "Option A", value: "a" },
        ],
      };
    case "question_multi":
      return {
        id,
        kind,
        question: "Pick any that apply",
        buttonText: "Continue",
        answers: [
          { id: `a_${Date.now().toString(36)}`, label: "Option A", value: "a" },
        ],
      };
    case "instant_estimate":
      return {
        id,
        kind,
        headline: "Your instant price",
        subhead: "",
        sizeQuestion: "Roughly how big is the job?",
        buttonText: "Continue",
        // No trade and no bands: this step cannot be guessed. The editor asks
        // for both and publish is blocked until they exist, rather than seeding
        // a size the company never chose and quietly pricing it.
        trade: "",
        order: DEFAULT_ESTIMATE_ORDER,
        bands: [],
      };
    case "photo_upload":
      return {
        id,
        kind,
        headline: "Add photos (optional)",
        buttonText: "Continue",
      };
    case "form":
      return {
        id,
        kind,
        headline: "Where should we send it?",
        fields: ["name", "email", "phone"],
        buttonText: "Submit",
      };
    case "thankyou":
      return { id, kind, headline: "Thanks — we'll be in touch." };
    default:
      return { id, kind };
  }
}

export default function FunnelBuilderPage() {
  const { id } = useParams();
  const router = useRouter();

  const [funnel, setFunnel] = useState(null);
  const [company, setCompany] = useState(null);
  const [steps, setSteps] = useState([]);
  const [name, setName] = useState("");
  const [sel, setSel] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [showPixels, setShowPixels] = useState(false);
  const [pixels, setPixels] = useState({
    metaPixelId: "",
    tiktokPixelId: "",
    ga4Id: "",
  });
  const [copied, setCopied] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  // The company's own instant-quote services, read from the public endpoint the
  // homeowner-facing estimator uses. Labels and modes only — that response has
  // never carried a rate, and reading it here keeps "what a funnel may price"
  // and "what /instant-quote may price" as one list rather than two.
  const [iqTrades, setIqTrades] = useState(null);
  const [iqError, setIqError] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/funnels/${id}`);
    if (!res.ok) {
      reportResponseError(res, setError, "Couldn't load that funnel.");
      setLoading(false);
      return;
    }
    const f = await res.json();
    setFunnel(f);
    setCompany(f.company);
    setSteps(Array.isArray(f.steps) ? f.steps : []);
    setName(f.name || "");
    setPixels({
      metaPixelId: f.metaPixelId || "",
      tiktokPixelId: f.tiktokPixelId || "",
      ga4Id: f.ga4Id || "",
    });
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!company?.slug) return;
    let cancelled = false;
    fetch(`/api/instant-quote/${company.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        // Only the trades a funnel step can actually render — the rest need a
        // map, a satellite lookup or the junk taxonomy, none of which is a tap
        // on a full-screen card. bandFieldsFor() is the same filter the
        // sanitiser uses, so the dropdown can't offer a trade the server would
        // then refuse.
        setIqTrades((d?.trades || []).filter((t) => bandFieldsFor(t.trade).length > 0));
      })
      .catch(() => {
        // Left as null — "unknown", not "none". Treating a failed lookup as an
        // empty list would block publish on a funnel that is perfectly fine.
        if (!cancelled) setIqError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [company?.slug]);

  useEffect(() => {
    fetch(`/api/funnels/${id}/analytics`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setAnalytics)
      .catch(() => {});
  }, [id]);

  const accent = company?.brandColor || "#06356b";
  const step = steps[sel] || null;

  function mutate(next) {
    setSteps(next);
    setDirty(true);
  }
  function updateStep(patch) {
    mutate(steps.map((s, i) => (i === sel ? { ...s, ...patch } : s)));
  }
  function addStep(kind) {
    const s = newStep(kind, steps.length);
    // Keep thank-you last if present.
    const tyIdx = steps.findIndex((x) => x.kind === "thankyou");
    let next;
    if (tyIdx >= 0 && kind !== "thankyou") {
      next = [...steps.slice(0, tyIdx), s, ...steps.slice(tyIdx)];
      setSel(tyIdx);
    } else {
      next = [...steps, s];
      setSel(next.length - 1);
    }
    mutate(next);
  }
  function removeStep(i) {
    const next = steps.filter((_, idx) => idx !== i);
    mutate(next);
    setSel((s) => Math.max(0, Math.min(s, next.length - 1)));
  }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    mutate(next);
    setSel(j);
  }

  async function save(extra = {}) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/funnels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, steps, ...pixels, ...extra }),
      });
      if (!res.ok) return reportResponseError(res, setError, "Couldn't save.");
      const updated = await res.json();
      setFunnel((f) => ({ ...f, ...updated }));
      setSteps(Array.isArray(updated.steps) ? updated.steps : steps);
      setDirty(false);
      setSavedAt(Date.now());
      return updated;
    } finally {
      setSaving(false);
    }
  }

  // ── What stops this funnel going live ─────────────────────────────────────
  //
  // An estimate step with no service, no size options, or a service the company
  // hasn't switched on for instant quotes renders NOTHING. The public route
  // removes such a step rather than serving an empty card in a driveway — which
  // means publishing it would quietly ship a funnel missing the step the owner
  // built it for. So publish refuses here and names the fix.
  //
  // Availability is only judged when it is known: a failed lookup leaves the
  // list null and blocks nothing, because "we couldn't check" is not "you
  // haven't got one".
  const estimateBlockers = useMemo(() => {
    const out = [];
    for (const s of funnelEstimateSteps(steps)) {
      const name = s.headline || "Instant estimate";
      for (const issue of estimateStepIssues(s)) {
        if (issue.code === "no_trade" || issue.code === "no_bands") {
          out.push(`${name}: ${issue.message}`);
        }
      }
      if (s.trade && iqTrades && !iqTrades.some((t) => t.trade === s.trade)) {
        out.push(
          `${name}: that service isn't switched on for instant quotes, so the step can't price anything. Turn it on in Settings → Instant quotes.`,
        );
      }
    }
    return out;
  }, [steps, iqTrades]);

  async function togglePublish() {
    const next = funnel.status === "published" ? "draft" : "published";
    if (next === "published" && estimateBlockers.length) {
      setError(estimateBlockers[0]);
      return;
    }
    const updated = await save({ status: next });
    if (updated) setFunnel((f) => ({ ...f, status: updated.status }));
  }

  const publicUrl = useMemo(() => {
    if (!company?.slug || !funnel?.slug) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/f/${company.slug}/${funnel.slug}`;
  }, [company, funnel]);

  function copyLink() {
    if (!publicUrl) return;
    navigator.clipboard?.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // The embed, beside the link rather than instead of it — they answer
  // different questions. A link is right for an ad, a QR code or a
  // link-in-bio, where the visitor is arriving from somewhere else. The embed
  // is right for the company's own website, where sending someone OFF the page
  // they are already on is how you lose them.
  const embedCode = useMemo(() => {
    if (!company?.slug || !funnel?.slug) return "";
    return embedSnippet({
      origin: typeof window !== "undefined" ? window.location.origin : "",
      slug: company.slug,
      widget: "funnel",
      funnelSlug: funnel.slug,
      title: funnel.name || "Get a quote",
    });
  }, [company, funnel]);

  function copyEmbed() {
    if (!embedCode) return;
    navigator.clipboard?.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 1500);
  }

  if (loading)
    return (
      <div className="p-6 max-w-6xl mx-auto animate-pulse h-96 bg-accent rounded-xl" />
    );
  if (!funnel)
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <p className="text-sm text-red-600">{error || "Funnel not found."}</p>
      </div>
    );

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.push("/app/funnels")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={18} />
        </button>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDirty(true);
          }}
          className="text-lg font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-foreground outline-none flex-1 min-w-[160px]"
        />
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full ${
            funnel.status === "published"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {funnel.status}
        </span>
        <button
          onClick={() => save()}
          disabled={saving || !dirty}
          className="inline-flex items-center gap-1.5 border border-border px-3 py-1.5 rounded-full text-sm font-semibold disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : dirty ? (
            "Save"
          ) : savedAt ? (
            <>
              <Check size={14} /> Saved
            </>
          ) : (
            "Save"
          )}
        </button>
        <button
          onClick={togglePublish}
          disabled={
            saving || (funnel.status !== "published" && estimateBlockers.length > 0)
          }
          title={
            funnel.status !== "published" && estimateBlockers.length
              ? estimateBlockers[0]
              : undefined
          }
          className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground px-4 py-1.5 rounded-full text-sm font-semibold disabled:opacity-50"
          data-tour="funnel-publish"
        >
          {funnel.status === "published" ? "Unpublish" : "Publish"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Named in full rather than left on the disabled button, because a
          greyed-out Publish with no reason is its own kind of dead control. */}
      {estimateBlockers.length > 0 && funnel.status !== "published" && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
          <div className="font-semibold">
            This funnel can&rsquo;t go live yet
          </div>
          <ul className="list-disc ml-4 mt-1 space-y-0.5">
            {estimateBlockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Public link */}
      {funnel.status === "published" && publicUrl && (
        <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <span className="text-xs text-muted-foreground truncate flex-1">
            {publicUrl}
          </span>
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1 text-xs font-semibold text-foreground"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}{" "}
            {copied ? "Copied" : "Copy link"}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-foreground underline"
          >
            Open
          </a>
        </div>
      )}

      {funnel.status === "published" && embedCode && (
        <div className="bg-card border border-border rounded-lg px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Or paste this into your own website
            </span>
            <button
              onClick={copyEmbed}
              className="inline-flex items-center gap-1 text-xs font-semibold text-foreground shrink-0"
            >
              {copiedEmbed ? <Check size={13} /> : <Copy size={13} />}{" "}
              {copiedEmbed ? "Copied" : "Copy code"}
            </button>
          </div>
          <pre className="mt-2 bg-muted border border-border rounded p-2 text-[11px] overflow-x-auto">
            {embedCode}
          </pre>
        </div>
      )}

      {/* Analytics */}
      {analytics && analytics.starts > 0 && (
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
            <BarChart3 size={15} /> Performance
          </div>
          <div className="grid grid-cols-3 gap-3 text-center mb-3">
            <Stat label="Starts" value={analytics.starts} />
            <Stat label="Leads" value={analytics.completions} />
            <Stat
              label="Conversion"
              value={
                analytics.conversionRate != null
                  ? `${analytics.conversionRate}%`
                  : "—"
              }
            />
          </div>
          <div className="space-y-1">
            {analytics.steps.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-xs">
                <span className="w-32 truncate text-muted-foreground">
                  {s.label}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${s.retention ?? 100}%`,
                      backgroundColor: accent,
                    }}
                  />
                </div>
                <span className="w-16 text-right text-muted-foreground">
                  {s.views} {s.retention != null ? `· ${s.retention}%` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Builder grid */}
      <div className="grid gap-4 lg:grid-cols-[220px_1fr_300px]">
        {/* Step list */}
        <div className="space-y-2" data-tour="funnel-steps">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Steps
          </div>
          {steps.map((s, i) => (
            <div
              key={s.id}
              className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${
                i === sel ? "border-foreground bg-accent" : "border-border"
              }`}
            >
              <button
                onClick={() => setSel(i)}
                className="flex-1 text-left min-w-0"
              >
                <div className="text-xs font-medium text-foreground truncate">
                  {STEP_KINDS.find((k) => k.kind === s.kind)?.label || s.kind}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {s.question || s.headline || "—"}
                </div>
              </button>
              <div className="flex flex-col">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="text-muted-foreground disabled:opacity-30"
                >
                  <ChevronUp size={13} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1}
                  className="text-muted-foreground disabled:opacity-30"
                >
                  <ChevronDown size={13} />
                </button>
              </div>
              {steps.length > 1 && (
                <button
                  onClick={() => removeStep(i)}
                  className="text-muted-foreground hover:text-red-600"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          <div className="pt-1">
            <div className="text-[11px] text-muted-foreground mb-1">
              Add step
            </div>
            <div className="flex flex-wrap gap-1">
              {STEP_KINDS.map((k) => (
                <button
                  key={k.kind}
                  onClick={() => addStep(k.kind)}
                  className="inline-flex items-center gap-1 text-[11px] border border-border rounded-full px-2 py-1 hover:border-foreground/30"
                >
                  <Plus size={11} /> {k.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Step editor */}
        <div className="bg-card border border-border rounded-xl p-4">
          {step ? (
            <StepEditor
              step={step}
              onChange={updateStep}
              iqTrades={iqTrades}
              iqError={iqError}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Add a step to begin.
            </p>
          )}
        </div>

        {/* Preview */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Preview
          </div>
          <StepPreview step={step} accent={accent} company={company} />
        </div>
      </div>

      {/* Pixels */}
      <div className="bg-card border border-border rounded-lg">
        <button
          onClick={() => setShowPixels((v) => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold text-foreground"
        >
          <Radio size={15} /> Ad tracking pixels
          <span className="text-xs text-muted-foreground font-normal ml-auto">
            {showPixels ? "Hide" : "Optional"}
          </span>
        </button>
        {showPixels && (
          <div className="px-4 pb-4 grid gap-3 sm:grid-cols-3">
            {[
              ["metaPixelId", "Meta Pixel ID"],
              ["tiktokPixelId", "TikTok Pixel ID"],
              ["ga4Id", "GA4 Measurement ID"],
            ].map(([key, label]) => (
              <label key={key} className="text-xs">
                <span className="text-muted-foreground">{label}</span>
                <input
                  value={pixels[key]}
                  onChange={(e) => {
                    setPixels((p) => ({ ...p, [key]: e.target.value }));
                    setDirty(true);
                  }}
                  className="w-full mt-1 border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-muted/50 py-2">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function Field({ label, value, onChange, textarea, placeholder }) {
  const Cmp = textarea ? "textarea" : "input";
  return (
    <label className="block text-xs">
      <span className="text-muted-foreground">{label}</span>
      <Cmp
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={textarea ? 2 : undefined}
        className="w-full mt-1 border border-border rounded-lg px-2.5 py-1.5 text-sm bg-card"
      />
    </label>
  );
}

const MAPS_OPTIONS = [
  { value: "", label: "No scoring" },
  { value: "timeline", label: "Feeds timeline" },
  { value: "budget", label: "Feeds budget" },
];

function StepEditor({ step, onChange, iqTrades, iqError }) {
  const isQuestion =
    step.kind === "question_single" || step.kind === "question_multi";

  function setAnswer(i, patch) {
    const answers = (step.answers || []).map((a, idx) =>
      idx === i ? { ...a, ...patch } : a,
    );
    onChange({ answers });
  }
  function addAnswer() {
    const answers = [
      ...(step.answers || []),
      {
        id: `a_${Date.now().toString(36)}`,
        label: "Option",
        value: `opt${(step.answers || []).length + 1}`,
      },
    ];
    onChange({ answers });
  }
  function removeAnswer(i) {
    onChange({ answers: (step.answers || []).filter((_, idx) => idx !== i) });
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
        {STEP_KINDS.find((k) => k.kind === step.kind)?.label}
      </div>

      {(step.kind === "intro" ||
        step.kind === "photo_upload" ||
        step.kind === "thankyou" ||
        step.kind === "instant_estimate" ||
        step.kind === "form") && (
        <Field
          label="Headline"
          value={step.headline}
          onChange={(v) => onChange({ headline: v })}
        />
      )}
      {(step.kind === "intro" ||
        step.kind === "photo_upload" ||
        step.kind === "thankyou" ||
        step.kind === "instant_estimate" ||
        step.kind === "form") && (
        <Field
          label="Subtext"
          value={step.subhead}
          onChange={(v) => onChange({ subhead: v })}
          textarea
        />
      )}

      {step.kind === "instant_estimate" && (
        <EstimateStepEditor
          step={step}
          onChange={onChange}
          iqTrades={iqTrades}
          iqError={iqError}
        />
      )}
      {isQuestion && (
        <Field
          label="Question"
          value={step.question}
          onChange={(v) => onChange({ question: v })}
        />
      )}
      {isQuestion && (
        <Field
          label="Help text (optional)"
          value={step.help}
          onChange={(v) => onChange({ help: v })}
        />
      )}

      {step.kind === "question_single" && (
        <label className="block text-xs">
          <span className="text-muted-foreground">Lead scoring</span>
          <select
            value={step.maps || ""}
            onChange={(e) => onChange({ maps: e.target.value })}
            className="w-full mt-1 border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
          >
            {MAPS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {step.maps === "budget" && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
              Answer values must be: under_1k, 1k_5k, 5k_15k, 15k_plus, unsure
            </span>
          )}
          {step.maps === "timeline" && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 block">
              Answer values must be: asap, 2_weeks, 1_3_months, exploring
            </span>
          )}
        </label>
      )}

      {isQuestion && (
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Answers</div>
          <div className="space-y-2">
            {(step.answers || []).map((a, i) => (
              <div
                key={a.id}
                className="border border-border rounded-lg p-2 space-y-1.5"
              >
                <div className="flex gap-1.5">
                  <input
                    value={a.label || ""}
                    onChange={(e) => setAnswer(i, { label: e.target.value })}
                    placeholder="Label"
                    className="flex-1 border border-border rounded px-2 py-1 text-xs bg-card"
                  />
                  <button
                    onClick={() => removeAnswer(i)}
                    className="text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <input
                  value={a.value || ""}
                  onChange={(e) => setAnswer(i, { value: e.target.value })}
                  placeholder="Stored value (e.g. asap)"
                  className="w-full border border-border rounded px-2 py-1 text-[11px] bg-card text-muted-foreground"
                />
              </div>
            ))}
          </div>
          <button
            onClick={addAnswer}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground"
          >
            <Plus size={12} /> Add answer
          </button>
        </div>
      )}

      {(step.kind === "intro" ||
        step.kind === "photo_upload" ||
        step.kind === "question_multi" ||
        step.kind === "instant_estimate" ||
        step.kind === "form") && (
        <Field
          label="Button text"
          value={step.buttonText}
          onChange={(v) => onChange({ buttonText: v })}
        />
      )}

      {step.kind === "form" && (
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">
            Fields collected
          </div>
          <div className="flex gap-2">
            {["name", "email", "phone"].map((f) => {
              const on = (step.fields || []).includes(f);
              return (
                <button
                  key={f}
                  onClick={() => {
                    const fields = on
                      ? (step.fields || []).filter((x) => x !== f)
                      : [...(step.fields || []), f];
                    onChange({ fields });
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${
                    on
                      ? "bg-inverted text-inverted-foreground border-transparent"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {f}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The instant-estimate step's editor.
 *
 * Three decisions live here: which of the company's own instant-quote services
 * this step prices, whether the number comes before or after the contact form,
 * and the size options the visitor taps. Everything it knows about the
 * company's pricing comes from the same public endpoint the homeowner-facing
 * estimator reads — labels and modes, never a rate.
 */
function EstimateStepEditor({ step, onChange, iqTrades, iqError }) {
  const fields = bandFieldsFor(step.trade);
  const choices = choiceFieldsFor(step.trade);
  const bands = Array.isArray(step.bands) ? step.bands : [];
  const selected = (iqTrades || []).find((t) => t.trade === step.trade) || null;
  const issues = estimateStepIssues(step);

  function setBand(i, patch) {
    onChange({ bands: bands.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });
  }
  function setBandValue(i, key, raw) {
    const values = { ...(bands[i]?.values || {}) };
    // Kept as the typed string is NOT an option — the sanitiser stores numbers
    // and the server multiplies by them. An empty box means zero, which
    // estimateStepIssues() then reports as an option that can't be priced.
    values[key] = raw === "" ? 0 : Number(raw);
    setBand(i, { values });
  }
  function addBand() {
    onChange({
      bands: [
        ...bands,
        { id: `b_${Date.now().toString(36)}`, label: "", values: {} },
      ],
    });
  }

  return (
    <div className="space-y-3 border-t border-border pt-3">
      {iqError && (
        <p className="text-[11px] text-muted-foreground">
          Couldn&rsquo;t check your instant-quote services just now.
        </p>
      )}

      {iqTrades && iqTrades.length === 0 && (
        <div className="text-xs bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-3 py-2 text-amber-800 dark:text-amber-200">
          You haven&rsquo;t set up a service that can be priced inside a funnel.
          Turn one on in{" "}
          <a href="/app/settings/instant-quotes" className="underline font-semibold">
            Settings → Instant quotes
          </a>
          . Roofing, lawn mowing and junk removal are priced from a satellite
          measurement, a drawn map or an item list, so they stay on your
          instant-quote page rather than a tap-through funnel.
        </div>
      )}

      <label className="block text-xs">
        <span className="text-muted-foreground">Service to price</span>
        <select
          value={step.trade || ""}
          onChange={(e) =>
            // The bands carry measurements in the OLD trade's units, so
            // switching service clears them rather than silently repricing
            // "500 sq ft" as 500 doors.
            onChange({ trade: e.target.value, bands: [], assumptions: {} })
          }
          className="w-full mt-1 border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
        >
          <option value="">Choose a service…</option>
          {(iqTrades || []).map((t) => (
            <option key={t.trade} value={t.trade}>
              {t.label}
            </option>
          ))}
          {/* A trade saved earlier and since switched off would otherwise
              vanish from the box, making the step look untouched. */}
          {step.trade && !selected && (
            <option value={step.trade}>{step.trade} (not switched on)</option>
          )}
        </select>
      </label>

      {selected?.estimateDisplay === "gated" && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          This service is set to “don&rsquo;t show a price”, so this step will
          show your callback message instead of a number. Change that in
          Settings → Instant quotes if you want a figure on screen.
        </p>
      )}
      {selected?.estimateDisplay === "after_submit" && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          This service reveals its range only after someone submits, so the price
          appears after the contact step whichever order you pick below.
        </p>
      )}

      <div>
        <div className="text-xs text-muted-foreground mb-1.5">Order</div>
        <div className="flex flex-col gap-1.5">
          {[
            {
              value: "price_first",
              title: "Price first, then their details",
              hint: "Fewer contacts, each much warmer. This is what the step is for.",
            },
            {
              value: "details_first",
              title: "Their details first, then the price",
              hint: "More contacts, colder — plenty of them only wanted the number.",
            },
          ].map((o) => {
            const on = (step.order || DEFAULT_ESTIMATE_ORDER) === o.value;
            return (
              <button
                key={o.value}
                onClick={() => onChange({ order: o.value })}
                className={`text-left rounded-lg border px-3 py-2 ${
                  on ? "border-foreground bg-accent" : "border-border"
                }`}
              >
                <div className="text-xs font-semibold text-foreground">{o.title}</div>
                <div className="text-[11px] text-muted-foreground">{o.hint}</div>
              </button>
            );
          })}
        </div>
      </div>

      {choices.length > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">
            Assume for every visitor
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {choices.map((c) => (
              <label key={c.key} className="block text-xs">
                <span className="text-muted-foreground">{c.label}</span>
                <select
                  value={step.assumptions?.[c.key] || ""}
                  onChange={(e) =>
                    onChange({
                      assumptions: { ...(step.assumptions || {}), [c.key]: e.target.value },
                    })
                  }
                  className="w-full mt-1 border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
                >
                  <option value="">Leave to the estimator&rsquo;s default</option>
                  {c.options.map((o) => (
                    <option key={o} value={o}>
                      {o.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            A funnel can&rsquo;t ask everything, so state it once here. An
            exterior job left unset is priced as interior.
          </p>
        </div>
      )}

      <Field
        label="Size question"
        value={step.sizeQuestion}
        onChange={(v) => onChange({ sizeQuestion: v })}
      />

      {step.trade && (
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">
            Size options — the visitor taps one
          </div>
          <div className="space-y-2">
            {bands.map((b, i) => (
              <div key={b.id} className="border border-border rounded-lg p-2 space-y-1.5">
                <div className="flex gap-1.5">
                  <input
                    value={b.label || ""}
                    onChange={(e) => setBand(i, { label: e.target.value })}
                    placeholder="What they see, e.g. “One room, about 200 sq ft”"
                    className="flex-1 border border-border rounded px-2 py-1 text-xs bg-card"
                  />
                  <button
                    onClick={() =>
                      onChange({ bands: bands.filter((_, idx) => idx !== i) })
                    }
                    className="text-muted-foreground hover:text-red-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {fields.map((f) => (
                    <label key={f.key} className="text-[11px] text-muted-foreground">
                      {f.label}
                      <input
                        type="number"
                        min="0"
                        value={b.values?.[f.key] ?? ""}
                        onChange={(e) => setBandValue(i, f.key, e.target.value)}
                        className="w-full border border-border rounded px-2 py-1 text-xs bg-card text-foreground"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={addBand}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-foreground"
          >
            <Plus size={12} /> Add size option
          </button>
          <p className="text-[11px] text-muted-foreground mt-1">
            The measurement never leaves this page — the visitor&rsquo;s phone
            sends which option they tapped and the price is worked out here from
            your saved rates.
          </p>
        </div>
      )}

      {issues.length > 0 && (
        <ul className="text-[11px] text-amber-600 dark:text-amber-400 list-disc ml-4 space-y-0.5">
          {issues.map((i) => (
            <li key={i.code}>{i.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// A faithful single-step preview in a phone frame, brand-accented.
function StepPreview({ step, accent, company }) {
  const on = readableForeground(accent);
  return (
    <div
      className="rounded-2xl p-4 min-h-[380px] flex items-center justify-center"
      style={{ backgroundColor: accent }}
    >
      <div className="w-full bg-white rounded-xl p-5 shadow-lg">
        {!step ? (
          <p className="text-sm text-neutral-500 text-center">
            No step selected
          </p>
        ) : step.kind === "thankyou" ? (
          <div className="text-center py-4">
            <div
              className="w-12 h-12 rounded-full grid place-items-center mx-auto mb-3"
              style={{ backgroundColor: accent, color: on }}
            >
              <Check size={22} />
            </div>
            <h3 className="font-bold text-[#2d2520]">
              {step.headline || "Thanks!"}
            </h3>
            {step.subhead && (
              <p className="text-xs text-[#2d2520]/70 mt-1">{step.subhead}</p>
            )}
          </div>
        ) : step.kind === "intro" ? (
          <div className="text-center">
            <h3 className="text-lg font-bold text-[#2d2520]">
              {step.headline}
            </h3>
            {step.subhead && (
              <p className="text-xs text-[#2d2520]/70 mt-1">{step.subhead}</p>
            )}
            <button
              className="w-full mt-4 py-2.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: accent, color: on }}
            >
              {step.buttonText || "Get started"}
            </button>
          </div>
        ) : step.kind === "form" ? (
          <div>
            <h3 className="font-bold text-[#2d2520]">
              {step.headline || "Your details"}
            </h3>
            <div className="mt-3 space-y-2">
              {(step.fields || ["name", "email", "phone"]).map((f) => (
                <div
                  key={f}
                  className="border border-black/15 rounded-lg px-3 py-2 text-xs text-neutral-400 capitalize"
                >
                  {f}
                </div>
              ))}
            </div>
            <button
              className="w-full mt-3 py-2.5 rounded-full text-sm font-bold"
              style={{ backgroundColor: accent, color: on }}
            >
              {step.buttonText || "Submit"}
            </button>
          </div>
        ) : step.kind === "instant_estimate" ? (
          <div>
            <h3 className="font-bold text-[#2d2520]">
              {step.headline || "Your instant price"}
            </h3>
            {step.subhead && (
              <p className="text-xs text-[#2d2520]/70 mt-1">{step.subhead}</p>
            )}
            {step.sizeQuestion && (
              <p className="text-xs font-semibold text-[#2d2520] mt-3">
                {step.sizeQuestion}
              </p>
            )}
            <div className="mt-2 space-y-2">
              {(step.bands || []).length === 0 ? (
                <div className="border border-dashed border-black/15 rounded-lg px-3 py-4 text-center text-xs text-neutral-400">
                  Add a size option
                </div>
              ) : (
                (step.bands || []).map((b) => (
                  <div
                    key={b.id}
                    className="border border-black/15 rounded-lg px-3 py-2 text-sm text-[#2d2520]"
                  >
                    {b.label || "Untitled option"}
                  </div>
                ))
              )}
            </div>
            {/* A stand-in, never an invented figure: the real number is
                computed on the server from this company's saved rates and the
                option the visitor taps, so there is nothing truthful to show
                here until someone taps one. */}
            <div className="mt-3 rounded-lg border border-black/10 px-3 py-4 text-center">
              <div className="text-xl font-bold" style={{ color: accent }}>
                $—— – $——
              </div>
              <div className="text-[11px] text-neutral-400 mt-1">
                {step.order === "details_first"
                  ? "Their price appears here after the contact step"
                  : "Their price appears here, before the contact step"}
              </div>
            </div>
          </div>
        ) : step.kind === "photo_upload" ? (
          <div>
            <h3 className="font-bold text-[#2d2520]">{step.headline}</h3>
            {step.subhead && (
              <p className="text-xs text-[#2d2520]/70 mt-1">{step.subhead}</p>
            )}
            <div className="mt-3 border-2 border-dashed border-black/15 rounded-lg py-6 text-center text-xs text-neutral-400">
              Tap to add photos
            </div>
          </div>
        ) : (
          <div>
            <h3 className="font-bold text-[#2d2520]">{step.question}</h3>
            {step.help && (
              <p className="text-xs text-[#2d2520]/60 mt-1">{step.help}</p>
            )}
            <div className="mt-3 space-y-2">
              {(step.answers || []).map((a) => (
                <div
                  key={a.id}
                  className="border border-black/15 rounded-lg px-3 py-2 text-sm text-[#2d2520]"
                >
                  {a.label}
                </div>
              ))}
            </div>
            {step.kind === "question_multi" && (
              <button
                className="w-full mt-3 py-2.5 rounded-full text-sm font-bold"
                style={{ backgroundColor: accent, color: on }}
              >
                {step.buttonText || "Continue"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
