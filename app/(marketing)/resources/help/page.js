// app/(marketing)/resources/help/page.js
//
// ── The one page on the site that had nothing on it ─────────────────────────
//
// This was a heading, an apology and a link to /contact. "Coming soon" is
// honest — AGENTS.md says so explicitly — but it is only the right answer when
// there is genuinely nothing to give, and there was something: the glossary.
//
// ── Why the glossary is linked from HERE and not from the footer ────────────
//
// app/(marketing)/glossary/[slug]/page.js names three honest places to link it
// and warns that all three cost translation work, because the footer's
// Resources column and ResourcesContent's cards both render LABELS FROM THE
// CATALOGUE — a link in either needs footer.links.glossary in every language
// or check:translations goes red, and one English label among eight translated
// ones is the half-translated failure that file is trying to avoid.
//
// This page has no such constraint: it is a server component with no
// useTranslation, English throughout, exactly like the glossary it points at.
// So the glossary gets its first inbound link — it had none, and a hundred
// pages nothing points at is a hundred pages that exist only if somebody
// guesses the URL — without minting a key or half-translating a shared
// surface. The footer link is still the right long-term answer and still needs
// the lead to land footer.links.glossary; this does not replace it.
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TRADE_GLOSSARY } from "@/app/data/tradeGlossary";
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  path: "/resources/help",
  title: "Help Center — FieldQuo",
  description:
    "Setup guides and how-tos for getting your company running on FieldQuo.",
});

export default function HelpCenterPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-4">Help Center</h1>
      <p className="text-muted-foreground">
        Setup guides and detailed how-tos are still being written. Until they
        are here, the fastest way to get an answer is to ask us —{" "}
        <Link href="/contact" className="underline text-foreground">
          send a message
        </Link>{" "}
        and a person replies.
      </p>

      <div className="mt-10 rounded-2xl border border-border p-6">
        <h2 className="text-lg font-semibold text-foreground">
          The contractor glossary
        </h2>
        <p className="mt-2 text-muted-foreground">
          {/* Counted, not typed. A sentence claiming a number about a list is
              a sentence that goes wrong the first time the list changes. */}
          Plain-English definitions of the {TRADE_GLOSSARY.length} terms that
          turn up on quotes, contracts and lien notices — markup against
          margin, takeoffs, retainage, holdbacks, progress billing. Where the
          answer depends on the province or state you work in, it says so
          rather than picking one.
        </p>
        <Link
          href="/glossary"
          className="mt-4 inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-foreground underline"
        >
          Read the glossary <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
