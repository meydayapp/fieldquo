// app/components/dashboard/panels/GoogleReviewsPanel.js
//
// "Connect Google reviews" on the home page's set-up card: the Google
// Business Profile card from Settings › Reviews (app/app/settings/reviews/
// GoogleBusiness.js), rendered here unchanged around the same data the
// Reviews page loads. The step is measured on the same rows — a connected
// CompanyGoogleBusiness or an approved testimonial — so the row leaves the
// card when this panel's Connect actually connects, not when it is opened.
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import GoogleBusiness from "@/app/app/settings/reviews/GoogleBusiness";

export default function GoogleReviewsPanel({ onChanged }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/settings/reviews"));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <div className="h-40 bg-accent rounded-xl animate-pulse" aria-busy="true" />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("app.presentation.reviews.hint", "Reviews you switch on here appear under “Testimonials” on every client proposal and on your website, refreshed nightly.")}
      </p>
      <GoogleBusiness
        googleBusiness={data.googleBusiness}
        outcomeKey={null}
        onChanged={async () => {
          await load();
          onChanged?.();
        }}
      />
    </div>
  );
}
