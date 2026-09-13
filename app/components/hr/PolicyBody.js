"use client";

// app/components/hr/PolicyBody.js
//
// Renders a policy's markdown — the plain subset the starters use and the
// editor hints at: `## heading`, `- bullet`, paragraphs, **bold**. No HTML
// passes through: the body is split into lines and each line becomes a
// React element, so a policy typed with a <script> in it is printed as
// text. A markdown library would do more and be one more place a string
// becomes markup; four rules are enough for a page a crew member reads on
// a phone.
function inline(text, keyPrefix) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`}>{p.slice(2, -2)}</strong>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{p}</span>
    ),
  );
}

export default function PolicyBody({ body, className = "" }) {
  const lines = String(body || "").replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let para = [];
  let list = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ kind: "p", text: para.join(" ") });
      para = [];
    }
    if (list.length) {
      blocks.push({ kind: "ul", items: list });
      list = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flush();
      blocks.push({ kind: "h", level: h[1].length, text: h[2] });
      continue;
    }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) {
      if (para.length) flush();
      list.push(li[1]);
      continue;
    }
    if (list.length) flush();
    para.push(line);
  }
  flush();

  return (
    <div className={`space-y-3 text-sm text-foreground leading-relaxed ${className}`} data-policy-body>
      {blocks.map((b, i) => {
        if (b.kind === "h") {
          const Tag = b.level === 1 ? "h2" : "h3";
          return (
            <Tag key={i} className={`font-semibold ${b.level === 1 ? "text-base" : "text-sm"} mt-4 first:mt-0`}>
              {inline(b.text, `h${i}`)}
            </Tag>
          );
        }
        if (b.kind === "ul") {
          return (
            <ul key={i} className="list-disc pl-5 space-y-1">
              {b.items.map((it, j) => (
                <li key={j}>{inline(it, `li${i}-${j}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{inline(b.text, `p${i}`)}</p>;
      })}
    </div>
  );
}
