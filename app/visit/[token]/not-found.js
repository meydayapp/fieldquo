// app/visit/[token]/not-found.js
//
// Where a homeowner lands when their appointment link is wrong or the booking
// is no longer on file.
//
// Same trade as app/q/[token]/not-found.js and app/survey/[token]/not-found.js
// made before it: the page can only return a real 404 status if there is
// somewhere good to land, otherwise fixing the status code swaps a helpful
// message for a bare framework 404. So the message lives here.
//
// No app shell, no FieldQuo branding, nothing implying the reader has an
// account. And no explanation of WHY — "cancelled", "expired" and "never
// existed" are all facts about a contractor's business, and a stranger holding
// a bad URL has no claim to any of them.
//
// English only, matching the two pages above: there is no booking here, so
// there is no client language to answer in, and guessing one from the phone's
// setting is how an English client gets a French page.

export const metadata = {
  title: "Your visit",
  robots: { index: false, follow: false },
};

export default function VisitNotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-16 bg-background">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">
          This link isn&apos;t valid
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          The appointment may have already been cancelled, or the link may have
          been replaced by a newer one. Get in touch with the company you booked
          with and they&apos;ll sort it out.
        </p>
      </div>
    </main>
  );
}
