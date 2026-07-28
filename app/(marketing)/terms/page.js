// app/(marketing)/terms/page.js
export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 prose prose-gray">
      <h1>Terms of Service</h1>
      <p className="text-sm text-muted-foreground">
        Last updated: {new Date().toLocaleDateString()}
      </p>
      <p>
        This is placeholder text. Real terms of service — covering subscription
        billing, acceptable use, liability, and data ownership between FieldQuo
        and subscribing companies — need to be drafted before this goes live.
        This is not a substitute for legal review.
      </p>
    </div>
  );
}
