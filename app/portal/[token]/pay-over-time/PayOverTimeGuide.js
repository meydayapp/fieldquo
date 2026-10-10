// app/portal/[token]/pay-over-time/PayOverTimeGuide.js
//
// The client's "How to pay over time" guide — presentation only. The page
// beside this file reads the token, decides which providers to name and
// passes in finished sentences (lib/i18n/payOverTimeGuideCopy.js) and a
// measured palette (lib/payments/payOverTimeGuide.js guidePalette); this
// file draws them. No hooks, no fetch, no state: it renders on the server
// for a stranger on a slow phone, and scripts/check-pay-over-time-guide.mjs
// renders it in all eight languages with react-dom/server.
//
// ── The illustration is a MOCK, on purpose ────────────────────────────────
//
// Two little screens built from boxes: the invoice's buttons, then the
// payment page's choices. No amount, no invoice number, no client name — a
// screenshot of a real invoice would carry somebody's data, and a figure in
// the drawing would read as a quote. The provider is printed as a NAME in the
// company's own ink: Klarna's rules on Stripe forbid "any design that's
// confusingly similar to Klarna's trademarks"
// (https://docs.stripe.com/payments/klarna/compliance), so no logo, no
// provider pink. And nothing in it is a control — it is one image to a
// screen reader (role="img" with a sentence), never a button that looks
// tappable and does nothing.
//
// Large type throughout (the owner's case is an elderly client who could
// not find the option): the steps are 18–20px, the title 30–36px.

const Bubble = ({ n, pair, size = 40 }) => (
  <span
    aria-hidden="true"
    className="inline-flex shrink-0 items-center justify-center rounded-full font-bold"
    style={{ width: size, height: size, backgroundColor: pair.bg, color: pair.fg, fontSize: size >= 40 ? 18 : 13 }}
  >
    {n}
  </span>
);

const Bar = ({ w, color }) => <span className="block h-2.5 rounded-full" style={{ width: w, backgroundColor: color }} />;

function MockInvoice({ copy, pal }) {
  return (
    <div className="relative rounded-xl p-4 shadow-sm" style={{ backgroundColor: pal.mockCard }}>
      <div className="absolute -top-3 -left-3">
        <Bubble n={1} pair={pal.bubble} size={30} />
      </div>
      <div className="h-1 rounded-full mb-3" style={{ backgroundColor: pal.rule }} />
      <p className="text-sm font-semibold" style={{ color: pal.mockInk }}>{copy.mock.invoice}</p>
      <div className="mt-2 space-y-1.5">
        <Bar w="70%" color={pal.placeholder} />
        <Bar w="45%" color={pal.placeholder} />
      </div>
      <div
        className="mt-4 rounded-full py-2 text-center text-sm font-bold"
        style={{ backgroundColor: pal.mockFill.bg, color: pal.mockFill.fg }}
      >
        {copy.mock.pay}
      </div>
      <div
        data-mock-over-time
        className="mt-2 rounded-full border-2 py-2 px-3 text-center text-sm font-bold"
        style={{ borderColor: pal.mockOutline.border, color: pal.mockOutline.fg }}
      >
        {copy.button}
      </div>
    </div>
  );
}

function MockPaymentPage({ copy, names, pal }) {
  const rows = [copy.mock.card, ...names];
  return (
    <div className="relative rounded-xl p-4 shadow-sm" style={{ backgroundColor: pal.mockCard }}>
      <div className="absolute -top-3 -left-3">
        <Bubble n={2} pair={pal.bubble} size={30} />
      </div>
      <p className="text-sm font-semibold" style={{ color: pal.mockInk }}>{copy.mock.paymentPage}</p>
      <p className="mt-2 text-xs" style={{ color: pal.mockMuted }}>{copy.mock.method}</p>
      <ul className="mt-1.5 space-y-1.5">
        {rows.map((label, i) => {
          // The first provider is drawn chosen — step 2's picture.
          const chosen = i === 1;
          return (
            <li
              key={label}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              style={{
                border: `${chosen ? 2 : 1}px solid ${chosen ? pal.selected : pal.placeholder}`,
                color: pal.mockInk,
                fontWeight: chosen ? 700 : 500,
              }}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full"
                style={{
                  border: `2px solid ${chosen ? pal.selected : pal.mockMuted}`,
                  backgroundColor: chosen ? pal.selected : "transparent",
                }}
              />
              {label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * @param copy       payOverTimeGuideCopy(language, { names, company })
 * @param pal        guidePalette(company)
 * @param company    { name, logoUrl }
 * @param names      provider brand names offered — [] renders the "not
 *                   offered right now" state instead of the steps
 * @param backHref   the invoice the guide was opened from, else the portal
 * @param backLabel  "Back to your invoice" / "Back to your account"
 */
export default function PayOverTimeGuide({ copy, pal, company, names, backHref, backLabel }) {
  const offered = Array.isArray(names) && names.length > 0;
  return (
    <div className="min-h-dvh py-8 sm:py-14 px-4" style={{ backgroundColor: pal.pageBg }}>
      <div className="max-w-2xl mx-auto" lang={copy.language}>
        <a
          href={backHref}
          className="inline-flex items-center gap-1.5 text-base font-medium mb-5 underline-offset-4 hover:underline"
          style={{ color: pal.link }}
        >
          <span aria-hidden="true">←</span> {backLabel}
        </a>

        <article
          data-pay-over-time-guide={offered ? names.join(",") : "none"}
          className="rounded-2xl overflow-hidden shadow-sm border border-black/10"
          style={{ backgroundColor: pal.paper }}
        >
          <div style={{ height: 6, backgroundColor: pal.rule }} />

          <header className="px-6 sm:px-10 pt-8 pb-6">
            {company.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={company.logoUrl} alt={company.name} className="h-11 w-auto max-w-[180px] object-contain mb-5" />
            ) : (
              <p className="text-base font-semibold mb-4" style={{ color: pal.ink }}>{company.name}</p>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold leading-tight" style={{ color: pal.ink }}>
              {copy.title}
            </h1>
            <p className="mt-3 text-lg sm:text-xl leading-relaxed" style={{ color: pal.muted }}>
              {offered ? copy.intro : copy.unavailable}
            </p>
          </header>

          {offered && (
            <>
              <figure
                role="img"
                aria-label={copy.alt}
                className="mx-6 sm:mx-10 rounded-2xl p-6 grid gap-6 sm:grid-cols-2"
                style={{ backgroundColor: pal.wash.bg }}
              >
                <div aria-hidden="true">
                  <MockInvoice copy={copy} pal={pal} />
                </div>
                <div aria-hidden="true">
                  <MockPaymentPage copy={copy} names={names} pal={pal} />
                </div>
              </figure>

              <ol className="px-6 sm:px-10 py-8 space-y-7">
                {copy.steps.map((s, i) => (
                  <li key={i} data-guide-step={i + 1} className="flex gap-4">
                    <Bubble n={i + 1} pair={pal.bubble} />
                    <div className="min-w-0">
                      <h2 className="text-xl sm:text-2xl font-semibold leading-snug" style={{ color: pal.ink }}>
                        {s.title}
                      </h2>
                      <p className="mt-1.5 text-lg leading-relaxed" style={{ color: pal.muted }}>
                        {s.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </article>
      </div>
    </div>
  );
}
