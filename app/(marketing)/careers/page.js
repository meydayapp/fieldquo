// app/(marketing)/careers/page.js
//
// ══ This page shipped /about's body under /careers ════════════════════════
//
// The file was copied from about/page.js and never rewritten. A previous pass
// renamed the component and left a header saying the COPY was a product
// decision to be flagged rather than invented — correct as far as it went, and
// it left a live page whose <h1> read "About FieldQuo" and whose only
// paragraph was the About paragraph, byte for byte. A jobseeker who followed a
// "Careers" link read a company blurb and found nothing to do next, while the
// page's own metadata promised "Get in touch if you want to help build
// software for the trades" — a description the body did not keep.
//
// ══ What is invented here, and what is not ════════════════════════════════
//
// No roles, no team size, no benefits, no hiring process, no "we're growing
// fast". None of that is knowable from this repository and a careers page is
// exactly where invented specifics become a promise to a real person who
// rearranges their life around it. AGENTS.md's own remedy is the one used:
// an honest "there is nothing listed" beats a page pretending otherwise.
//
// What IS stated is true and checkable: there are no openings published
// anywhere in this codebase, and hello@fieldquo.com is the address the terms
// and privacy pages already route people to. Both are facts about the product
// as it stands, not claims about a company's plans.
//
// When real roles exist they belong in a data module beside
// app/data/industryContent.js, rendered from there, so this page cannot list a
// job that was filled six weeks ago.
//
// ══ English, like its neighbours ══════════════════════════════════════════
//
// /about, /contact, /terms, /privacy and /security are all English-only on a
// nine-language site. That is a real debt — compareCopy.js's header records the
// same one and names locale-prefixed routes as the fix — and it is not made
// smaller by translating one of the six. Reported rather than half-done.
import Link from "next/link";
import { marketingMetadata } from "@/lib/marketing/metadata";
import { SUPPORT_EMAIL } from "@/lib/supportContact";

export const metadata = marketingMetadata({
  path: "/careers",
  title: "Careers at FieldQuo",
  description:
    "FieldQuo has no roles posted right now. If you want to build software for the trades, write to us anyway.",
});

export default function CareersPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-4">
        Working at FieldQuo
      </h1>

      <p className="text-muted-foreground leading-relaxed">
        FieldQuo is built by people who run a real contracting business, out of
        the everyday friction of quoting, scheduling and getting paid. The
        product is opinionated because it was used before it was sold.
      </p>

      {/* The whole point of the page, and it says the true thing rather than
          the encouraging one. A list of zero roles rendered as an empty grid
          would be the same lie with better layout. */}
      <div className="mt-8 rounded-xl border border-border bg-card p-6">
        <h2 className="text-lg font-semibold text-foreground">
          There are no roles posted right now
        </h2>
        <p className="mt-2 text-muted-foreground leading-relaxed">
          Nothing is open, and nothing is listed here that is not open. If that
          changes, the openings will appear on this page.
        </p>
        <p className="mt-4 text-muted-foreground leading-relaxed">
          If you want to build software for the trades, write to us anyway and
          say what you would want to work on — we read it, and a good letter
          has started a conversation before a role existed.
        </p>
        <div className="mt-5 flex flex-col sm:flex-row gap-3">
          {/* 44px targets: a jobseeker reads this on a phone like everybody
              else, and these are the only two controls on the page. */}
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Working at FieldQuo")}`}
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold"
          >
            Email {SUPPORT_EMAIL}
          </a>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center min-h-[44px] px-5 rounded-lg border border-border text-foreground text-sm font-semibold"
          >
            Use the contact form
          </Link>
        </div>
      </div>

      <p className="mt-8 text-sm text-muted-foreground leading-relaxed">
        Looking for the company rather than the jobs?{" "}
        <Link href="/about" className="underline underline-offset-2">
          About FieldQuo
        </Link>
        .
      </p>
    </div>
  );
}
