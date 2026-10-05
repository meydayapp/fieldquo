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
