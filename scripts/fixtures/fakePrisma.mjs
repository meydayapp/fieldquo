// scripts/fixtures/fakePrisma.mjs
//
// An in-memory Prisma stand-in that EVALUATES `where` — AND / OR / NOT,
// equals (+ insensitive), in / notIn / not, lt / lte / gt / gte, contains,
// JSON path equals, and to-one / to-many relation filters — so a query that
// drops its `companyId` returns another tenant's rows and the check reading
// the answer says so. The same evaluator scripts/check-unified-conversations
// .mjs carries inline, made reusable for the inbox auto-link and sent-email
// history checks (scripts/check-inbox-autolink.mjs, check-sent-email-history
// .mjs), with relations declared per check instead of hard-coded.
//
// Every read and write is recorded (`calls`, `writes`) for the tenant-fence
// assertions. `$queryRaw` models the one raw query the conversation code
// makes — the digits-only phone tail on "Client" / "LeadRequest" — by reading
// its SQL: drop the `"companyId" =` clause and the fence goes with it.

const timeOf = (v) => (v instanceof Date ? v.getTime() : typeof v === "string" && !Number.isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}/.test(v) ? Date.parse(v) : v);
const digits = (v) => String(v ?? "").replace(/\D/g, "");

export class FakePrisma {
  /**
   * @param tables     { model: rows[] }
   * @param relations  { model: { field: [(row, db) => related | related[], relatedModel] } }
   */
  constructor(tables, relations = {}) {
    this.t = tables;
    this.calls = [];
    this.writes = [];
    this.RELATIONS = relations;
    for (const model of Object.keys(tables)) this[model] = this.delegate(model);
    this.$transaction = async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(this));
  }

  cond(val, v) {
    if (v === null) return val === null || val === undefined;
    if (v instanceof Date) return timeOf(val) === v.getTime();
    if (typeof v !== "object" || Array.isArray(v)) return val === v;
    const insensitive = v.mode === "insensitive";
    for (const [op, arg] of Object.entries(v)) {
      if (op === "mode" || op === "path") continue;
      if (op === "equals") {
        if ("path" in v) {
          let cur = val;
          for (const p of v.path) cur = cur && typeof cur === "object" ? cur[p] : undefined;
          if (cur !== arg) return false;
        } else if (insensitive) {
          if (val == null || String(val).toLowerCase() !== String(arg).toLowerCase()) return false;
        } else if (arg === null ? val != null : timeOf(val) !== timeOf(arg)) return false;
      } else if (op === "in") {
        if (!arg.includes(val)) return false;
      } else if (op === "notIn") {
        if (val == null || arg.includes(val)) return false; // NOT IN over NULL is NULL
      } else if (op === "not") {
        if (arg === null) {
          if (val == null) return false;
        } else if (typeof arg === "object" && !(arg instanceof Date)) {
          if (this.cond(val, arg)) return false;
        } else if (val == null || val === arg) return false;
      } else if (op === "lte" || op === "gte" || op === "lt" || op === "gt") {
        if (val == null) return false;
        const a = timeOf(val);
        const b = timeOf(arg);
        if (op === "lte" && !(a <= b)) return false;
        if (op === "gte" && !(a >= b)) return false;
        if (op === "lt" && !(a < b)) return false;
        if (op === "gt" && !(a > b)) return false;
      } else if (op === "contains") {
        if (val == null || !String(val).toLowerCase().includes(String(arg).toLowerCase())) return false;
      } else {
        throw new Error(`fakePrisma: operator ${op} not modelled`);
      }
    }
    return true;
  }

  match(model, row, where = {}) {
    for (const [k, v] of Object.entries(where || {})) {
      if (v === undefined) continue;
      if (k === "AND") {
        if (!(Array.isArray(v) ? v : [v]).every((w) => this.match(model, row, w))) return false;
        continue;
      }
      if (k === "OR") {
        if (!v.some((w) => this.match(model, row, w))) return false;
        continue;
      }
      if (k === "NOT") {
        if ((Array.isArray(v) ? v : [v]).some((w) => this.match(model, row, w))) return false;
        continue;
      }
      const rel = this.RELATIONS[model]?.[k];
      if (rel) {
        const related = rel[0](row, this);
        if (Array.isArray(related)) {
          if (v.some) { if (!related.some((r) => this.match(rel[1], r, v.some))) return false; continue; }
          if (v.none) { if (related.some((r) => this.match(rel[1], r, v.none))) return false; continue; }
          throw new Error("fakePrisma: to-many filter needs some/none");
        }
        if (v === null) {
          if (related != null) return false;
          continue;
        }
        const inner = v.is || v;
        if (!related || !this.match(rel[1], related, inner)) return false;
        continue;
      }
      if (!this.cond(row[k], v)) return false;
    }
    return true;
  }

  shape(model, row) {
    const out = { ...row };
    for (const [k, [get]] of Object.entries(this.RELATIONS[model] || {})) {
      const r = get(row, this);
      out[k] = Array.isArray(r) ? r.map((x) => ({ ...x })) : r ? { ...r } : null;
    }
    return out;
  }

  sort(list, orderBy) {
    const keys = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).flatMap((o) => Object.entries(o));
    return [...list].sort((a, b) => {
      for (const [f, dir] of keys) {
        const x = timeOf(a[f]);
        const y = timeOf(b[f]);
        if (x === y) continue;
        const c = x < y ? -1 : 1;
        return dir === "desc" ? -c : c;
      }
      return 0;
    });
  }

  delegate(model) {
    const self = this;
    const read = (op, args = {}) => {
      self.calls.push({ model, op, where: args.where || {} });
      const hits = self.t[model].filter((r) => self.match(model, r, args.where));
      const sorted = self.sort(hits, args.orderBy);
      const taken = args.take ? sorted.slice(0, args.take) : sorted;
      return taken.map((r) => self.shape(model, r));
    };
    return {
      findMany: async (args) => read("findMany", args),
      findFirst: async (args) => read("findFirst", { ...args, take: 1 })[0] || null,
      findUnique: async (args) => read("findUnique", { ...args, take: 1 })[0] || null,
      count: async (args = {}) => read("count", args).length,
      create: async ({ data }) => {
        const row = { id: `${model}_${self.t[model].length + 1}`, createdAt: new Date(), ...data };
        self.t[model].push(row);
        self.writes.push({ model, op: "create", data });
        return { ...row };
      },
      update: async ({ where, data }) => {
        self.calls.push({ model, op: "update", where });
        const row = self.t[model].find((r) => self.match(model, r, where));
        if (!row) throw new Error(`fakePrisma: ${model}.update found nothing`);
        Object.assign(row, data);
        self.writes.push({ model, op: "update", where, data });
        return { ...row };
      },
      updateMany: async ({ where, data }) => {
        self.calls.push({ model, op: "updateMany", where });
        const hit = self.t[model].filter((r) => self.match(model, r, where));
        for (const r of hit) Object.assign(r, data);
        self.writes.push({ model, op: "updateMany", where, data, count: hit.length });
        return { count: hit.length };
      },
    };
  }

  async $queryRaw(strings, ...values) {
    const sql = strings.join("$");
    const table = /FROM "(\w+)"/.exec(sql)?.[1];
    const model = table === "Client" ? "client" : table === "LeadRequest" ? "leadRequest" : null;
    if (!model) throw new Error(`fakePrisma: raw query on ${table} not modelled`);
    const fenced = /"companyId" = \$/.test(sql);
    this.calls.push({ model, op: "$queryRaw", where: fenced ? { companyId: values[0] } : {}, raw: true });
    const like = String(values[values.length - 1] || "");
    const tail = like.replace(/^%/, "");
    return this.t[model]
      .filter((r) => (fenced ? r.companyId === values[0] : true))
      .filter((r) => r.phone && digits(r.phone).endsWith(tail))
      .map((r) => ({ id: r.id, name: r.name, phone: r.phone }));
  }
}
