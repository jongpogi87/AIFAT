"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";
import { AORS } from "@/lib/batches";
import { Search, Download, Edit3, X, Check, Filter, Eye } from "lucide-react";

interface Learner {
  id: number;
  referenceNumber: string;
  fullName: string;
  lastName: string;
  firstName: string;
  middleName: string;
  extensionName: string;
  email: string;
  contactNumber: string;
  street: string;
  barangay: string;
  cityMunicipality: string;
  province: string;
  region: string;
  sex: string;
  civilStatus: string;
  birthdate: string;
  age: number | null;
  employmentStatus: string;
  employmentType: string;
  educationalAttainment: string;
  learnerClassification: string;
  classificationOthers: string;
  isScholar: boolean;
  scholarshipPackage: string;
  scholarshipPackageOthers: string;
  uliNumber: string;
  entryDate: string;
  disabilityType: string;
  disabilityCauses: string;
  aor: string;
  batchId: string;
  classDesignation: string;
  deliveryMode: string;
  session: string;
  registrationStatus: string;
  attendanceStatus: string;
  completionStatus: string;
  certificationStatus: string;
  createdAt: string;
}

export default function AdminLearnersPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedAor, setSelectedAor] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [editingLearner, setEditingLearner] = useState<Learner | null>(null);
  const [viewingLearner, setViewingLearner] = useState<Learner | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  async function fetchLearners() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (selectedAor) params.set("aor", selectedAor);
      if (selectedStatus) params.set("status", selectedStatus);

      const res = await fetch(`/api/admin/learners?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLearners(data.learners || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLearners();
  }, [selectedAor, selectedStatus]);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchLearners();
  }

  async function handleUpdateStatus(e: React.FormEvent) {
    e.preventDefault();
    if (!editingLearner) return;
    setStatusMsg("");

    try {
      const res = await fetch(`/api/admin/learners/${editingLearner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationStatus: editingLearner.registrationStatus,
          attendanceStatus: editingLearner.attendanceStatus,
          completionStatus: editingLearner.completionStatus,
          certificationStatus: editingLearner.certificationStatus,
          uliNumber: editingLearner.uliNumber,
          entryDate: editingLearner.entryDate,
          disabilityType: editingLearner.disabilityType,
          disabilityCauses: editingLearner.disabilityCauses,
        }),
      });

      if (res.ok) {
        setStatusMsg("Learner record and administrative fields updated successfully.");
        setEditingLearner(null);
        fetchLearners();
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminNav />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">TESDA Learner Profile Roster</h1>
            <p className="text-xs text-slate-500">
              Review official learner profiles (MIS 03-01), manage ULI assignments, attendance, and certification records.
            </p>
          </div>
          <a
            href="/api/admin/export"
            className="flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download size={15} /> Export Official TESDA CSV
          </a>
        </div>

        {/* Filter & Search Bar */}
        <div className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1.5fr_.7fr_.7fr_auto]">
          <form onSubmit={handleSearch} className="relative">
            <Search size={15} className="absolute inset-y-0 left-3 my-auto text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, reference number, email, contact…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-xs"
            />
          </form>

          <select
            value={selectedAor}
            onChange={(e) => setSelectedAor(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
          >
            <option value="">All AORs</option>
            {AORS.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name} ({a.code})
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="PENDING">PENDING</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          <button
            onClick={fetchLearners}
            className="flex min-h-10 items-center justify-center gap-1 rounded-lg bg-[#075b32] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#054927]"
          >
            <Filter size={13} /> Filter
          </button>
        </div>

        {statusMsg && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            {statusMsg}
          </div>
        )}

        {/* Learners Table */}
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Reference / ULI</th>
                  <th className="px-4 py-3">Learner Name</th>
                  <th className="px-4 py-3">Classification & Attainment</th>
                  <th className="px-4 py-3">Class & Mode</th>
                  <th className="px-4 py-3">Contact Details</th>
                  <th className="px-4 py-3">Attendance</th>
                  <th className="px-4 py-3">Completion / TESDA</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {learners.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      {loading ? "Loading learner roster…" : "No matching registrations found."}
                    </td>
                  </tr>
                ) : (
                  learners.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3.5">
                        <span className="font-mono font-bold text-[#075b32]">{l.referenceNumber}</span>
                        {l.uliNumber ? (
                          <span className="block font-mono text-[10px] text-slate-500">ULI: {l.uliNumber}</span>
                        ) : (
                          <span className="block text-[10px] italic text-slate-400">ULI Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-900">{l.fullName}</span>
                        <span className="block text-[11px] text-slate-500">
                          {l.sex} {l.age ? `• ${l.age} yrs` : ""} • {l.civilStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-800">{l.learnerClassification || "Unclassified"}</span>
                        {l.classificationOthers && (
                          <span className="block text-[10px] text-slate-500">({l.classificationOthers})</span>
                        )}
                        <span className="block text-[10px] text-slate-400">{l.educationalAttainment}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-800">{l.classDesignation}</span>
                        <span className="block text-[11px] text-slate-500">
                          {l.deliveryMode} ({l.session}) - AOR {l.aor}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block text-slate-800">{l.email}</span>
                        <span className="block text-[11px] text-slate-500">{l.contactNumber}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            l.attendanceStatus === "PRESENT"
                              ? "bg-emerald-100 text-emerald-800"
                              : l.attendanceStatus === "ABSENT"
                              ? "bg-red-100 text-red-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {l.attendanceStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            l.completionStatus === "COMPLETED"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {l.completionStatus}
                        </span>
                        <span className="block text-[10px] text-slate-400">Cert: {l.certificationStatus}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right space-x-1">
                        <button
                          onClick={() => setViewingLearner(l)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          title="View Full TESDA Profile"
                        >
                          <Eye size={12} /> View
                        </button>
                        <button
                          onClick={() => setEditingLearner(l)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                          title="Edit Administrative Fields"
                        >
                          <Edit3 size={12} /> Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* View Full TESDA Profile Modal */}
        {viewingLearner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#075b32]">
                    TESDA MIS 03-01 Profile
                  </span>
                  <h2 className="text-base font-black uppercase text-slate-900">{viewingLearner.fullName}</h2>
                </div>
                <button onClick={() => setViewingLearner(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Reference & Enrollment</span>
                  <p className="font-mono text-sm font-bold text-[#075b32]">{viewingLearner.referenceNumber}</p>
                  <p className="text-slate-700 mt-1">{viewingLearner.classDesignation} ({viewingLearner.deliveryMode} - {viewingLearner.session})</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="font-bold text-slate-500">Contact Number:</span>
                    <p className="text-slate-900">{viewingLearner.contactNumber}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">Email Address:</span>
                    <p className="text-slate-900">{viewingLearner.email}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-bold text-slate-500">Mailing Address:</span>
                    <p className="text-slate-900">
                      {[viewingLearner.street, viewingLearner.barangay, viewingLearner.cityMunicipality, viewingLearner.province, viewingLearner.region].filter(Boolean).join(", ") || "Address on record"}
                    </p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">Sex:</span>
                    <p className="text-slate-900">{viewingLearner.sex || "Not specified"}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">Civil Status:</span>
                    <p className="text-slate-900">{viewingLearner.civilStatus || "Not specified"}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">Birthdate & Age:</span>
                    <p className="text-slate-900">{viewingLearner.birthdate ? `${viewingLearner.birthdate} (${viewingLearner.age} yrs old)` : "Not specified"}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">Employment Before Training:</span>
                    <p className="text-slate-900">{viewingLearner.employmentStatus} {viewingLearner.employmentType !== "None" ? `(${viewingLearner.employmentType})` : ""}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-bold text-slate-500">Educational Attainment:</span>
                    <p className="text-slate-900">{viewingLearner.educationalAttainment || "Not specified"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="font-bold text-slate-500">Learner Classification:</span>
                    <p className="text-slate-900">{viewingLearner.learnerClassification} {viewingLearner.classificationOthers ? `— ${viewingLearner.classificationOthers}` : ""}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">Scholarship:</span>
                    <p className="text-slate-900">{viewingLearner.isScholar ? `Yes (${viewingLearner.scholarshipPackage})` : "No"}</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">ULI Number:</span>
                    <p className="font-mono text-slate-900">{viewingLearner.uliNumber || "Not yet assigned"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setViewingLearner(null)}
                  className="rounded bg-slate-100 px-4 py-1.5 font-bold text-slate-700 hover:bg-slate-200 text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Administrative Status & TESDA Fields Modal */}
        {editingLearner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-sm font-black uppercase text-slate-900">
                    Administrative & TESDA Processing
                  </h2>
                  <p className="text-xs text-slate-500">{editingLearner.fullName}</p>
                </div>
                <button onClick={() => setEditingLearner(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateStatus} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700">Unique Learner Identifier (ULI) Number</label>
                  <input
                    type="text"
                    value={editingLearner.uliNumber || ""}
                    onChange={(e) => setEditingLearner({ ...editingLearner, uliNumber: e.target.value })}
                    placeholder="Enter official TESDA ULI"
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-mono"
                  />
                  <span className="text-[10px] text-slate-400">Assigned by TESDA personnel.</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700">TESDA Entry Date</label>
                  <input
                    type="date"
                    value={editingLearner.entryDate || ""}
                    onChange={(e) => setEditingLearner({ ...editingLearner, entryDate: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700">Disability Type (If PWD)</label>
                    <input
                      type="text"
                      value={editingLearner.disabilityType || ""}
                      onChange={(e) => setEditingLearner({ ...editingLearner, disabilityType: e.target.value })}
                      placeholder="Filled by TESDA"
                      className="mt-1 w-full rounded border border-slate-300 p-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700">Disability Causes</label>
                    <input
                      type="text"
                      value={editingLearner.disabilityCauses || ""}
                      onChange={(e) => setEditingLearner({ ...editingLearner, disabilityCauses: e.target.value })}
                      placeholder="Filled by TESDA"
                      className="mt-1 w-full rounded border border-slate-300 p-2 text-xs"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Training Statuses</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700">Registration Status</label>
                  <select
                    value={editingLearner.registrationStatus}
                    onChange={(e) => setEditingLearner({ ...editingLearner, registrationStatus: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-semibold"
                  >
                    <option value="CONFIRMED">CONFIRMED</option>
                    <option value="PENDING">PENDING</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700">Course Attendance</label>
                  <select
                    value={editingLearner.attendanceStatus}
                    onChange={(e) => setEditingLearner({ ...editingLearner, attendanceStatus: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-semibold"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="PRESENT">PRESENT</option>
                    <option value="ABSENT">ABSENT</option>
                    <option value="EXCUSED">EXCUSED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700">Course Completion</label>
                  <select
                    value={editingLearner.completionStatus}
                    onChange={(e) => setEditingLearner({ ...editingLearner, completionStatus: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-semibold"
                  >
                    <option value="INCOMPLETE">INCOMPLETE</option>
                    <option value="COMPLETED">COMPLETED</option>
                    <option value="DROPPED">DROPPED</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700">TESDA Certification Status</label>
                  <select
                    value={editingLearner.certificationStatus}
                    onChange={(e) => setEditingLearner({ ...editingLearner, certificationStatus: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-semibold"
                  >
                    <option value="NOT_ISSUED">NOT_ISSUED</option>
                    <option value="ELIGIBLE">ELIGIBLE</option>
                    <option value="ISSUED">ISSUED</option>
                  </select>
                </div>

                <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingLearner(null)}
                    className="rounded border border-slate-300 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded bg-[#075b32] px-4 py-1.5 font-bold text-white hover:bg-[#054927]"
                  >
                    <Check size={14} /> Save Administrative Updates
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
