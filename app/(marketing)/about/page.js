// app/(marketing)/about/page.js
export default function AboutPage() {
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
