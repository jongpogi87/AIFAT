import { useEffect, useState } from "react";
import { Link, useRouter } from "@/lib/router";
import { AdminNav } from "@/components/admin-nav";
import { Users, CheckCircle2, AlertTriangle, Layers, ArrowRight, Laptop, CalendarDays } from "lucide-react";
import {
  subscribeAdminAuth,
  getAdminBatches,
  getAdminLearners,
  exportLearnersCsv,
  type AdminProfile,
} from "@/lib/admin/admin-service";

interface BatchStat {
  batchId: string;
  classDesignation: string;
  aorCode: string;
  aorName: string;
  deliveryMode: string;
  session: string;
  capacity: number | null;
  enrolled: number;
  remaining: number;
  status: string;
  isFull: boolean;
}

interface LearnerItem {
  id: string | number;
  referenceNumber: string;
  fullName: string;
  aor: string;
  batchId: string;
  classDesignation: string;
  deliveryMode: string;
  registrationStatus: string;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState<BatchStat[]>([]);
  const [learners, setLearners] = useState<LearnerItem[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeAdminAuth(async (profile, authLoading) => {
      if (authLoading) return;
      if (!profile || !profile.enabled) {
        router.push("/admin/login");
        return;
      }
      if (isMounted) setAdminProfile(profile);

      try {
        const [bDocs, lDocs] = await Promise.all([
          getAdminBatches(),
          getAdminLearners({ limit: 10 }),
        ]);

        if (isMounted) {
          const stats: BatchStat[] = bDocs.map((b) => {
            const capacity = b.capacity || 25;
            const enrolled = Number(b.registeredCount) || 0;
            return {
              batchId: b.batchId,
              classDesignation: b.classDesignation,
              aorCode: b.aorCode,
              aorName: b.aorName,
              deliveryMode: b.deliveryMode,
              session: b.session,
              capacity,
              enrolled,
              remaining: Math.max(0, capacity - enrolled),
              status: b.status,
              isFull: enrolled >= capacity || b.status === "FULL",
            };
          });
          setBatches(stats);

          const lItems: LearnerItem[] = lDocs.map((l: any) => ({
            id: l.id || l.learnerId,
            referenceNumber: l.referenceNumber || l.id,
            fullName: l.fullName || `${l.firstName || ""} ${l.lastName || ""}`.trim(),
            aor: l.aorName || l.region || "AOR",
            batchId: l.batchId || "",
            classDesignation: l.classDesignation || "AIFAT-2026",
            deliveryMode: l.deliveryMode || "Online",
            registrationStatus: l.status || "CONFIRMED",
            createdAt: l.createdAt || "",
          }));
          setLearners(lItems);
        }
      } catch (err) {
        console.error("failed_to_load_dashboard", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#075b32] border-t-transparent"></div>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-slate-500">Loading administrative telemetry…</p>
        </div>
      </div>
    );
  }

  const totalRegistrations = learners.length > 0
    ? batches.reduce((sum, b) => sum + b.enrolled, 0)
    : 0;
  const totalCapacity = batches.reduce((sum, b) => sum + (b.capacity || 25), 0);
  const remainingSlots = Math.max(0, totalCapacity - totalRegistrations);
  const fullBatchesCount = batches.filter(b => b.isFull || b.status === "FULL").length;

  // Breakdown by delivery mode
  const onlineCount = batches
    .filter(b => b.deliveryMode === "Online")
    .reduce((sum, b) => sum + b.enrolled, 0);
  const f2fCount = batches
    .filter(b => b.deliveryMode === "Face-to-Face")
    .reduce((sum, b) => sum + b.enrolled, 0);

  // Group by AOR
  const aorMap: Record<string, { enrolled: number; cap: number }> = {};
  for (const b of batches) {
    if (!aorMap[b.aorCode]) {
      aorMap[b.aorCode] = { enrolled: 0, cap: 0 };
    }
    aorMap[b.aorCode].enrolled += b.enrolled;
    aorMap[b.aorCode].cap += b.capacity || 25;
  }

  async function handleExportCsv() {
    try {
      const csv = await exportLearnersCsv();
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `AIFAT-Learners-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("export_failed", err);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminNav username={adminProfile?.displayName || adminProfile?.email} role={adminProfile?.role} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">AIFAT Training Administration Dashboard</h1>
            <p className="text-xs text-slate-500">
              Overview of registrations, capacity utilization, and delivery mode metrics.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportCsv}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Export CSV Roster
            </button>
            <Link
              href="/admin/batches"
              className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[#075b32] px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#054927]"
            >
              Manage Batches <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Total Registrations</span>
              <Users size={18} className="text-[#075b32]" />
            </div>
            <p className="mt-3 text-3xl font-black text-slate-900">{totalRegistrations}</p>
            <span className="mt-1 block text-xs text-slate-500">Across 12 AORs</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Remaining Slots</span>
              <CheckCircle2 size={18} className="text-emerald-600" />
            </div>
            <p className="mt-3 text-3xl font-black text-emerald-700">{remainingSlots}</p>
            <span className="mt-1 block text-xs text-slate-500">Out of {totalCapacity} total planned slots</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Full / Closed Batches</span>
              <AlertTriangle size={18} className="text-amber-600" />
            </div>
            <p className="mt-3 text-3xl font-black text-amber-700">{fullBatchesCount}</p>
            <span className="mt-1 block text-xs text-slate-500">Out of {batches.length} total batches</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-bold uppercase tracking-wider">Delivery Mode</span>
              <Laptop size={18} className="text-[#075b32]" />
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-[#075b32]">{onlineCount}</span>
              <span className="text-xs font-semibold text-slate-500">Online</span>
              <span className="text-slate-300">|</span>
              <span className="text-2xl font-black text-amber-700">{f2fCount}</span>
              <span className="text-xs font-semibold text-slate-500">F2F (NCR)</span>
            </div>
            <span className="mt-1 block text-xs text-slate-500">1ID–11ID: Online-only</span>
          </div>
        </div>

        {/* Two-column layout: AOR summary & Recent registrations */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
          {/* AOR Distribution */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                Registrations by Area of Responsibility (AOR)
              </h2>
              <span className="text-xs text-slate-400">Target: 25 / class</span>
            </div>
            <div className="mt-4 divide-y divide-slate-100">
              {Object.entries(aorMap).map(([code, data]) => {
                const pct = data.cap > 0 ? Math.min(100, Math.round((data.enrolled / data.cap) * 100)) : 0;
                return (
                  <div key={code} className="py-2.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-slate-700">
                        {code === "T" ? "NCR AOR" : `${code.charCodeAt(0) - 64}ID AOR`} ({code})
                      </span>
                      <span className="text-slate-500">
                        <strong>{data.enrolled}</strong> / {data.cap} enrolled ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full rounded-full bg-slate-100">
                      <div
                        className={`h-2 rounded-full ${pct >= 100 ? "bg-amber-600" : "bg-[#0b7543]"}`}
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Recent Registrations Table */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                Recent Registrations
              </h2>
              <Link href="/admin/learners" className="text-xs font-bold text-[#075b32] hover:underline">
                View All
              </Link>
            </div>

            {learners.length === 0 ? (
              <p className="mt-8 text-center text-xs text-slate-400">No registrations recorded yet.</p>
            ) : (
              <div className="mt-4 divide-y divide-slate-100">
                {learners.slice(0, 6).map((l) => (
                  <div key={l.id} className="py-3 text-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono font-bold text-[#075b32]">{l.referenceNumber}</span>
                        <p className="mt-0.5 font-bold text-slate-800">
                          {l.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500">{l.aor ? `AOR ${l.aor}` : ""}</p>
                      </div>
                      <div className="text-right">
                        <span className="rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                          {l.registrationStatus}
                        </span>
                        <p className="mt-1 text-[11px] text-slate-400">{l.classDesignation}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
