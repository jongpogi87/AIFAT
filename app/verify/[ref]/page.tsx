import Link from "next/link";
import { CheckCircle2, ShieldAlert, ArrowLeft, RadioTower } from "lucide-react";
import { registrations } from "@/db/schema";
import { getDb } from "@/db";
import { getBatch } from "@/lib/batches";
import { eq } from "drizzle-orm";

function toInitials(fullName: string): string {
  const parts = fullName.replace(/[^a-zA-Z\s]/g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "L. N.";
  return parts.map(p => p[0].toUpperCase() + ".").join(" ");
}

export default async function VerifyPage(props: { params: Promise<{ ref: string }> }) {
  const params = await props.params;
  const cleanRef = (params.ref || "").trim().toUpperCase();

  let record: typeof registrations.$inferSelect | null = null;
  let errorMsg = "";

  try {
    const db = getDb();
    const [row] = await db.select().from(registrations).where(eq(registrations.referenceNumber, cleanRef));
    record = row || null;
  } catch (err) {
    console.error("verify_page_failed", err);
    errorMsg = "Verification system temporarily unavailable.";
  }

  const batch = record ? getBatch(record.batchId) : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-white/10 bg-[#043421] text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center border border-yellow-400/60 bg-emerald-950 text-xs font-black tracking-widest text-yellow-300">
              TSS
            </div>
            <div>
              <strong className="block text-sm tracking-wide sm:text-base">THE SIGNAL SCHOOL</strong>
              <small className="block text-[10px] uppercase tracking-[.14em] text-emerald-100">
                Signal Regiment, Philippine Army
              </small>
            </div>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold hover:bg-white/10"
          >
            <ArrowLeft size={14} /> Portal Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {record ? (
            <div>
              <div className="text-center">
                <CheckCircle2 className="mx-auto text-[#0b7543]" size={56} />
                <span className="mt-3 inline-block rounded-full bg-emerald-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-[#075b32]">
                  Authentic Registration
                </span>
                <h1 className="mt-2 text-2xl font-black">Official AIFAT Learner Record</h1>
                <p className="mt-1 text-sm text-slate-500">
                  Confirmed and registered with The Signal School.
                </p>
              </div>

              <div className="mt-6 space-y-3 rounded-xl bg-slate-50 p-5 text-sm">
                <div className="border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Reference Number</span>
                  <p className="font-mono text-lg font-black text-[#075b32]">{record.referenceNumber}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-xs text-slate-500">Learner (Initials)</span>
                    <p className="font-bold">{toInitials(record.fullName)}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Status</span>
                    <p className="font-bold text-emerald-700">{record.registrationStatus || "CONFIRMED"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Class</span>
                    <p className="font-bold">{batch?.classDesignation || "AIFAT-2026"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Mode</span>
                    <p className="font-bold">{batch?.deliveryMode || "Standard"} ({batch?.session || "AM"})</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-500">Area of Responsibility</span>
                    <p className="font-bold">{batch?.aorName || record.aor}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-lg border border-emerald-100 bg-emerald-50/60 p-4 text-xs text-emerald-900">
                <p className="font-bold">Institutional Verification Note</p>
                <p className="mt-1 leading-5 text-emerald-800">
                  To safeguard military learner personal privacy in accordance with the Data Privacy Act of 2012, detailed contact and personal records are restricted to authorized Signal School personnel.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <ShieldAlert className="mx-auto text-amber-600" size={56} />
              <h1 className="mt-3 text-xl font-black text-slate-900">Record Not Found</h1>
              <p className="mt-2 text-sm text-slate-600">
                {errorMsg || `No active registration record was found for reference number "${cleanRef}".`}
              </p>
              <p className="mt-4 text-xs text-slate-400">
                Please verify the reference number or contact The Signal School training directorate.
              </p>
            </div>
          )}
        </div>

        <div className="mt-8 text-center text-xs text-slate-400">
          <p>The Signal School, Signal Regiment, Philippine Army</p>
          <p className="mt-1">Fort Andres Bonifacio, Taguig City</p>
        </div>
      </main>
    </div>
  );
}
