// scripts/tenantScopeScan.mjs
//
// The static reader behind check-tenant-scope.mjs. Kept separate so the check
// script is assertions and this is mechanics, and so both halves can be
// exercised from a REPL while iterating.
//
// Everything here works on source text rather than a parsed AST, for the
// reason check-imports.mjs gives: no parser is installed, the shapes being
// looked for are narrow, and a hand-rolled reader that understands strings,
// template literals and nesting is enough. It is deliberately CONSERVATIVE —
// when it cannot prove a call is safe it says so, and the answer is either to
// make the proof visible or to declare the exception by name.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Every API route, read off the filesystem — never a hand-kept list. */
export function routeFiles() {
  return execSync("find app/api -name route.js", { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .sort();
}

/**
 * Blank out comments, preserving offsets and line numbers.
 *
 * Load-bearing: this repo's route files are more comment than code, and the
 * comments describe the very things being asserted absent ("never scope this
 * by company", "another tenant's clientId"). A scanner that reads prose as
 * code flags the paragraph explaining why the code is right.
 */
export function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (c === '"' || c === "'" || c === "`") { state = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === "line") { out += c === "\n" ? "\n" : " "; if (c === "\n") state = "code"; i++; continue; }
    if (state === "block") {
      if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += c === "\n" ? "\n" : " "; i++; continue;
    }
    // inside a string literal
    if (c === "\\") { out += "  "; i += 2; continue; }
    if (c === state) state = "code";
    out += c === "\n" ? "\n" : c;
    i++;
  }
  return out;
}

/** The balanced (){}[] run starting at `start`. */
export function balanced(src, start) {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "(" || c === "{" || c === "[") depth++;
    else if (c === ")" || c === "}" || c === "]") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start);
}

/** The object literal assigned to `key:` inside an object literal's text. */
export function objectValue(text, key) {
  const re = new RegExp(`\\b${key}\\s*:`, "g");
  let m;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length;
    while (/\s/.test(text[i])) i++;
    if (text[i] === "{") return balanced(text, i);
  }
  return null;
}

/**
 * Models that carry a companyId column, read from schema.prisma.
 *
 * Derived rather than listed on purpose. "Which models are tenant data" is a
 * fact the schema already states, and a hand-kept copy of it would go stale
 * the first time somebody adds a model — which is exactly the moment the check
 * needs to know.
 *
 * Returns the Prisma DELEGATE names (`db.jobVisit`), not the model names.
 */
export function tenantDelegates() {
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  const out = new Set();
  const re = /^model\s+([A-Za-z0-9_]+)\s*\{([\s\S]*?)^\}/gm;
  let m;
  while ((m = re.exec(schema))) {
    const [, name, body] = m;
    if (!/^\s*companyId\s+/m.test(body)) continue;
    out.add(name[0].toLowerCase() + name.slice(1));
  }
  return out;
}

const SINGLE_RECORD = new Set([
  "findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow",
  "update", "delete", "upsert",
]);
const WRITES = new Set(["create", "update", "upsert", "createMany", "updateMany"]);

/** Every `db.<model>.<op>({...})` call in a file, with its where/data text. */
export function prismaCalls(src) {
  const calls = [];
  const re = /\b(?:db|tx|prisma)\s*\.\s*([A-Za-z0-9_]+)\s*\.\s*([A-Za-z]+)\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const args = balanced(src, m.index + m[0].length - 1);
    calls.push({
      model: m[1],
      op: m[2],
      idx: m.index,
      line: src.slice(0, m.index).split("\n").length,
      where: objectValue(args, "where"),
      data: objectValue(args, "data") || objectValue(args, "create"),
      args,
    });
  }
  return calls;
}

/** Identifiers that came off the request: params, query string or body. */
export function requestDerived(src) {
  const out = new Set();
  let m;
  const destructure =
    /const\s*\{([^}]*)\}\s*=\s*(?:await\s+)?(?:request\.json\(\)[^;]*|body|_params|params|await\s+params)/g;
  while ((m = destructure.exec(src))) {
    for (const part of m[1].split(",")) {
      const name = part.split(":").pop().split("=")[0].trim();
      if (name) out.add(name);
    }
  }
  const member = /\b(?:body|_params|params)\??\.([A-Za-z0-9_]+)/g;
  while ((m = member.exec(src))) out.add(m[1]);
  const search = /const\s+([A-Za-z0-9_]+)\s*=\s*[A-Za-z0-9_.]*searchParams\.get\(/g;
  while ((m = search.exec(src))) out.add(m[1]);
  return out;
}

