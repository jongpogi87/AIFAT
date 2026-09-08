import { useEffect, useState } from "react";
import { useRouter } from "@/lib/router";
import { AdminNav } from "@/components/admin-nav";
import { AORS, type AorCode } from "@/lib/batches";
import { Plus, Edit3, Check, X, ShieldAlert, AlertCircle } from "lucide-react";
import {
  subscribeAdminAuth,
  getAdminBatches,
  updateAdminBatch,
  type AdminProfile,
} from "@/lib/admin/admin-service";
import { doc, setDoc } from "firebase/firestore";
import { clientDb } from "@/lib/firebase/client";

interface BatchItem {
  batchId: string;
  classDesignation: string;
  aorCode: string;
  aorName: string;
  deliveryMode: "Online" | "Face-to-Face";
  session: "AM" | "PM";
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  registrationDeadline: string | null;
  capacity: number | null;
  status: string;
  enabled: boolean;
  enrolled: number;
  remaining: number;
}

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBatch, setEditingBatch] = useState<BatchItem | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const router = useRouter();

  // Filter state
  const [filterAor, setFilterAor] = useState("");
  const [filterMode, setFilterMode] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterYear, setFilterYear] = useState("");

  // New batch form state
  const [newAor, setNewAor] = useState<string>("T");
  const [newMode, setNewMode] = useState<"Online" | "Face-to-Face">("Online");
  const [newSession, setNewSession] = useState<"AM" | "PM">("AM");
  const [newClassDesig, setNewClassDesig] = useState("");
  const [newCapacity, setNewCapacity] = useState(25);
  const [newStartDate, setNewStartDate] = useState("14 September 2026");
  const [newEndDate, setNewEndDate] = useState("25 September 2026");
  const [newStartTime, setNewStartTime] = useState("0800H");
  const [newEndTime, setNewEndTime] = useState("1200H");
  const [newVenue, setNewVenue] = useState("Online");

  async function loadBatches() {
    try {
      const bDocs = await getAdminBatches();
      const items: BatchItem[] = bDocs.map((b) => {
        const capacity = b.capacity || 25;
        const enrolled = Number(b.registeredCount) || 0;
        return {
          batchId: b.batchId,
          classDesignation: b.classDesignation,
          aorCode: b.aorCode,
          aorName: b.aorName,
          deliveryMode: b.deliveryMode as any,
          session: b.session as any,
          startDate: b.startDate,
          endDate: b.endDate,
          startTime: b.startTime,
          endTime: b.endTime,
          venue: b.venue,
          registrationDeadline: b.registrationDeadline,
          capacity,
          status: b.status,
          enabled: b.enabled !== false,
          enrolled,
          remaining: Math.max(0, capacity - enrolled),
        };
      });
      setBatches(items);
    } catch (err) {
      console.error("load_batches_err", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isMounted = true;
    const unsubscribe = subscribeAdminAuth((profile, authLoading) => {
      if (authLoading) return;
      if (!profile || !profile.enabled) {
        router.push("/admin/login");
        return;
      }
      if (isMounted) {
        setAdminProfile(profile);
        loadBatches();
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  // When AOR changes in create form, enforce online-only if not NCR
  function handleAorChange(code: string) {
    setNewAor(code);
    if (code !== "T") {
      setNewMode("Online");
      setNewVenue("Online");
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBatch) return;
    setErrorMsg("");
    setSaveMsg("");

    try {
      await updateAdminBatch(editingBatch.batchId, {
        capacity: Number(editingBatch.capacity),
        status: editingBatch.status as any,
        registrationDeadline: editingBatch.registrationDeadline,
        startDate: editingBatch.startDate,
        endDate: editingBatch.endDate,
        startTime: editingBatch.startTime,
        endTime: editingBatch.endTime,
        venue: editingBatch.venue,
        enabled: editingBatch.enabled,
      });

      setSaveMsg("Batch updated successfully.");
      setEditingBatch(null);
      await loadBatches();
    } catch (err: any) {
      setErrorMsg(err?.message || "Save failed.");
    }
  }

  async function handleCreateBatch(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    setSaveMsg("");

    if (newAor !== "T" && newMode === "Face-to-Face") {
      setErrorMsg("Institutional policy error: Face-to-Face delivery mode is authorized strictly for NCR AOR (T).");
      return;
    }

    try {
      const aorObj = AORS.find((a) => a.code === newAor);
      const batchId = `${newAor.toLowerCase()}-${newMode === "Online" ? "online" : "f2f"}-${newSession.toLowerCase()}`;
      await setDoc(doc(clientDb, "batches", batchId), {
        batchId,
        classDesignation: newClassDesig || `AIFAT Class ${newAor}99-2026`,
        aorCode: newAor,
        aorName: aorObj?.name || `${newAor} AOR`,
        deliveryMode: newMode,
        session: newSession,
        capacity: Number(newCapacity) || 25,
        registeredCount: 0,
        startDate: newStartDate,
        endDate: newEndDate,
        startTime: newStartTime,
        endTime: newEndTime,
        venue: newVenue,
        status: "OPEN",
        enabled: true,
        registrationDeadline: null,
        createdAt: new Date().toISOString(),
      });

      setSaveMsg("New training batch provisioned successfully.");
      setShowCreateModal(false);
      await loadBatches();
    } catch (err: any) {
      setErrorMsg(err?.message || "Creation failed.");
    }
  }

  const filteredBatches = batches.filter((b) => {
    if (filterAor && b.aorCode !== filterAor) return false;
    if (filterMode && b.deliveryMode !== filterMode) return false;
    if (filterStatus && b.status !== filterStatus) return false;
    if (filterYear) {
      const inDesig = b.classDesignation.includes(filterYear);
      const inDate = b.startDate.includes(filterYear) || b.endDate.includes(filterYear);
      if (!inDesig && !inDate) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminNav username={adminProfile?.displayName || adminProfile?.email} role={adminProfile?.role} />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Batch Administration</h1>
            <p className="text-xs text-slate-500">
              Manage authorized training classes, capacities, deadlines, and delivery schedules.
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[#075b32] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#054927]"
          >
            <Plus size={15} /> Create Class Batch
          </button>
        </div>

        {saveMsg && (
          <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            {saveMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-800">
            {errorMsg}
          </div>
        )}

        {/* Filter Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">AOR</label>
            <select
              value={filterAor}
              onChange={(e) => setFilterAor(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
            >
              <option value="">All AORs</option>
              {AORS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Delivery Mode</label>
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
            >
              <option value="">All Delivery Modes</option>
              <option value="Online">Online</option>
              <option value="Face-to-Face">Face-to-Face (NCR Only)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="OPEN">OPEN</option>
              <option value="NEARLY FULL">NEARLY FULL</option>
              <option value="FULL">FULL</option>
              <option value="REGISTRATION CLOSED">REGISTRATION CLOSED</option>
              <option value="UPCOMING">UPCOMING</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Training Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="min-h-10 w-full rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
            >
              <option value="">All Years</option>
              <option value="2026">2026</option>
              <option value="2027">2027</option>
            </select>
          </div>
        </div>

        {/* Batch Table */}
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100 font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">Class Designation</th>
                  <th className="px-4 py-3">AOR</th>
                  <th className="px-4 py-3">Mode & Session</th>
                  <th className="px-4 py-3">Dates & Venue</th>
                  <th className="px-4 py-3 text-center">Enrollment / Cap</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      {loading ? "Loading batches…" : "No matching batches found for the selected filters."}
                    </td>
                  </tr>
                ) : (
                  filteredBatches.map((b) => (
                    <tr key={b.batchId} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3.5">
                        <span className="font-bold text-slate-900">{b.classDesignation}</span>
                      </td>
                    <td className="px-4 py-3.5">
                      <span className="font-bold text-slate-700">{b.aorName}</span>
                      <span className="ml-1 rounded bg-slate-200 px-1 py-0.5 text-[10px] font-mono">
                        {b.aorCode}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`font-bold ${
                          b.deliveryMode === "Face-to-Face" ? "text-amber-800" : "text-[#075b32]"
                        }`}
                      >
                        {b.deliveryMode}
                      </span>
                      <span className="ml-1 text-slate-500">({b.session})</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span>{b.startDate}–{b.endDate}</span>
                      <span className="block text-[11px] text-slate-500">{b.venue}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className="font-bold text-slate-800">{b.enrolled}</span>
                      <span className="text-slate-400"> / {b.capacity ?? "∞"}</span>
                      {b.remaining <= 3 && b.remaining > 0 && (
                        <span className="block text-[10px] font-bold text-amber-600">
                          {b.remaining} slots left
                        </span>
                      )}
                      {b.remaining === 0 && (
                        <span className="block text-[10px] font-bold text-red-600">FULL</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                          b.status === "OPEN"
                            ? "bg-emerald-100 text-emerald-800"
                            : b.status === "NEARLY FULL"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        onClick={() => setEditingBatch(b)}
                        className="inline-flex items-center gap-1 rounded border border-slate-300 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            </table>
          </div>
        </div>

        {/* Edit Batch Modal */}
        {editingBatch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="text-base font-black uppercase text-slate-900">
                    Edit Class: {editingBatch.classDesignation}
                  </h2>
                  <span className="font-mono text-[11px] text-slate-400">Internal Batch ID: {editingBatch.batchId}</span>
                </div>
                <button onClick={() => setEditingBatch(null)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="mt-4 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700">Batch Status</label>
                    <select
                      value={editingBatch.status}
                      onChange={(e) => setEditingBatch({ ...editingBatch, status: e.target.value })}
                      className="mt-1 w-full rounded border border-slate-300 p-2 font-semibold"
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="NEARLY FULL">NEARLY FULL</option>
                      <option value="FULL">FULL</option>
                      <option value="REGISTRATION CLOSED">REGISTRATION CLOSED</option>
                      <option value="UPCOMING">UPCOMING</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700">Capacity (Learners)</label>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={editingBatch.capacity ?? 25}
                      onChange={(e) => setEditingBatch({ ...editingBatch, capacity: Number(e.target.value) })}
                      className="mt-1 w-full rounded border border-slate-300 p-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700">Start Date</label>
                    <input
                      type="text"
                      value={editingBatch.startDate}
                      onChange={(e) => setEditingBatch({ ...editingBatch, startDate: e.target.value })}
                      className="mt-1 w-full rounded border border-slate-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700">End Date</label>
                    <input
                      type="text"
                      value={editingBatch.endDate}
                      onChange={(e) => setEditingBatch({ ...editingBatch, endDate: e.target.value })}
                      className="mt-1 w-full rounded border border-slate-300 p-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700">Start Time</label>
                    <input
                      type="text"
                      value={editingBatch.startTime}
                      onChange={(e) => setEditingBatch({ ...editingBatch, startTime: e.target.value })}
                      className="mt-1 w-full rounded border border-slate-300 p-2"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700">End Time</label>
                    <input
                      type="text"
                      value={editingBatch.endTime}
                      onChange={(e) => setEditingBatch({ ...editingBatch, endTime: e.target.value })}
                      className="mt-1 w-full rounded border border-slate-300 p-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700">Training Venue</label>
                  <input
                    type="text"
                    value={editingBatch.venue}
                    onChange={(e) => setEditingBatch({ ...editingBatch, venue: e.target.value })}
                    className="mt-1 w-full rounded border border-slate-300 p-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700">Registration Deadline</label>
                  <input
                    type="date"
                    value={editingBatch.registrationDeadline ? editingBatch.registrationDeadline.slice(0, 10) : ""}
                    onChange={(e) => setEditingBatch({ ...editingBatch, registrationDeadline: e.target.value || null })}
                    className="mt-1 w-full rounded border border-slate-300 p-2"
                  />
                  <span className="text-[11px] text-slate-400">Leave blank if pending official TSS operational input.</span>
                </div>

                <label className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    checked={editingBatch.enabled}
                    onChange={(e) => setEditingBatch({ ...editingBatch, enabled: e.target.checked })}
                    className="h-4 w-4 accent-[#075b32]"
                  />
                  <span className="font-bold text-slate-700">Batch Visible on Learner Portal</span>
                </label>

                <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setEditingBatch(null)}
                    className="rounded border border-slate-300 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded bg-[#075b32] px-4 py-1.5 font-bold text-white hover:bg-[#054927]"
                  >
                    <Check size={14} /> Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Batch Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h2 className="text-base font-black uppercase text-slate-900">Provision New Batch</h2>
                <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateBatch} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700">Area of Responsibility (AOR)</label>
                  <select
                    value={newAor}
                    onChange={(e) => handleAorChange(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 p-2 font-semibold"
                  >
                    {AORS.map((a) => (
                      <option key={a.code} value={a.code}>
                        {a.name} (Code {a.code}) {a.code === "T" ? "— Online & F2F Authorized" : "— Online-Only"}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700">Delivery Mode</label>
                    <select
                      value={newMode}
                      onChange={(e) => {
                        const m = e.target.value as "Online" | "Face-to-Face";
                        setNewMode(m);
                        if (m === "Face-to-Face") {
                          setNewVenue("The Signal School, Fort Andres Bonifacio, Taguig City");
                        } else {
                          setNewVenue("Online");
                        }
                      }}
                      className="mt-1 w-full rounded border border-slate-300 p-2 font-semibold"
                    >
                      <option value="Online">Online</option>
                      {newAor === "T" ? (
                        <option value="Face-to-Face">Face-to-Face (NCR Only)</option>
                      ) : (
                        <option disabled value="Face-to-Face">
                          Face-to-Face (Disabled for 1ID–11ID)
                        </option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700">Session</label>
                    <select
                      value={newSession}
                      onChange={(e) => {
                        const s = e.target.value as "AM" | "PM";
                        setNewSession(s);
                        if (s === "AM") {
                          setNewStartTime("0800H");
                          setNewEndTime("1200H");
                        } else {
                          setNewStartTime("1300H");
                          setNewEndTime("1700H");
                        }
                      }}
                      className="mt-1 w-full rounded border border-slate-300 p-2 font-semibold"
                    >
                      <option value="AM">AM (0800H - 1200H)</option>
                      <option value="PM">PM (1300H - 1700H)</option>
                    </select>
                  </div>
                </div>

                {newAor !== "T" && (
                  <div className="flex items-center gap-2 rounded bg-emerald-50 p-2.5 text-xs text-emerald-900">
                    <AlertCircle size={15} className="shrink-0 text-[#075b32]" />
                    <span>
                      Policy Lock: 1ID through 11ID AORs are strictly authorized for Online AM and Online PM sessions.
                    </span>
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700">Class Designation</label>
                  <input
                    type="text"
                    required
                    value={newClassDesig}
                    onChange={(e) => setNewClassDesig(e.target.value)}
                    placeholder={`e.g. AIFAT Class ${newAor}01-2026`}
                    className="mt-1 w-full rounded border border-slate-300 p-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700">Capacity</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={newCapacity}
                    onChange={(e) => setNewCapacity(Number(e.target.value))}
                    className="mt-1 w-full rounded border border-slate-300 p-2"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700">Training Venue</label>
                  <input
                    type="text"
                    required
                    value={newVenue}
                    onChange={(e) => setNewVenue(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 p-2"
                  />
                </div>

                <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded border border-slate-300 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-1 rounded bg-[#075b32] px-4 py-1.5 font-bold text-white hover:bg-[#054927]"
                  >
                    <Plus size={14} /> Provision Batch
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
