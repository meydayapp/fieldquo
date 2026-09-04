// app/survey/[token]/SurveyForm.js
//
// GET on mount (read-only — safe for a mail client's link-scanner to
// prefetch the page itself; see app/api/survey/[token]/route.js's header for
// why the WRITE only happens on this component's own POST). Reads `?score=N`
// off the URL purely to pre-select which number is lit up — the email's five
// links each carry a different score so tapping one already feels like an
// answer, but nothing is recorded until Send is pressed.
//
// White-labelled: the company's own name, logo and brand colours, contrast
// already computed server-side by lib/documents/theme.js's documentTheme()
// (see app/api/survey/[token]/route.js's publicShape()) — the same 4.5:1
// guarantee every other client-facing document gets, not re-derived here.
// Copy renders in SatisfactionResponse.language — the language the survey was
// SENT in (AGENTS.md non-negotiable #6) — never the browser's language.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchJson } from "@/lib/fetchJson";
import { MIN_SCORE, MAX_SCORE, MAX_COMMENT, surveyCopy } from "@/lib/reviews/satisfaction";

const SCORES = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);

export default function SurveyForm({ token }) {
  const searchParams = useSearchParams();
  const urlScore = Number(searchParams.get("score"));

  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [score, setScore] = useState(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson(`/api/survey/${encodeURIComponent(token)}`)
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, error: "", data });
        // Pre-select from the emailed link, but only a valid, unanswered one —
        // an already-responded survey shows what was recorded, not a fresh
        // pick that would look editable when it isn't.
        if (!data.alreadyResponded && Number.isInteger(urlScore) && urlScore >= MIN_SCORE && urlScore <= MAX_SCORE) {
          setScore(urlScore);
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ loading: false, error: err.message, data: null });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- urlScore only needs reading once, on the load that seeds the initial selection
  }, [token]);

  const copy = useMemo(() => surveyCopy(state.data?.language), [state.data?.language]);
  const theme = state.data?.theme;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!Number.isInteger(score) || score < MIN_SCORE || score > MAX_SCORE) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const result = await fetchJson(`/api/survey/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, comment }),
      });
      setState((s) => ({ ...s, data: result }));
      setJustSubmitted(true);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        background: theme?.page || "#f6f4f0",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: theme?.paper || "#ffffff",
          border: `1px solid ${theme?.border || "#e4e2dd"}`,
          borderRadius: 12,
          padding: "32px 28px",
          textAlign: "center",
        }}
      >
        {state.loading && (
          <p style={{ fontSize: 14, color: "#6b7280" }}>…</p>
        )}

        {!state.loading && state.error && (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
              {copy.invalidLink}
            </h1>
            <p style={{ fontSize: 14, color: theme?.inkMuted || "#6b7280", lineHeight: 1.5 }}>
              {copy.invalidLinkBody}
            </p>
          </>
        )}

        {!state.loading && !state.error && state.data && (
          <>
            {state.data.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- a stranger's browser, no session, no Next image optimisation pipeline needed for one small logo
              <img
                src={state.data.logoUrl}
                alt={state.data.companyName}
                style={{ maxHeight: 40, maxWidth: 180, display: "block", margin: "0 auto 20px" }}
              />
            ) : (
              <div style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px", color: theme?.ink || "#111827" }}>
                {state.data.companyName}
              </div>
            )}

            {state.data.alreadyResponded || justSubmitted ? (
              <>
                <p style={{ fontSize: 15, color: theme?.ink || "#111827", margin: "0 0 4px" }}>
                  {copy.thanks}
                </p>
                {state.data.alreadyResponded && !justSubmitted && (
                  <p style={{ fontSize: 13, color: theme?.inkMuted || "#6b7280", marginTop: 8 }}>
                    {copy.alreadyAnswered}
                  </p>
                )}
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <p style={{ fontSize: 15, fontWeight: 600, color: theme?.ink || "#111827", margin: "0 0 16px" }}>
                  {copy.prompt}
                </p>

                <div
                  role="radiogroup"
                  aria-label={copy.prompt}
                  style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 8 }}
                >
                  {SCORES.map((n) => {
                    const selected = score === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setScore(n)}
                        style={{
                          // 44, not 42. This is a five-target row that is only
                          // ever tapped with a thumb, from an email, one-handed
                          // — the one place in the product where two pixels
                          // decide whether the answer recorded is the answer
                          // meant.
                          width: 44,
                          height: 44,
                          borderRadius: 8,
                          border: `2px solid ${selected ? theme?.selectedBg || "#06356b" : theme?.border || "#e4e2dd"}`,
                          background: selected ? theme?.selectedBg || "#06356b" : "#ffffff",
                          color: selected ? theme?.selectedFg || "#ffffff" : theme?.ink || "#111827",
                          fontSize: 16,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
                <p style={{ fontSize: 12, color: theme?.inkMuted || "#6b7280", margin: "0 0 20px" }}>
                  {copy.scale}
                </p>

                <label
                  htmlFor="survey-comment"
                  style={{
                    display: "block",
                    textAlign: "left",
                    fontSize: 13,
                    color: theme?.ink || "#111827",
                    marginBottom: 6,
                  }}
                >
                  {copy.commentLabel}
                </label>
                <textarea
                  id="survey-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
                  placeholder={copy.commentPlaceholder}
                  rows={3}
                  maxLength={MAX_COMMENT}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: `1px solid ${theme?.border || "#e4e2dd"}`,
                    borderRadius: 8,
                    padding: "10px 12px",
                    fontSize: 14,
                    fontFamily: "inherit",
                    resize: "vertical",
                    marginBottom: 16,
                  }}
                />

                {submitError && (
                  <p style={{ fontSize: 13, color: "#b91c1c", margin: "0 0 12px" }}>{submitError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting || !Number.isInteger(score)}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: 8,
                    padding: "13px 26px",
                    fontSize: 15,
                    fontWeight: 600,
                    background: theme?.selectedBg || "#06356b",
                    color: theme?.selectedFg || "#ffffff",
                    cursor: submitting || !Number.isInteger(score) ? "default" : "pointer",
                    opacity: submitting || !Number.isInteger(score) ? 0.6 : 1,
                  }}
                >
                  {copy.send}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
