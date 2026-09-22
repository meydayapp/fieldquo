// app/q/[token]/not-found.js
//
// The page a homeowner lands on when their quote link is wrong, expired, or
// has been replaced.
//
// It exists so that /q/<unknown> can return a real 404 status without the
// visitor paying for that correctness. The page used to render 200 for every
// token and let the client component draw this message; the words were right
// and the status code was a lie. Fixing the status by falling through to a
// generic 404 would have swapped a good message for a correct number, so the
// message moved here.
//
// Same rules as the document it replaces: no app shell, no FieldQuo branding,
// nothing suggesting the reader has an account anywhere. They hired a
// contractor, not us. And no explanation of WHY the link failed — "expired",
// "revoked" and "never existed" are all information about the contractor's
// business that a stranger holding a bad URL has no claim to.

export const metadata = {
  title: "Your quote",
  robots: { index: false, follow: false },
};

export default function QuoteNotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-16 bg-background">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">
          This link isn&apos;t valid
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          It may have been replaced by a newer version, or the quote may have
          been withdrawn. Get in touch with the company that sent it and ask
          them for a fresh link.
        </p>
      </div>
    </main>
  );
}
