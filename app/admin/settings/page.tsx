import { useEffect, useState } from "react";
import { useRouter } from "@/lib/router";
import { AdminNav } from "@/components/admin-nav";
import { DEFAULT_OPERATIONAL_CONFIG, type OperationalConfig } from "@/lib/config";
import { Save, AlertTriangle, ShieldCheck, Check, Lock } from "lucide-react";
import {
  subscribeAdminAuth,
  getAdminSystemSettings,
  updateAdminSystemSettings,
  type AdminProfile,
} from "@/lib/admin/admin-service";

function isPending(val: any): boolean {
  if (val === undefined || val === null) return true;
  const str = String(val).trim();
  if (!str) return true;
  return /pending|unconfirmed|tbd/i.test(str);
}

function StatusBadge({ pending }: { pending: boolean }) {
  if (pending) {
    return (
      <span className="ml-2 inline-flex items-center gap-1 rounded border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
        <AlertTriangle size={10} /> Awaiting Official Approval
      </span>
    );
  }
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
      <Check size={10} /> Approved
    </span>
  );
}

export default function AdminSettingsPage() {
  const [config, setConfig] = useState<OperationalConfig>(DEFAULT_OPERATIONAL_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
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
        const data = await getAdminSystemSettings();
        if (isMounted) {
          setConfig({ ...DEFAULT_OPERATIONAL_CONFIG, ...(data as any) });
        }
      } catch (err) {
        console.error("load_settings_err", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      await updateAdminSystemSettings(config as any);
      setMessage("Operational and course configuration saved successfully.");
    } catch (err: any) {
      setError(err?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  function handleChange(key: keyof OperationalConfig, value: any) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  const hasPendingRequiredSettings =
    isPending(config.contactNumber) ||
    isPending(config.emailAddress) ||
    isPending(config.trainingVenue) ||
    isPending(config.registrationDeadline) ||
    isPending(config.officeAddress) ||
    isPending(config.officeHours) ||
    isPending(config.dataRetentionPolicy);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <AdminNav username={adminProfile?.displayName || adminProfile?.email} role={adminProfile?.role} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Operational & Course Configuration
          </h1>
          <p className="text-xs text-slate-500">
            Configure official contact points, training schedules, course metadata, and reference formats.
          </p>
        </div>

        {/* Dynamic Warning / Approved Indicator */}
        {hasPendingRequiredSettings ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-bold">Official Input Pending</p>
                <p className="mt-0.5 leading-relaxed text-amber-800">
                  One or more operational settings are marked as awaiting official confirmation. Unverified values are clearly identified below. When all required operational settings have been verified and approved, this warning will automatically disappear.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
            <div className="flex items-start gap-2">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div>
                <p className="font-bold">Operational Settings Approved</p>
                <p className="mt-0.5 leading-relaxed text-emerald-800">
                  All institutional contact channels, physical venues, deadlines, and governance policies are officially confirmed and active.
                </p>
              </div>
            </div>
          </div>
        )}

        {message && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            <Check size={16} /> {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {/* Institutional Contact & Operational Details */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Institutional Contact & Operational Details
            </h2>
            <p className="text-xs text-slate-500">Learner assistance, unit coordination, and physical training venue details.</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex items-center">
                  <label className="block text-xs font-bold text-slate-700">Official Office / Unit Name</label>
                  <StatusBadge pending={isPending(config.officeName)} />
                </div>
                <input
                  type="text"
                  value={config.officeName}
                  onChange={(e) => handleChange("officeName", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center">
                  <label className="block text-xs font-bold text-slate-700">Official Contact Number</label>
                  <StatusBadge pending={isPending(config.contactNumber)} />
                </div>
                <input
                  type="text"
                  value={config.contactNumber}
                  onChange={(e) => handleChange("contactNumber", e.target.value)}
                  placeholder="e.g. +63 2 845 9555 loc. XXXX"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex items-center">
                  <label className="block text-xs font-bold text-slate-700">Support / Inquiries Email</label>
                  <StatusBadge pending={isPending(config.emailAddress)} />
                </div>
                <input
                  type="text"
                  value={config.emailAddress}
                  onChange={(e) => handleChange("emailAddress", e.target.value)}
                  placeholder="e.g. support@example.invalid"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono"
                />
              </div>

              <div>
                <div className="flex items-center">
                  <label className="block text-xs font-bold text-slate-700">Office Hours</label>
                  <StatusBadge pending={isPending(config.officeHours)} />
                </div>
                <input
                  type="text"
                  value={config.officeHours}
                  onChange={(e) => handleChange("officeHours", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center">
                  <label className="block text-xs font-bold text-slate-700">Physical Address / Headquarters</label>
                  <StatusBadge pending={isPending(config.officeAddress)} />
                </div>
                <input
                  type="text"
                  value={config.officeAddress}
                  onChange={(e) => handleChange("officeAddress", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center">
                  <label className="block text-xs font-bold text-slate-700">Official Training Venue</label>
                  <StatusBadge pending={isPending(config.trainingVenue)} />
                </div>
                <input
                  type="text"
                  value={config.trainingVenue}
                  onChange={(e) => handleChange("trainingVenue", e.target.value)}
                  placeholder="e.g. The Signal School, Fort Bonifacio / Online Platform"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <div className="flex items-center">
                  <label className="block text-xs font-bold text-slate-700">Registration Deadline</label>
                  <StatusBadge pending={isPending(config.registrationDeadline)} />
                </div>
                <input
                  type="text"
                  value={config.registrationDeadline}
                  onChange={(e) => handleChange("registrationDeadline", e.target.value)}
                  placeholder="e.g. 10 September 2026 or YYYY-MM-DD"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700">Support Instructions</label>
                <textarea
                  rows={2}
                  value={config.supportInstructions}
                  onChange={(e) => handleChange("supportInstructions", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>
            </div>
          </section>

          {/* Controlled Course Configuration */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  Course Configuration
                </h2>
                <p className="text-xs text-slate-500">Official curriculum titles, delivery capacity, and registration controls.</p>
              </div>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                Controlled Section
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700">Official Training Title</label>
                <input
                  type="text"
                  value={config.courseTitle}
                  onChange={(e) => handleChange("courseTitle", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Training Year</label>
                <input
                  type="number"
                  value={config.trainingYear}
                  onChange={(e) => handleChange("trainingYear", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Default Class Capacity</label>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={config.defaultClassCapacity}
                  onChange={(e) => handleChange("defaultClassCapacity", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono"
                />
                <span className="mt-1 block text-[11px] text-slate-400">Standard institutional baseline (default 25 learners).</span>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700">Public Course Description</label>
                <textarea
                  rows={2}
                  value={config.courseDescription}
                  onChange={(e) => handleChange("courseDescription", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700">TESDA Certification-Opportunity Wording</label>
                <textarea
                  rows={2}
                  value={config.tesdaOpportunityWording}
                  onChange={(e) => handleChange("tesdaOpportunityWording", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Reference Number Prefix</label>
                <input
                  type="text"
                  value={config.referenceNumberPrefix}
                  onChange={(e) => handleChange("referenceNumberPrefix", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">Reference-Number Format Template</label>
                <input
                  type="text"
                  value={config.referenceNumberFormat}
                  onChange={(e) => handleChange("referenceNumberFormat", e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono"
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  Preview: {config.referenceNumberFormat.replace("{YEAR}", String(config.trainingYear || "2026")).replace("{AOR}", "A").replace("{SEQ}", "0001")}
                </span>
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.registrationEnabled}
                    onChange={(e) => handleChange("registrationEnabled", e.target.checked)}
                    className="h-4 w-4 accent-[#075b32]"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    Learner Self-Service Registration Availability (System-Wide Active)
                  </span>
                </label>
                <span className="ml-6 block text-[11px] text-slate-400">
                  Unchecking this temporarily suspends intake across all public registration forms.
                </span>
              </div>
            </div>
          </section>

          {/* Locked Institutional AOR Rules (Administrative Governance) */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-slate-200 p-2 text-slate-700">
                <Lock size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                    Institutional AOR Delivery Policy
                  </h2>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                    Locked Rule
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                  Institutional mandate locks training delivery by Area of Responsibility:
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <span className="font-bold text-slate-800">Regional AORs (1ID – 11ID / Codes A–K):</span>
                    <p className="text-slate-500 mt-0.5">Strictly <strong>Online AM</strong> and <strong>Online PM</strong> only.</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <span className="font-bold text-slate-800">NCR AOR (Code T):</span>
                    <p className="text-slate-500 mt-0.5">Authorized for both <strong>Online AM/PM</strong> and <strong>Face-to-Face AM/PM</strong>.</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500 italic">
                  Institutional AOR rules are locked in core system architecture and cannot be altered by ordinary portal administrators.
                </p>
              </div>
            </div>
          </section>

          {/* Data Privacy & Retention Policy */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center">
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                Data Retention & Privacy Notice
              </h2>
              <StatusBadge pending={isPending(config.dataRetentionPolicy)} />
            </div>
            <p className="text-xs text-slate-500">Regulatory compliance and records retention statement.</p>

            <div className="mt-4">
              <label className="block text-xs font-bold text-slate-700">Retention Policy Statement</label>
              <textarea
                rows={3}
                value={config.dataRetentionPolicy}
                onChange={(e) => handleChange("dataRetentionPolicy", e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs"
              />
            </div>
          </section>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-11 items-center gap-1.5 rounded-lg bg-[#075b32] px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-[#054927] disabled:opacity-50"
            >
              <Save size={15} /> {saving ? "Saving Changes…" : "Save Operational Configuration"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
