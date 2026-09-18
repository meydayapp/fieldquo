// app/estimate-report/[token]/not-found.js
//
// The page a homeowner lands on when their report link is wrong or the
// document behind it is not an instant estimate. Same rules as /q's
// not-found: no app shell, no FieldQuo branding, and no explanation of WHY
// — "never existed" and "withdrawn" are both information about the
// contractor's business that a stranger holding a bad URL has no claim to.

export const metadata = {
  title: "Your estimate",
  robots: { index: false, follow: false },
};

export default function EstimateReportNotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-16 bg-background">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">This link isn&apos;t valid</h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          It may have been replaced by a newer version. Get in touch with the
          company that sent it and ask them for a fresh link.
        </p>
      </div>
    </main>
  );
}
