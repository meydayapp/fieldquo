// app/api/custom-fields/values/route.js
//
// The answers to a company's custom fields, for ONE record.
//
//   GET  /api/custom-fields/values?entityType=job&entityId=<id>
//        → the job's definitions in order, each with its stored value
//          (entityId may be omitted for a record that is not created yet:
//          the definitions come back with empty values so the "new" form
//          can render the boxes).
//   PUT  /api/custom-fields/values  { entityType, entityId, values: { [fieldId]: raw } }
//        → validates every answer against its definition's type, upserts,
//          returns the same shape as GET.
//
// One route for six record types, rather than a `customFields` key threaded
// through six save routes — lib/customFields/values.js says why. What the
// route itself owns is WHO may read or write: the same grid dial that gates
// the record. A crew member who may only view a job may read its gate code
// and not change it; someone with no access to invoices gets nothing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { requirePermission } from "@/lib/permissions";
import { isEntityType } from "@/lib/customFields/validate";
import {
  loadCustomFields,
  saveCustomFieldValues,
  resolveCustomFieldEntity,
} from "@/lib/customFields/values";

// The grid category and the rung that means "may see" / "may change" the
// record this value hangs off. Team has no grid dial — a team member's card
// is "user:manage", the same gate the definitions page uses.
const GATE = {
  client: { category: "clientsProperties", read: "full_view", write: "full_edit" },
  quote: { category: "quotes", read: "view_only", write: "view_create_edit" },
  job: { category: "jobs", read: "view_only", write: "view_create_edit" },
  invoice: { category: "invoices", read: "view_only", write: "view_create_edit" },
  team: null,
  // No Property record exists to hang a value on (see lib/customFields/values.js).
  property: null,
};

async function gate(member, entityType, mode) {
  if (entityType === "property") {
    return NextResponse.json({ error: "FieldQuo has no property record to fill in" }, { status: 400 });
  }
  if (entityType === "team") {
    // Reading a colleague's ticket expiry is fine for anyone on the team;
    // writing it is the same act as editing their card.
    if (mode === "read") return null;
    try {
      requirePermission(member.role, "user:manage");
      return null;
    } catch {
      return NextResponse.json({ error: "Only owners/admins can edit team members" }, { status: 403 });
    }
  }
  const g = GATE[entityType];
  const { response } = await levelOrRefusal(
    member,
    g.category,
    mode === "read" ? g.read : g.write,
    mode === "read" ? `see ${entityType}s` : `edit ${entityType}s`,
  );
  return response || null;
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId") || null;
  if (!isEntityType(entityType)) {
    return NextResponse.json({ error: "A valid entityType is required" }, { status: 400 });
  }
  const denied = await gate(member, entityType, "read");
  if (denied) return denied;

  // A record that is not this company's is "not found" — the same answer
  // the record's own route gives, and never another company's answers.
  let storedId = null;
  if (entityId) {
    storedId = await resolveCustomFieldEntity(db, member.companyId, entityType, entityId);
    if (!storedId) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(
    await loadCustomFields(db, member.companyId, entityType, storedId, { resolved: true }),
  );
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const entityType = body?.entityType;
  if (!isEntityType(entityType)) {
    return NextResponse.json({ error: "A valid entityType is required" }, { status: 400 });
  }
  const denied = await gate(member, entityType, "write");
  if (denied) return denied;

  const result = await saveCustomFieldValues(
    db,
    member.companyId,
    entityType,
    body?.entityId,
    body?.values,
  );
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.errors && { errors: result.errors }) },
      { status: result.status },
    );
  }
  return NextResponse.json(result.fields);
}