/**
 * Variables holding a row that was already proved to belong to the company —
 * i.e. assigned from a lookup whose `where` names companyId.
 *
 * `const quote = await db.quote.findFirst({ where: { id, companyId } })` makes
 * `quote.id` safe to use unscoped afterwards, which is the dominant pattern in
 * this codebase and must not be reported.
 */
export function provenRowVars(src) {
  const out = new Set();

  // 1. Assigned from a Prisma call that named companyId — in `where` (a scoped
  //    read) or in `data` (a row this request just created inside the company).
  const direct =
    /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*await\s+(?:db|tx|prisma)\s*\.\s*[A-Za-z0-9_]+\s*\.\s*[A-Za-z]+\s*\(/g;
  let m;
  while ((m = direct.exec(src))) {
    const args = balanced(src, m.index + m[0].length - 1);
    const where = objectValue(args, "where");
    const data = objectValue(args, "data");
    if ((where && /companyId/.test(where)) || (data && /companyId/.test(data))) out.add(m[1]);
  }

  // 2. Assigned from a helper that was HANDED the tenant. `loadQuote(member,
  //    id)` and `heldNumber(member.companyId)` are the two shapes this
  //    codebase uses, and refusing to recognise them would mean declaring an
  //    exception for every route that factors its lookup into a function —
  //    which is the routes that did it properly.
  const viaHelper = /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*await\s+([A-Za-z0-9_.]+)\s*\(/g;
  while ((m = viaHelper.exec(src))) {
    if (/^(?:db|tx|prisma)\b/.test(m[2])) continue; // handled above
    const args = balanced(src, m.index + m[0].length - 1);
    if (/\bcompanyId\b|\bmember\b/.test(args)) out.add(m[1]);
  }

  // 3. One level of aliasing. `const rootId = existing.parentInvoiceId ||
  //    existing.id` carries the proof of `existing` — refusing that would
  //    report the invoice versioning lookup, which is correct code.
  //    Run to a fixed point so a chain of two aliases resolves.
  for (let pass = 0; pass < 3; pass++) {
    const alias = /(?:const|let|var)\s+([A-Za-z0-9_]+)\s*=\s*([^;\n]+)/g;
    let a;
    let grew = false;
    while ((a = alias.exec(src))) {
      if (out.has(a[1])) continue;
      if (/\bawait\b/.test(a[2])) continue; // covered by 1 and 2
      const refs = a[2].match(/[A-Za-z0-9_]+/g) || [];
      if (refs.some((r) => out.has(r))) { out.add(a[1]); grew = true; }
    }
    if (!grew) break;
  }

  return out;
}

/**
 * The resolved caller's own identity. `member.id`, `actor.id`, `session.id`
 * and `full.id` name the Member row of whoever is making the request — they
 * come from the session, never from the request body, so scoping a lookup on
 * one by companyId would be asking whether the caller is in their own company.
 */
const CALLER_IDENTITY = new Set(["member", "actor", "session", "full", "me"]);

/**
 * Local helper functions whose body proves company ownership — the
 * `assertOwnership(companyId, id)` / `loadOwned(companyId, id)` shape that
 * eight or so route files use. Returns the helper names.
 */
export function ownershipHelpers(src) {
  const out = new Set();
  const re = /(?:async\s+function|const)\s+([A-Za-z0-9_]+)\s*(?:=\s*async\s*)?\(/g;
  let m;
  while ((m = re.exec(src))) {
    // Body = from the opening brace after the parameter list to its match.
    const parens = balanced(src, m.index + m[0].length - 1);
    let i = m.index + m[0].length - 1 + parens.length;
    while (i < src.length && /[\s=>]/.test(src[i])) i++;
    if (src[i] !== "{") continue;
    const body = balanced(src, i);
    const provesByWhere = /where\s*:\s*\{[^}]*companyId/.test(body);
    const provesByCompare = /companyId\s*!==|!==\s*[A-Za-z0-9_.]*companyId/.test(body);
    if (provesByWhere || provesByCompare) out.add(m[1]);
  }
  return out;
}

/** Arguments each local helper is called with, keyed by helper name. */
export function helperCallArgs(src, names) {
  const seen = new Map();
  for (const name of names) {
    const re = new RegExp(`\\b${name}\\s*\\(`, "g");
    let m;
    while ((m = re.exec(src))) {
      const args = balanced(src, m.index + m[0].length - 1);
      for (const id of args.match(/[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)?/g) || []) {
        if (!seen.has(id)) seen.set(id, []);
        seen.get(id).push({ helper: name, idx: m.index });
      }
    }
  }
  return seen;
}

/**
 * UNSCOPED LOOKUPS — the "load" half.
 *
 * A single-record read or write on a tenant model, keyed by an id, whose
 * `where` does not name companyId and which nothing upstream proved.
 */
export function unscopedLookups(file) {
  const src = decomment(readFileSync(join(ROOT, file), "utf8"));
  const tenant = tenantDelegates();
  const calls = prismaCalls(src);
  const proven = provenRowVars(src);
  const helpers = ownershipHelpers(src);
  const helperArgs = helperCallArgs(src, helpers);

  const findings = [];
  for (const call of calls) {
    if (!SINGLE_RECORD.has(call.op)) continue;
    if (!tenant.has(call.model)) continue;   // no companyId column to scope BY
    if (!call.where) continue;
    if (/companyId/.test(call.where) || /\b(?:company|job|quote|invoice|payRun|campaign|worker)\s*:\s*\{/.test(call.where))
      continue;                               // scoped, directly or through a parent

    const inner = call.where.slice(1, -1);
    const explicit = inner.match(/(?:^|[{,\s])id\s*:\s*([A-Za-z0-9_.]+)/);
    const shorthand = /(?:^|[{,\s])id\s*[,}]/.test(inner) && !/(?:^|[{,\s])id\s*:/.test(inner);
    const idExpr = explicit ? explicit[1] : shorthand ? "id" : null;
    if (!idExpr) continue;                    // keyed by something else entirely

    const base = idExpr.split(".")[0];
    if (proven.has(base)) continue;           // derived from a scoped row
    if (CALLER_IDENTITY.has(base)) continue;  // the caller's own session row

    // Checked immediately afterwards — `findUnique({ where: { id } })` then
    // `if (!row || row.companyId !== member.companyId) return 404`. Reading the
    // row is not the breach; returning it is, and this refuses to.
    if (/companyId\s*!==|!==\s*[A-Za-z0-9_.]*companyId/.test(src.slice(call.idx, call.idx + 600)))
      continue;

    // Guarded: the same model and the same id were looked up earlier under a
    // company scope, or checked against companyId right after.
    const guarded = calls.some(
      (g) =>
        g.idx < call.idx &&
        g.model === call.model &&
        g.where &&
        new RegExp(`\\b${idExpr.replace(".", "\\.")}\\b`).test(g.where) &&
        (/companyId/.test(g.where) ||
          /companyId\s*!==|!==\s*[A-Za-z0-9_.]*companyId/.test(src.slice(g.idx, g.idx + 600))),
    );
    if (guarded) continue;

    // Guarded by a local helper that does the check, called with this id.
    const viaHelper = (helperArgs.get(idExpr) || helperArgs.get(base) || []).some(
      (c) => c.idx < call.idx,
    );
    if (viaHelper) continue;

    findings.push({ file, line: call.line, model: call.model, op: call.op, idExpr });
  }
  return findings;
}

/**
 * Each exported handler's body, plus everything outside them.
 *
 * Load-bearing for the foreign-key check below. A proof has to be in the SAME
 * handler as the write it protects: GET /api/quotes filters by
 * `{ companyId, ...(clientId && { clientId }) }`, and a file-wide search would
 * read that as proving the `clientId` that POST writes onto a new quote — which
 * is precisely the bug, sitting forty lines above itself.
 */
export function handlerBodies(src) {
  const out = [];
  const re = /export\s+async\s+function\s+(GET|POST|PATCH|PUT|DELETE|HEAD|OPTIONS)\s*\(/g;
  let m;
  let firstStart = src.length;
  while ((m = re.exec(src))) {
    const parens = balanced(src, m.index + m[0].length - 1);
    let i = m.index + m[0].length - 1 + parens.length;
    while (i < src.length && /\s/.test(src[i])) i++;
    if (src[i] !== "{") continue;
    const body = balanced(src, i);
    firstStart = Math.min(firstStart, m.index);
    out.push({ name: m[1], offset: i, text: body });
  }
  // The prelude: imports and the file's own helper functions, which every
  // handler may legitimately lean on.
  out.push({ name: "(module scope)", offset: 0, text: src.slice(0, firstStart) });
  return out;
}

/**
 * UNPROVEN FOREIGN KEYS — the "write" half, and the one that was actually
 * broken. See lib/tenant/ownedIds.js for what this class of bug looks like.
 *
 * Scoped per handler: a proof in GET does not protect a write in POST.
 */
export function unprovenForeignKeys(file, ownedFields) {
  const src = decomment(readFileSync(join(ROOT, file), "utf8"));
  const bodies = handlerBodies(src);
  const prelude = bodies.find((b) => b.name === "(module scope)").text;
  const findings = [];

  for (const handler of bodies) {
    if (handler.name === "(module scope)") continue;
    // The handler, plus the file's helpers — a route that factors its checks
    // into `assertOwnership()` is doing the right thing, not hiding.
    const scope = prelude + "\n" + handler.text;
    const calls = prismaCalls(handler.text);
    const tainted = requestDerived(handler.text);

    const proved = new Set();
    for (const call of prismaCalls(scope)) {
      if (!call.where || !/companyId/.test(call.where)) continue;
      for (const t of tainted) if (new RegExp(`\\b${t}\\b`).test(call.where)) proved.add(t);
    }
    // `db[model].findFirst({ where: { id, companyId } })` — the dynamic form
    // POST /api/tasks uses to check five links in one helper. What it proves is
    // whatever ids were handed to that helper in this handler.
    const dynamic = /\b(?:db|tx|prisma)\s*\[\s*[A-Za-z0-9_]+\s*\]\s*\.\s*[A-Za-z]+\s*\(/g;
    let dm;
    while ((dm = dynamic.exec(scope))) {
      const args = balanced(scope, dm.index + dm[0].length - 1);
      if (!/companyId/.test(args)) continue;
      // The ids passed to the enclosing helper, read off its call sites in
      // THIS handler.
      for (const t of tainted)
        if (new RegExp(`\\b${t}\\b`).test(handler.text)) proved.add(t);
    }
    const asserts = /\b(?:assertOwnedIds|ownedIdsRefusal)\s*\(/g;
    let am;
    while ((am = asserts.exec(scope))) {
      const args = balanced(scope, am.index + am[0].length - 1);
      for (const key of Object.keys(ownedFields))
        if (new RegExp(`\\b${key}\\b`).test(args)) proved.add(key);
      for (const t of tainted)
        if (new RegExp(`\\b${t}\\b`).test(args)) proved.add(t);
    }

    for (const call of calls) {
      if (!WRITES.has(call.op) || !call.data) continue;
      for (const field of Object.keys(ownedFields)) {
        const explicit = call.data.match(
          new RegExp(`\\b${field}\\s*:\\s*([A-Za-z0-9_.?]+)`),
        );
        let source = null;
        if (explicit) {
          const expr = explicit[1];
          const base = expr.split(".")[0].replace("?", "");
          if (tainted.has(base)) source = base;
          // `assignedToId: body.assignedToId` — read straight off the parsed
          // body without ever being destructured into a variable. PATCH
          // /api/tasks/[id] writes both of its foreign keys this way, so a
          // reader that only knew about destructured names missed it entirely.
          else if (["body", "_params", "params"].includes(base)) {
            const prop = expr.split(".").pop().replace("?", "");
            source = prop || field;
          }
        } else if (
          new RegExp(`[{,\\s]${field}\\s*[,}]`).test(call.data) &&
          tainted.has(field)
        ) {
          source = field;
        }
        if (source && !proved.has(source) && !proved.has(field)) {
          findings.push({
            file,
            handler: handler.name,
            line: src.slice(0, handler.offset).split("\n").length +
              call.line - 1,
            model: call.model,
            op: call.op,
            field,
            source,
          });
        }
      }
    }
  }
  return findings;
}
