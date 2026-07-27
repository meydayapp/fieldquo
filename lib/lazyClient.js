// lib/lazyClient.js
//
// Defers construction of an SDK client until something actually uses it.
//
// The problem this solves: SDK constructors like `new Resend(key)` and
// `new Stripe(key)` throw immediately when the key is missing. Written at
// module scope, they run the moment the module is imported — including
// during `next build`, when Next imports every route to collect page data.
// That turns a missing runtime secret into a hard BUILD failure with a
// stack trace pointing at bundler internals rather than your code:
//
//   Error: Missing API key. Pass it to the constructor `new Resend("re_123")`
//   Failed to collect page data for /api/cron/large-quote-check
//
// A build shouldn't need runtime secrets. Wrapping the client here means the
// constructor runs on first property access — i.e. when a request actually
// handles something — so builds stay clean and a genuinely missing key
// surfaces at runtime where it's actionable.
//
// Usage:
//   const resend = lazyClient(() => new Resend(process.env.RESEND_API_KEY));
//   // ...later, inside a handler:
//   await resend.emails.send({ ... });

export function lazyClient(create) {
  let instance;

  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (!instance) instance = create();
        const value = instance[prop];
        // Bind methods so `this` still refers to the real client — otherwise
        // destructured calls like `const { emails } = resend` break.
        return typeof value === "function" ? value.bind(instance) : value;
      },
      has(_target, prop) {
        if (!instance) instance = create();
        return prop in instance;
      },
    },
  );
}
