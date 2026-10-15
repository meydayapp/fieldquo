// app/(marketing)/about/AboutContent.js
//
// The body of /about, in the reader's language — split from page.js for the
// reason /pricing and /industries are split: metadata must stay on the
// server, and translation lives in React context.
//
// The founder block (site audit D3.3, 2026-10-15) is the owner's own draft.
// Its photo, LinkedIn and email slots read lib/marketing/founder.js and each
// renders nothing until he supplies it (LinkedIn supplied 2026-10-15).
"use client";

import Image from "next/image";
import { ExternalLink, Mail } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { FOUNDER } from "@/lib/marketing/founder";

const PARAGRAPHS = ["about.founder.p1", "about.founder.p2", "about.founder.p3", "about.founder.p4"];

export default function AboutContent() {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-4">{t("about.title")}</h1>
      <p className="text-muted-foreground leading-relaxed">{t("about.intro")}</p>

      <section id="founder" className="mt-14 scroll-mt-24 border-t border-border pt-10" aria-labelledby="founder-heading">
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {FOUNDER.photoUrl ? (
            // next/image with the file's own width and height, so the box is
            // reserved before the bytes arrive. Above the text on a phone
            // (flex-col), beside it from `sm` up.
            <Image
              src={FOUNDER.photoUrl}
              alt={t("about.founder.photoAlt", { name: FOUNDER.name })}
              width={FOUNDER.photoWidth}
              height={FOUNDER.photoHeight}
              sizes="(min-width: 640px) 12rem, 16rem"
              className="h-auto w-64 max-w-full sm:w-48 shrink-0 rounded-2xl border border-border"
            />
          ) : null}
          <div className="min-w-0">
            <h2 id="founder-heading" className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance">
              {t("about.founder.heading")}
            </h2>
            <div className="mt-5 space-y-4 text-foreground leading-relaxed">
              {PARAGRAPHS.map((key) => (
                <p key={key}>{t(key)}</p>
              ))}
            </div>
            <p className="mt-6 font-semibold text-foreground">{t("about.founder.signature", { name: FOUNDER.name })}</p>
            {FOUNDER.linkedinUrl || FOUNDER.email ? (
              <ul className="mt-4 flex flex-wrap gap-3 text-sm">
                {FOUNDER.linkedinUrl ? (
                  <li>
                    <a
                      href={FOUNDER.linkedinUrl}
                      rel="noopener noreferrer"
                      target="_blank"
                      aria-label={t("about.founder.linkedinLabel", { name: FOUNDER.name })}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card px-4 font-semibold text-foreground hover:border-foreground/40"
                    >
                      <ExternalLink size={16} aria-hidden="true" />
                      {t("about.founder.linkedin")}
                    </a>
                  </li>
                ) : null}
                {FOUNDER.email ? (
                  <li>
                    <a
                      href={`mailto:${FOUNDER.email}`}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border bg-card px-4 font-semibold text-foreground hover:border-foreground/40"
                    >
                      <Mail size={16} aria-hidden="true" />
                      {FOUNDER.email}
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
