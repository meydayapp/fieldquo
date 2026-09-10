// scripts/fixtures/contractorSite.mjs
//
// A realistic small contractor's website, as HTML, for measuring what a crawl
// WRITES. Six pages, one navigation repeated in the header, the footer and a
// mobile drawer — which is the shape that turned 26 links on a page into six
// evidence rows apiece — plus the analytics, chat and booking third parties a
// real site carries.
//
// Shared with scripts/check-crawl-storage.mjs so the numbers in the report and
// the bounds the check asserts are measured on the SAME pages.

const NAV = [
  ["/", "Home"],
  ["/services", "Services"],
  ["/services/interior-painting", "Interior Painting"],
  ["/services/exterior-painting", "Exterior Painting"],
  ["/services/cabinet-refinishing", "Cabinet Refinishing"],
  ["/services/deck-staining", "Deck Staining"],
  ["/gallery", "Gallery"],
  ["/about", "About Us"],
  ["/reviews", "Reviews"],
  ["/blog", "Blog"],
  ["/contact", "Contact"],
  ["/request-a-quote", "Get a Free Quote"],
  ["/book-online", "Book Online"],
];

const FOOTER = [
  ["/privacy", "Privacy Policy"],
  ["/terms", "Terms"],
  ["/sitemap", "Sitemap"],
  ["/service-areas/ottawa", "Ottawa"],
  ["/service-areas/kanata", "Kanata"],
  ["/service-areas/orleans", "Orleans"],
  ["/service-areas/barrhaven", "Barrhaven"],
  ["https://www.facebook.com/acmepainting", "Facebook"],
  ["https://www.instagram.com/acmepainting", "Instagram"],
  ["https://g.page/acme-painting-ottawa", "Google Reviews"],
];

function navBlock(id) {
  return NAV.map(
    ([href, text]) =>
      `<li class="menu-item" data-menu-id="${id}"><a href="${href}" data-nav="${id}">${text}</a></li>`,
  ).join("");
}

function footerBlock() {
  return FOOTER.map(([href, text]) => `<a href="${href}" rel="noopener">${text}</a>`).join(" · ");
}

/** The chrome every page carries: metas, scripts, three copies of the nav. */
function chrome(title, description) {
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${description}">
<meta name="generator" content="WordPress 6.4.2">
<meta property="og:site_name" content="Acme Painting">
<meta property="og:type" content="website">
<meta property="og:image" content="https://acmepainting.ca/wp-content/uploads/logo.png">
<meta property="og:locale" content="en_CA">
<meta name="robots" content="index, follow">
<meta name="theme-color" content="#1f6f43">
<title>${title}</title>
<script src="https://acmepainting.ca/wp-includes/js/jquery/jquery.min.js?ver=3.7.1"></script>
<script src="https://acmepainting.ca/wp-content/plugins/elementor/assets/js/frontend.min.js?ver=3.18"></script>
<script src="https://www.googletagmanager.com/gtag/js?id=G-ABC123"></script>
<script src="https://embed.tawk.to/5f0a/default"></script>
<script src="https://assets.calendly.com/assets/external/widget.js"></script>
<script src="https://js.stripe.com/v3/"></script>
</head>
<body data-elementor-device-mode="desktop" data-page-id="42" data-theme="acme-child">
<header data-region="header"><nav data-elementor-type="header"><ul>${navBlock("header")}</ul></nav>
<a href="tel:+16135550142" class="cta">(613) 555-0142</a>
<a href="mailto:hello@acmepainting.ca">hello@acmepainting.ca</a></header>
<div class="mobile-drawer" data-region="drawer"><ul>${navBlock("drawer")}</ul></div>`;
}

function tail(extra = "") {
  return `${extra}
<footer data-region="footer"><nav><ul>${navBlock("footer")}</ul></nav>
<p>${footerBlock()}</p>
<p>Acme Painting · 12 Bank St, Ottawa ON · <a href="tel:+16135550142">(613) 555-0142</a></p></footer>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"HousePainter","name":"Acme Painting","telephone":"+1-613-555-0142"}</script>
</body></html>`;
}

const PROSE = (what) =>
  `<p>Acme Painting has been ${what} for homeowners across Ottawa since 2004. Our painters are ` +
  `fully insured, and every estimate is free. We handle interior painting, exterior painting, ` +
  `cabinet refinishing and deck staining, and we leave your home cleaner than we found it.</p>`;

/** Six pages: the shape MAX_PAGES_PER_RUN actually crawls. */
export function contractorPages() {
  return [
    {
      url: "https://acmepainting.ca/",
      html:
        chrome("Acme Painting — Ottawa House Painters", "Ottawa house painters. Free estimates.") +
        `<main>${PROSE("painting homes")}
<a href="/request-a-quote" class="btn">Get a Free Quote</a>
<a href="https://calendly.com/acme-painting/estimate">Book your estimate online</a>
<iframe src="https://www.google.com/maps/embed?pb=!1m18"></iframe>
<form action="/wp-admin/admin-ajax.php" method="post" id="quote-form" class="wpforms-form">
<input name="your-name" type="text" required><input name="your-email" type="email" required>
<input name="your-phone" type="tel"><textarea name="message"></textarea>
<button type="submit">Send my request</button></form></main>` +
        tail(),
    },
    {
      url: "https://acmepainting.ca/services",
      html:
        chrome("Painting Services — Acme Painting", "Interior and exterior painting services.") +
        `<main>${PROSE("delivering painting services")}
