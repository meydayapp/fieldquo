// scripts/staffChatFakeDb.mjs
//
// An in-memory stand-in for the four Prisma delegates lib/staff/teams.js
// touches, so scripts/check-staff-chat.mjs can EXECUTE the membership rule
// rather than grep for it. Just enough Prisma: findUnique/findFirst/findMany
// with flat equality (and `in`), create, update, upsert by the two compound
// uniques, and $transaction over an array of already-built promises.
//
// Deliberately not a general mock. Every unsupported shape throws, so a test
// that reaches for something this does not model fails loudly instead of
// passing on an undefined.
let seq = 0;
const nextId = (p) => `${p}${++seq}`;

function matches(row, where) {
  for (const [k, v] of Object.entries(where || {})) {
    if (v && typeof v === "object" && !(v instanceof Date)) {
      if (Array.isArray(v.in)) { if (!v.in.includes(row[k])) return false; continue; }
      if (k === "roomId_platformAdminId" || k === "roomId_salesRepId") {
        if (!matches(row, v)) return false;
        continue;
      }
      throw new Error(`fake db: unsupported where on ${k}: ${JSON.stringify(v)}`);
    }
    if ((row[k] ?? null) !== (v ?? null)) return false;
  }
  return true;
}

function delegate(table, idPrefix, uniques = []) {
  const pick = (row, select) => {
    if (!row) return null;
    if (!select) return { ...row };
    const out = {};
    for (const k of Object.keys(select)) if (select[k]) out[k] = row[k] ?? null;
    return out;
  };
  const find = (where) => table.find((r) => matches(r, where)) || null;
  return {
    findUnique: async ({ where, select }) => pick(find(where), select),
    findFirst: async ({ where, select }) => pick(find(where), select),
    findMany: async ({ where, select } = {}) => table.filter((r) => matches(r, where)).map((r) => pick(r, select)),
    create: async ({ data, select }) => {
      const row = { id: nextId(idPrefix), open: true, ...data };
      for (const u of uniques) {
        if (u.every((k) => row[k] != null) && table.some((r) => u.every((k) => r[k] === row[k]))) {
          const err = new Error("Unique constraint failed"); err.code = "P2002"; throw err;
        }
      }
      table.push(row);
      return pick(row, select);
    },
    update: async ({ where, data, select }) => {
      const row = find(where);
      if (!row) throw new Error("fake db: update of a row that is not there");
      Object.assign(row, data);
      return pick(row, select);
    },
    upsert: async ({ where, update, create, select }) => {
      const row = find(where);
      if (row) { Object.assign(row, update || {}); return pick(row, select); }
      const made = { id: nextId(idPrefix), open: true, ...create };
      table.push(made);
      return pick(made, select);
    },
    _rows: table,
  };
}

/** A fresh database. Pass rows to start with. */
export function fakeDb({ admins = [], reps = [], rooms = [], members = [] } = {}) {
  const tables = {
    platformAdmin: [...admins],
    salesRep: [...reps],
    staffRoom: [...rooms],
    staffRoomMember: [...members],
  };
  return {
    platformAdmin: delegate(tables.platformAdmin, "a"),
    salesRep: delegate(tables.salesRep, "r"),
    staffRoom: delegate(tables.staffRoom, "room", [["teamKey"], ["directKey"], ["slug"]]),
    staffRoomMember: delegate(tables.staffRoomMember, "m", [["roomId", "platformAdminId"], ["roomId", "salesRepId"]]),
    $transaction: async (ops) => Promise.all(ops),
    tables,
  };
}
