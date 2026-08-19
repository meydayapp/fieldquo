// app/(marketing)/careers/page.js
//
// The header said about/page.js and the component was called AboutPage — this
// file is a copy of it that was never renamed, and the page still shows About
// copy under /careers. Renamed here; the COPY is a product decision and is
// flagged rather than invented.
import { marketingMetadata } from "@/lib/marketing/metadata";

export const metadata = marketingMetadata({
  path: "/careers",
  title: "Careers at FieldQuo",
  description:
    "FieldQuo is built by people who run a real contracting business. Get in touch if you want to help build software for the trades.",
});

export default function CareersPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold text-foreground mb-4">About FieldQuo</h1>
      <p className="text-muted-foreground leading-relaxed">
        FieldQuo was built by people who run a real contracting business, out of
        the everyday friction of quoting, scheduling, and getting paid. We built
        the tool we wished we had — and now we're building it for every trade,
        not just our own.
      </p>
    </div>
  );
}
