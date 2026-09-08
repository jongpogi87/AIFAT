import { useEffect, useState } from "react";
import { CheckCircle2, ShieldAlert, ArrowLeft } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { clientDb } from "@/lib/firebase/client";
import { Link, useParams } from "@/lib/router";

interface VerificationRecord {
  referenceNumber: string;
  classDesignation: string;
  aorName: string;
  deliveryMode: string;
  session: string;
  trainingYear?: number;
  status: string;
  createdAt: string;
}

export default function VerifyPage() {
  const params = useParams();
  const rawRef = params.ref || params.reference || "";
  const cleanRef = rawRef.trim().toUpperCase();

  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<VerificationRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let isMounted = true;
    if (!cleanRef) {
      setLoading(false);
      setErrorMsg("No reference number was specified.");
      return;
    }

    async function loadVerification() {
      try {
        const snap = await getDoc(doc(clientDb, "verifications", cleanRef));
        if (!isMounted) return;
        if (snap.exists()) {
          setRecord(snap.data() as VerificationRecord);
        } else {
          setRecord(null);
        }
      } catch (err: any) {
        console.error("verify_lookup_failed", err);
        if (isMounted) {
          setErrorMsg("Verification system temporarily unavailable.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadVerification();
    return () => {
      isMounted = false;
    };
  }, [cleanRef]);

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
          {loading ? (
            <div className="py-12 text-center text-sm font-semibold text-slate-500">
              Verifying official registration record...
            </div>
          ) : record ? (
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
                    <span className="text-xs text-slate-500">Training Year</span>
                    <p className="font-bold">{record.trainingYear || 2026}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Status</span>
                    <p className="font-bold text-emerald-700">{record.status || "CONFIRMED"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Class</span>
                    <p className="font-bold">{record.classDesignation || "AIFAT-2026"}</p>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Mode</span>
                    <p className="font-bold">{record.deliveryMode || "Standard"} ({record.session || "AM"})</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs text-slate-500">Area of Responsibility</span>
                    <p className="font-bold">{record.aorName}</p>
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
