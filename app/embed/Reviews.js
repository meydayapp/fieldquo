// app/embed/Reviews.js
//
// The company's reviews, as something they can paste into the website they
// already have.
//
// ── Renders nothing when there is nothing ──────────────────────────────────
//
// The first thing a contractor does with a snippet is paste it, and the first
// time they paste it they usually have no reviews yet. An empty bordered card
// saying "no reviews" would then sit on their homepage — put there by us,
// visible to their customers, on a page nobody at FieldQuo can see.
//
// So: no reviews, no markup at all. EmbedFrame measures zero and posts zero,
// the snippet sets the iframe to 0px, and the host page looks exactly as it did
// before. Nothing to notice, nothing to remove.
//
// ── No stars ───────────────────────────────────────────────────────────────
//
// The site builder's testimonials block draws five stars over every quote. A
// review here carries no rating — there is no column for one — so drawing five
// would be inventing the single number a homeowner reads first. The quote and
// the name are what was actually said.
//
// ── No heading, no chrome ──────────────────────────────────────────────────
//
// The host page owns its own headings, typography and section spacing. An
// embed that brings its own "What our clients say" either duplicates the
// heading they already wrote or fights it. Cards only.
//
// ── Colour ─────────────────────────────────────────────────────────────────
//
// washPair() rather than the brand hex: it measures, and it substitutes a
// neutral surface when the brand is white or near-white — which is a real
// brand colour in this database, and which would otherwise produce invisible
// cards with perfectly legible text on them.

import { documentTheme, washPair, accentIsWashedOut } from "@/lib/documents/theme";

export default function Reviews({ company, reviews }) {
  if (!reviews?.length) return null;

  const theme = documentTheme(company);
  const surface = washPair(theme);
  // The card edge. accentRule is a brand-tinted hairline and reads at ~1.6:1
  // against a white host page, where theme.border manages 1.29:1 — and the host
  // page is usually white, so this is the pairing that decides whether the
  // cards look like cards. A near-white brand tints to nothing, so that case
  // takes the neutral border instead of an invisible one.
  const edge = accentIsWashedOut(theme) ? theme.border : theme.accentRule;

  return (
    <div className="p-4 sm:p-5">
      {/* Transparent body, so the embed sits on whatever colour the host page
          uses instead of stamping a white rectangle into their layout. The
          root layout paints `bg-background` on <body>, which an iframe stretches
          to full height — scoped here rather than in an /embed layout so the
          booking and quote widgets, which do want a page of their own, are
          untouched. */}
      <style>{`body{background:transparent!important}`}</style>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review, i) => (
          <figure
            key={i}
            className="m-0 rounded-2xl p-5"
            style={{ backgroundColor: surface.bg, border: `1px solid ${edge}` }}
          >
            <blockquote
              className="m-0 text-[15px] leading-relaxed"
              style={{ color: surface.ink }}
            >
              {`“${review.quote}”`}
            </blockquote>
            {review.author && (
              <figcaption
                className="mt-4 text-[13px] font-semibold"
                style={{ color: surface.muted }}
              >
                {`— ${review.author}`}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </div>
  );
}
