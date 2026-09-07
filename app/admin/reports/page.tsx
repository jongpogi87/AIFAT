"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { Download, Printer, BarChart3, FileSpreadsheet, ShieldCheck } from "lucide-react";

interface BatchSummary {
  batchId: string;
  classDesignation: string;
  aorName: string;
  aorCode: string;
  deliveryMode: string;
  session: string;
  enrolled: number;
  capacity: number;
  remaining: number;
  status: string;
}

export default function AdminReportsPage() {
  const [batches, setBatches] = useState<BatchSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/batches");
        if (res.ok) {
          const data = await res.json();
          setBatches(data.batches || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const totalEnrolled = batches.reduce((sum, b) => sum + b.enrolled, 0);
  const totalCapacity = batches.reduce((sum, b) => sum + (b.capacity || 25), 0);
  const overallPct = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="print:hidden">
        <AdminNav />
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 print:p-2">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center print:border-b-2 print:border-black">
          <div>
            <div className="hidden print:block text-xs font-bold uppercase tracking-wider text-slate-600">
              PHILIPPINE ARMY | SIGNAL REGIMENT
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 print:text-xl">
              Official AIFAT Training Reports & Rosters
            </h1>
            <p className="text-xs text-slate-500 print:text-black">
              Conducted by The Signal School, Fort Andres Bonifacio, Taguig City.
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Printer size={15} /> Print Roster Report
            </button>
            <a
              href="/api/admin/export"
              className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[#075b32] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#054927]"
            >
              <Download size={15} /> Download CSV Spreadsheet
            </a>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 print:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:border-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              TOTAL REGISTERED LEARNERS
            </span>
            <p className="mt-2 text-3xl font-black text-slate-900">{totalEnrolled}</p>
            <span className="text-xs text-slate-500">Registered AIFAT learners</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:border-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Planned Capacity
            </span>
            <p className="mt-2 text-3xl font-black text-slate-900">{totalCapacity}</p>
            <span className="text-xs text-slate-500">Maximum learner target</span>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm print:border-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Overall Capacity Utilization
            </span>
            <p className="mt-2 text-3xl font-black text-[#075b32]">{overallPct}%</p>
            <span className="text-xs text-slate-500">{totalCapacity - totalEnrolled} remaining open slots</span>
          </div>
        </div>

        {/* Class by Class Roster Summary */}
        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm print:border-slate-400">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Class Allocation and Capacity Roster
              </h2>
              <p className="text-xs text-slate-500">Class allocation and enrollment by AOR</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-[#075b32] print:hidden">
              <ShieldCheck size={14} /> Official TSS Schedule
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100 font-bold uppercase tracking-wider text-slate-700">
                <tr>
                  <th className="px-3 py-2.5">Class Designation</th>
                  <th className="px-3 py-2.5">AOR Name (Code)</th>
                  <th className="px-3 py-2.5">Delivery Mode</th>
                  <th className="px-3 py-2.5">Session</th>
                  <th className="px-3 py-2.5 text-center">Enrolled</th>
                  <th className="px-3 py-2.5 text-center">Capacity</th>
                  <th className="px-3 py-2.5 text-center">Slots Left</th>
                  <th className="px-3 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batches.map((b) => {
                  const pct = b.capacity > 0 ? Math.round((b.enrolled / b.capacity) * 100) : 0;
                  return (
                    <tr key={b.batchId}>
                      <td className="px-3 py-2.5 font-bold text-slate-900">{b.classDesignation}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700">
                        {b.aorName} ({b.aorCode})
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`font-semibold ${
                            b.deliveryMode === "Face-to-Face" ? "text-amber-800 font-bold" : "text-slate-800"
                          }`}
                        >
                          {b.deliveryMode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">{b.session}</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-900">{b.enrolled}</td>
                      <td className="px-3 py-2.5 text-center text-slate-600">{b.capacity}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={b.remaining === 0 ? "font-bold text-red-600" : "font-semibold"}>
                          {b.remaining}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-8 hidden border-t border-slate-300 pt-6 text-xs text-slate-600 print:block">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="font-bold">Prepared by:</p>
                <div className="mt-8 border-b border-black w-48"></div>
                <p className="mt-1 font-semibold">TSS Training Operations Officer</p>
              </div>
              <div>
                <p className="font-bold">Approved by:</p>
                <div className="mt-8 border-b border-black w-48"></div>
                <p className="mt-1 font-semibold">Commandant, The Signal School</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