<a href="/services/interior-painting">Interior Painting</a>
<a href="/services/exterior-painting">Exterior Painting</a>
<a href="/services/cabinet-refinishing">Cabinet Refinishing</a>
<a href="/services/deck-staining">Deck Staining</a>
<a href="/services/drywall-repair">Drywall Repair</a>
<a href="/services/wallpaper-removal">Wallpaper Removal</a></main>` +
        tail(),
    },
    {
      url: "https://acmepainting.ca/contact",
      html:
        chrome("Contact Acme Painting", "Call or email Acme Painting in Ottawa.") +
        `<main>${PROSE("answering the phone")}
<form action="https://acmepainting.ca/contact" method="post" id="contact-form">
<input name="name" type="text"><input name="email" type="email"><textarea name="details"></textarea>
<button type="submit">Send message</button></form>
<a href="mailto:hello@acmepainting.ca">hello@acmepainting.ca</a>
<a href="tel:+16135550142">(613) 555-0142</a></main>` +
        tail(),
    },
    {
      url: "https://acmepainting.ca/about",
      html: chrome("About Acme Painting", "Family run since 2004.") + `<main>${PROSE("a family business")}</main>` + tail(),
    },
    {
      url: "https://acmepainting.ca/gallery",
      html:
        chrome("Gallery — Acme Painting", "Recent painting projects in Ottawa.") +
        `<main>${PROSE("photographing our work")}` +
        Array.from({ length: 24 }, (_, i) => `<a href="/gallery/project-${i + 1}">Project ${i + 1}</a>`).join("") +
        `</main>` +
        tail(),
    },
    {
      url: "https://acmepainting.ca/blog",
      html:
        chrome("Blog — Acme Painting", "Painting advice from Ottawa painters.") +
        `<main>${PROSE("writing about paint")}` +
        Array.from(
          { length: 18 },
          (_, i) => `<a href="/blog/2024/05/${i + 1}/how-to-choose-a-paint-finish-${i + 1}">How to choose a paint finish ${i + 1}</a>`,
        ).join("") +
        `</main>` +
        tail(),
    },
  ];
}

/**
 * A page with 500 links, which is the pathological case the cap exists for.
 *
 * The three off-host links sit ABOVE the flood deliberately. html.js stops
 * extracting at CAPS.links (200), so anything below the five hundredth anchor
 * never reaches the writer at all — a real limitation, and not the one the
 * per-crawl cap is being measured on here.
 */
export function hugeLinkPage() {
  return {
    url: "https://acmepainting.ca/sitemap",
    html:
      chrome("Sitemap — Acme Painting", "Every page.") +
      `<main>
<a href="https://www.facebook.com/acmepainting">Facebook</a>
<a href="https://www.instagram.com/acmepainting">Instagram</a>
<a href="https://g.page/acme-painting-ottawa">Google Reviews</a>` +
      Array.from({ length: 500 }, (_, i) => `<a href="/page-${i}">Page ${i}</a>`).join("") +
      `</main>` +
      tail(),
  };
}

/**
 * The page the vendors are on.
 *
 * Without it a "the same technologies were found" comparison compares two
 * empty lists. Every signal here is one a seeded TechnologySignature matches,
 * and `data-orgname` is deliberately among them: it is a Housecall Pro
 * fingerprint that reaches the matcher ONLY as a dom_attr row, so it is the
 * type whose survival the storage change has to prove.
 */
export function vendorPage() {
  return {
    url: "https://acmepainting.ca/book-online",
    html: `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="generator" content="WordPress 6.4.2">
<meta name="description" content="Book your painting estimate online.">
<title>Book Online — Acme Painting</title>
<script src="https://d3ey4dbjkt2f6s.cloudfront.net/assets/external/work_request_embed.js"></script>
<script src="https://online-booking.housecallpro.com/script.js"></script>
<script src="https://assets.calendly.com/assets/external/widget.js"></script>
<script src="https://embed.tawk.to/5f0a/default"></script>
<script src="https://js.stripe.com/v3/"></script>
</head><body>
<button class="hcp-button" data-orgname="acme-painting" data-token="abc">Book Now</button>
<iframe src="https://clienthub.getjobber.com/client_hubs/abc/public/work_request/embedded_work_request_form"></iframe>
<a href="https://calendly.com/acme-painting/estimate">Book your estimate</a>
<a href="/request-a-quote">Request a quote</a>
<a href="tel:+16135550142">Call us</a>
<a href="mailto:hello@acmepainting.ca">Email us</a>
<p>Acme Painting are Ottawa house painters. Interior painting and cabinet refinishing.</p>
<form action="/request" method="post" id="quote"><input name="name" type="text">
<input name="email" type="email"><textarea name="message"></textarea>
<button type="submit">Send</button></form>
</body></html>`,
  };
}

/**
 * A JavaScript-rendered site fetched by a crawler that does not run
 * JavaScript: a body, no anchors. looksRendered() must keep calling this a
 * shell, or every absence claim about it is a false one.
 */
export function javascriptShellPage() {
  return {
    url: "https://spa-painting.example/",
    html:
      `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<title>Painting</title><script src="https://spa-painting.example/app.bundle.js"></script></head>` +
      `<body><div id="root"></div><noscript>${"This site needs JavaScript. ".repeat(40)}</noscript></body></html>`,
  };
}
