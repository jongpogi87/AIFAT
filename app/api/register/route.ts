import { registrations } from "@/db/schema";
import { getDb } from "@/db";

const online = new Set(["online-am", "online-pm"]);
const centralized = new Set(["online-am", "online-pm", "f2f-am", "f2f-pm"]);
const aors = new Set([..."ABCDEFGHIJK", "TSS"]);

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    for (const field of ["fullName","rank","unit","email","contactNumber","serviceCategory","aor","batchId"]) {
      if (typeof body[field] !== "string" || !(body[field] as string).trim()) return Response.json({ error: "Please complete all required fields." }, { status: 400 });
    }
    if (body.consent !== true) return Response.json({ error: "Consent is required to register." }, { status: 400 });
    const aor = String(body.aor), batchId = String(body.batchId), email = String(body.email).trim().toLowerCase();
    if (!aors.has(aor) || !(aor === "TSS" ? centralized : online).has(batchId)) return Response.json({ error: "The selected AOR and batch combination is not available." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    const referenceNumber = `AIFAT-2026-${crypto.randomUUID().slice(0,8).toUpperCase()}`;
    const record = { referenceNumber, fullName:String(body.fullName).trim(), rank:String(body.rank).trim(), unit:String(body.unit).trim(), email, contactNumber:String(body.contactNumber).trim(), serviceCategory:String(body.serviceCategory).trim(), aor, batchId, createdAt:new Date() };
    await getDb().insert(registrations).values(record);
    return Response.json({ registration: record }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("UNIQUE constraint failed")) return Response.json({ error: "This email is already registered for the selected batch." }, { status: 409 });
    console.error("registration_failed", error);
    return Response.json({ error: "Registration is temporarily unavailable. Please try again." }, { status: 500 });
  }
}
