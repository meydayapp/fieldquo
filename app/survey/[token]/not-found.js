// app/survey/[token]/not-found.js
//
// The page a client lands on when their survey link is wrong or has already
// expired past retrieval. Same reasoning as app/q/[token]/not-found.js: a
// real 404 status rather than a 200 that a client component explains away,
// no app shell, no FieldQuo branding, and no explanation of WHY it failed —
// a stranger holding a bad URL has no claim to which company it was.
//
// English only, matching that same precedent: there is no company on this
// page to derive a language from, so there is nothing honest to translate
// FOR — see SurveyForm.js for the case that DOES have a company and answers
// in the language the survey was sent in.

export const metadata = {
  title: "How did we do?",
  robots: { index: false, follow: false },
};

export default function SurveyNotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 py-16 bg-background">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">
          This link isn&apos;t valid
        </h1>
        <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
          It may have already been used, or the job it was about is no longer
          on file. Get in touch with the company directly if you&apos;d still
          like to share feedback.
        </p>
      </div>
    </main>
  );
}
