// app/components/marketing/CapabilitySections.js
//
// The capability rows of a full product page: image and text alternating
// sides on desktop, image first on a phone, three check-bullets, a real
// screenshot, and a "Read how it works →" link into the help centre.
//
// Shared by /product/<slug> and /features/<slug> (from 2026-09-13, when
// /features/payments got the same treatment as the four product pages). One
// component rather than the same forty lines in two files: the alternation,
// the phone and tall frames, the 44 px link and the "(in English)" note were
// each decided once here, and a copy would have to rediscover all of them.
//
// Every string comes in resolved — this component owns no words. `sections`
// is already in the reader's language, `srcFor` already knows which capture
// language to serve, `helpFor` already knows which help language to link.
"use client";

import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";

/**
 * @param {object} p
 * @param {Array}    p.sections  [{ id, heading, body, bullets, image: { alt, width, height, phone?, tall? }, help }]
 * @param {Function} p.srcFor    (image) → public path for the reader's language
 * @param {Function} p.helpFor   (helpSlug) → { href, fallback } | null
 * @param {string}   p.readHow   "Read how it works"
 * @param {string}   p.inEnglish "in English" — printed in brackets beside a link that fell back
 */
export default function CapabilitySections({ sections, srcFor, helpFor, readHow, inEnglish }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {sections.map((s, i) => {
        const url = helpFor(s.help);
        const flip = i % 2 === 1;
        const phone = !!s.image.phone;
        const tall = !!s.image.tall;
        return (
          <section
            key={s.id}
            id={s.id}
            className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center py-10 sm:py-14 border-b border-border last:border-b-0"
          >
            <figure
              className={`${flip ? "lg:order-2" : ""} ${
                phone ? "max-w-[18rem] mx-auto" : tall ? "max-w-md mx-auto" : ""
              }`}
            >
              <div className="rounded-2xl border border-border bg-muted overflow-hidden">
                <Image
                  src={srcFor(s.image)}
                  alt={s.image.alt}
                  width={s.image.width}
                  height={s.image.height}
                  sizes={
                    phone
                      ? "18rem"
                      : tall
                        ? "(min-width: 640px) 28rem, 100vw"
                        : "(min-width: 1024px) 36rem, 100vw"
                  }
                  className="w-full h-auto"
                />
              </div>
            </figure>

            <div className={flip ? "lg:order-1" : ""}>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                {s.heading}
              </h2>
              <p className="mt-4 text-muted-foreground">{s.body}</p>
              <ul className="mt-5 space-y-2.5">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <Check size={18} className="text-emerald-600 shrink-0 mt-1" />
                    <span className="text-foreground">{b}</span>
                  </li>
                ))}
              </ul>
              {/* Absolute, to help.fieldquo.com: the help centre is its own
                  host and a relative /help/... would be rewritten there. A
                  section whose slug is not in the tree gets no link at all —
                  the check fails it by name rather than the page inventing
                  an address. */}
              {url && (
                <a
                  href={url.href}
                  className="mt-6 inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-primary hover:underline"
                >
                  {readHow}
                  {url.fallback ? (
                    <span className="font-normal text-muted-foreground"> ({inEnglish})</span>
                  ) : null}
                  <ArrowRight size={16} />
                </a>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
