// app/app/settings/presentation/page.js
//
// Settings › Presentation — what a homeowner reads BESIDE the quote when
// they open the link: the company story, the one before/after gallery, the
// document library (insurance, licence, warranty, waivers), and which of
// those sections a new quote starts with. Set up once, loaded on every
// quote; a quote's own Presentation panel can switch a section off for that
// quote alone.
//
// Not a sidebar row: reached from Settings › Quote Email, from a quote's
// Presentation panel and from the home page's set-up steps (each of which
// opens the SAME editors below in a dialog — stepPanels.js). The anchors
// (#story, #gallery, #documents, #sections) are what those links land on.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import BackToHome from "@/app/components/BackToHome";
import StoryEditor from "@/app/components/settings/StoryEditor";
import GalleryEditor from "@/app/components/settings/GalleryEditor";
import CompanyDocumentsEditor from "@/app/components/settings/CompanyDocumentsEditor";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { PROPOSAL_SECTION_KEYS, PROPOSAL_SECTIONS } from "@/lib/proposal/sections";

function Card({ id, title, description, children }) {
  return (
    <div id={id} className="bg-card border border-border rounded-xl p-5 space-y-4 scroll-mt-6">
      <div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export default function PresentationSettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6 max-w-3xl">
      <BackToHome />
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("app.presentation.title", "Client proposal")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.presentation.subtitle", "What a client reads beside the quote when they open the link — your story, your work, your documents and your reviews. Set it up once; every quote carries it.")}
        </p>
      </div>

      <Card id="story" title={t("app.setup.step.story", "Add your company story")} description={t("app.presentation.story.cardHint", "The “About us” section.")}>
        <StoryEditor />
      </Card>

      <Card id="gallery" title={t("app.setup.step.gallery", "Upload before & after photos")} description={t("app.presentation.gallery.cardHint", "The “Before & after” section — one gallery, shared with your website and quote emails.")}>
        <GalleryEditor />
      </Card>

      <Card id="documents" title={t("app.setup.step.documents", "Upload your insurance, licence and documents")} description={t("app.presentation.documents.cardHint", "The “Important documents” section, and the waivers a client can be asked to sign.")}>
        <CompanyDocumentsEditor />
      </Card>

      <Card id="sections" title={t("app.presentation.sections.title", "Sections on a new quote")} description={t("app.presentation.sections.hint", "Which sections a new quote starts with. A section with nothing behind it is never shown, whatever the switch says; a quote's own Presentation panel can switch one off for that quote only.")}>
        <SectionDefaults t={t} />
      </Card>

      <p className="text-sm text-muted-foreground">
        {t("app.presentation.reviewsNote", "Testimonials come from Settings › Reviews — Google reviews you switch on, and approved testimonials.")}{" "}
        <Link href="/app/settings/reviews#google-business" className="underline underline-offset-2 text-foreground">
          {t("app.setup.step.google_reviews", "Connect Google reviews")}
        </Link>
      </p>
    </div>
  );
}

function SectionDefaults({ t }) {
  const access = useSettingsAccess();
  const canEdit = access.canChange("user:manage");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    fetchJson("/api/settings/presentation").then(setData).catch((err) => setError(err.message));
  }, []);

  async function flip(key, on) {
    setBusy(key);
    setError("");
    try {
      setData(await fetchJson("/api/settings/presentation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections: { [key]: on } }),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  if (error && !data) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <div className="h-24 bg-accent rounded-xl animate-pulse" aria-busy="true" />;

  return (
    <div className="divide-y divide-border">
      {PROPOSAL_SECTION_KEYS.map((key) => {
        const row = data.sections.find((s) => s.key === key) || { on: true, hasContent: false };
        return (
          <div key={key} className="flex items-center gap-3 py-2.5 text-sm">
            <input
              type="checkbox"
              checked={row.on}
              disabled={!canEdit || busy === key}
              onChange={(e) => flip(key, e.target.checked)}
              className="w-4 h-4 accent-current"
              aria-label={t(PROPOSAL_SECTIONS[key].labelKey, key)}
            />
            <span className={`flex-1 ${row.hasContent ? "text-foreground" : "text-muted-foreground"}`}>
              {t(PROPOSAL_SECTIONS[key].labelKey, key)}
              {!row.hasContent && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {t("app.presentation.sections.noContent", "— nothing behind it yet, so it won't show")}
                </span>
              )}
            </span>
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600 pt-2">{error}</p>}
    </div>
  );
}
