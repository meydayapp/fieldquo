// scripts/fixtures/planPdf.mjs
//
// A real PDF, written byte by byte, for scripts/check-plan-deep-read.mjs.
//
// Generated rather than committed: a binary fixture is a file nobody can
// review in a diff, and the point of this one is that the TEXT on each sheet
// is exactly what the check asserts against. Each page is a list of
// { text, x, y, size } drawn in Helvetica with real PDF text operators — the
// same vector text a CAD export carries — so unpdf/pdf.js reads it back the
// way it reads an architect's set. A page with `scanned: true` carries only
// line work (a rectangle), which is what a scanned sheet looks like to a
// text extractor.

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

/**
 * @param {{ width?: number, height?: number, scanned?: boolean,
 *           texts?: { text: string, x: number, y: number, size?: number }[] }[]} pages
 * @returns {Uint8Array}
 */
export function buildPlanPdf(pages, { encrypt = false } = {}) {
  const objects = [];
  const add = (body) => {
    objects.push(body);
    return objects.length;
  };
  const catalogId = add(null);
  const pagesId = add(null);
  const fontId = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const pageIds = [];
  for (const p of pages) {
    const w = p.width || 2592; // 36 in
    const h = p.height || 1728; // 24 in
    let content = "0.2 w 36 36 m " + (w - 36) + " 36 l " + (w - 36) + " " + (h - 36) + " l 36 " + (h - 36) + " l h S\n";
    if (p.scanned) {
      content += "100 100 400 300 re S\n";
    } else {
      for (const t of p.texts || []) {
        content += `BT /F1 ${t.size || 10} Tf ${t.x} ${t.y} Td (${esc(t.text)}) Tj ET\n`;
      }
    }
    const streamId = add(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`);
    pageIds.push(
      add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${streamId} 0 R >>`,
      ),
    );
  }
  // `encrypt`: a Standard-security dictionary whose /U does not match the
  // empty password, so a reader must ask for one — the "password-protected
  // manual" a contractor uploads (scripts/check-reference-library.mjs).
  const encryptId = encrypt
    ? add(`<< /Filter /Standard /V 1 /R 2 /O <${"a1".repeat(32)}> /U <${"b2".repeat(32)}> /P -4 >>`)
    : null;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let out = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, "0")} 00000 n \n`;
  const encryptRef = encryptId ? ` /Encrypt ${encryptId} 0 R /ID [<${"c3".repeat(16)}> <${"c3".repeat(16)}>]` : "";
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R${encryptRef} >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

/** The church set the check reads: an imperial elevation, a metric plan
 *  with odd formats, and a scanned sheet. */
export function churchSet() {
  return buildPlanPdf([
    {
      texts: [
        { text: "NORTH ELEVATION", x: 300, y: 1500, size: 28 },
        { text: "SCALE: 1/4\" = 1'-0\"", x: 300, y: 1460, size: 12 },
        { text: "42'-6\"", x: 900, y: 1300, size: 10 },
        { text: "T.O. WALL EL. 24'-6\"", x: 1500, y: 1200, size: 10 },
        { text: "BELL TOWER", x: 600, y: 1100, size: 14 },
        { text: "68'-0\"", x: 700, y: 1000, size: 10 },
        { text: "SANCTUARY", x: 1200, y: 900, size: 14 },
        { text: "18'-0\" x 12'-6 1/2\"", x: 1200, y: 860, size: 10 },
        { text: "PT-1 PAINT SEMI-GLOSS ON ALL EXTERIOR TRIM", x: 300, y: 300, size: 9 },
        { text: "12'-14\"", x: 1300, y: 300, size: 9 },
        { text: "A-201", x: 2400, y: 80, size: 30 },
      ],
    },
    {
      texts: [
        { text: "GROUND FLOOR PLAN", x: 300, y: 1500, size: 28 },
        { text: "SCALE 1:100", x: 300, y: 1460, size: 12 },
        { text: "FELLOWSHIP HALL", x: 800, y: 1100, size: 14 },
        { text: "12500", x: 800, y: 1060, size: 10 },
        { text: "3,800 mm", x: 1000, y: 1000, size: 10 },
        { text: "101", x: 900, y: 1140, size: 10 },
        { text: "CLG HT 3.6 m", x: 1000, y: 960, size: 10 },
        { text: "A-101", x: 2400, y: 80, size: 30 },
      ],
    },
    { scanned: true },
  ]);
}

/**
 * Two A3 sheets laid out as the first REAL set read in production was (St
 * Paul's, Egham Hythe — Nye Saunders, 2026-10-04): positions, sizes and text
 * copied from pdf.js's reading of the architect's file, not the file itself
 * (it is theirs). What it pins: the title block's labelled fields ("Drawing
 * No." over P43, "Paper Size" over A3, "Scale" over 1:100), bare metres on a
 * metric plan ("4.7", "5.2"), the unit spelled out ("6.75 metres"), a scale
 * bar's ticks, the project number 21047 in the title block, and a sheet with
 * a location plan at 1:1250 above its block plan at 1:500.
 */
export function ukChurchSet() {
  const block = (number, title, scale) => [
    { text: "Project", x: 492, y: 73, size: 5 },
    { text: "Project No.", x: 775, y: 73, size: 5 },
    { text: "Drawing No.", x: 818, y: 73, size: 5 },
    { text: "Revision.", x: 860, y: 73, size: 5 },
    { text: "Date", x: 903, y: 73, size: 5 },
    { text: "St. Paul's, Egham Hythe", x: 492, y: 58, size: 10 },
    { text: "21047", x: 775, y: 58, size: 10 },
    { text: number, x: 818, y: 58, size: 10 },
    { text: "Oct '23", x: 902, y: 57, size: 10 },
    { text: "Drawing Title", x: 492, y: 45, size: 5 },
    { text: "Scale", x: 775, y: 45, size: 5 },
    { text: "Paper Size", x: 818, y: 45, size: 5 },
    { text: "Drawn By", x: 860, y: 45, size: 5 },
    { text: title, x: 492, y: 29, size: 10 },
    { text: scale, x: 775, y: 29, size: 10 },
    { text: "A3", x: 818, y: 29, size: 10 },
    { text: "DB", x: 860, y: 29, size: 10 },
    { text: "14/11/23", x: 261, y: 62, size: 10 },
  ];
  return buildPlanPdf([
    {
      width: 1191,
      height: 842,
      texts: [
        { text: "135.22 sq.m. / 1,454", x: 1033, y: 776, size: 14 },
        { text: "Kitchen", x: 440, y: 731, size: 14 },
        { text: "5.2", x: 648, y: 725, size: 10 },
        { text: "4.7", x: 603, y: 713, size: 10 },
        { text: "6.75 metres", x: 877, y: 692, size: 10 },
        { text: "Meeting", x: 686, y: 575, size: 12 },
        { text: "3.1", x: 788, y: 556, size: 10 },
        { text: "6.8", x: 718, y: 538, size: 10 },
        { text: "2.1 metres", x: 277, y: 427, size: 10 },
        { text: "4 metres", x: 375, y: 129, size: 10 },
        { text: "0m 1m 2m 3m 4m 5m 10m", x: 837, y: 108, size: 7 },
        { text: "Scale 1:100", x: 837, y: 95, size: 9 },
        ...block("P43", "Scheme C4 - Extension Floor Plan", "1:100"),
      ],
    },
    {
      width: 1191,
      height: 842,
      texts: [
        { text: "50m 40m 30m 20m 10m 0m", x: 1008, y: 346, size: 4 },
        { text: "5m", x: 1113, y: 347, size: 2 },
        { text: "Location Plan", x: 891, y: 219, size: 24 },
        { text: "Scale 1:1250", x: 891, y: 189, size: 24 },
        { text: "Block Plan", x: 545, y: 175, size: 24 },
        { text: "Scale 1:500", x: 545, y: 146, size: 24 },
        ...block("P52", "Location and Block Plan - as proposed", "1:500"),
      ],
    },
    {
      width: 1191,
      height: 842,
      texts: [
        { text: "North", x: 612, y: 679, size: 20 },
        { text: "0m 1m 2m 3m 4m 5m 10m", x: 21, y: 131, size: 7 },
        ...block("E01", "Plan - as existing", "1:100"),
      ],
    },
  ]);
}
