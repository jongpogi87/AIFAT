"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Cpu,
  GraduationCap,
  Info,
  Laptop,
  MapPin,
  RadioTower,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { AORS, BATCHES, type Batch } from "@/lib/batches";
import {
  TESDA_EDUCATIONAL_ATTAINMENTS,
  TESDA_CIVIL_STATUSES,
  TESDA_EMPLOYMENT_STATUSES,
  TESDA_EMPLOYMENT_TYPES,
  TESDA_LEARNER_CLASSIFICATIONS,
  TESDA_SCHOLARSHIP_PACKAGES,
  DEFAULT_COURSE_QUALIFICATION,
  calculateAge,
} from "@/lib/tesda";
import { DEFAULT_OPERATIONAL_CONFIG } from "@/lib/config";

type Step = "landing" | "aor" | "batch" | "register" | "confirm";

type Draft = {
  // 1. Learner Profile
  lastName: string;
  firstName: string;
  middleName: string;
  extensionName: string;
  street: string;
  barangay: string;
  district: string;
  cityMunicipality: string;
  province: string;
  region: string;
  email: string;
  contactNumber: string;
  nationality: string;

  // 2. Personal Information
  sex: string;
  civilStatus: string;
  birthdate: string;
  birthCity: string;
  birthProvince: string;
  birthRegion: string;

  // 3. Employment Before Training
  employmentStatus: string;
  employmentType: string;

  // 4. Educational Attainment
  educationalAttainment: string;

  // 5. Parent / Guardian (optional)
  parentGuardianName: string;
  parentGuardianAddress: string;

  // 6. Learner Classification
  learnerClassification: string;
  classificationOthers: string;

  // 8. Scholarship Information
  isScholar: boolean;
  scholarshipPackage: string;
  scholarshipPackageOthers: string;

  // 9. Privacy Consent & Certification
  consent: boolean | null;
  applicantCertified: boolean;
};

type Registration = {
  referenceNumber: string;
  fullName: string;
  email: string;
  contactNumber: string;
  aor: string;
  batchId: string;
  classDesignation: string;
  deliveryMode: string;
  session: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  courseQualification: string;
  registrationStatus: string;
};

const emptyDraft: Draft = {
  lastName: "",
  firstName: "",
  middleName: "",
  extensionName: "",
  street: "",
  barangay: "",
  district: "",
  cityMunicipality: "",
  province: "",
  region: "",
  email: "",
  contactNumber: "",
  nationality: "Filipino",
  sex: "",
  civilStatus: "",
  birthdate: "",
  birthCity: "",
  birthProvince: "",
  birthRegion: "",
  employmentStatus: "",
  employmentType: "None",
  educationalAttainment: "",
  parentGuardianName: "",
  parentGuardianAddress: "",
  learnerClassification: "",
  classificationOthers: "",
  isScholar: false,
  scholarshipPackage: "",
  scholarshipPackageOthers: "",
  consent: null,
  applicantCertified: false,
};

const STORAGE_KEY = "aifat_learner_registration_draft";

function getStoredDraft(): Draft {
  if (typeof window === "undefined") return emptyDraft;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...emptyDraft, ...parsed };
    }
  } catch {
    // Ignore storage parse error
  }
  return emptyDraft;
}

function persistDraft(d: Draft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d));
  } catch {
    // Ignore storage write error
  }
}

function clearStoredDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage write error
  }
}

function Mark() {
  return (
    <div className="grid h-12 w-12 shrink-0 place-items-center border border-yellow-400/60 bg-emerald-950 text-sm font-black tracking-widest text-yellow-300">
      TSS
    </div>
  );
}

function Header({ step, go }: { step: Step; go: (s: Step) => void }) {
  const back = step === "aor" ? "landing" : step === "batch" ? "aor" : "batch";
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#043421]/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <button onClick={() => go("landing")} className="flex items-center gap-3 text-left" aria-label="Back to Home">
          <Mark />
          <span>
            <strong className="block text-base tracking-wide sm:text-lg">THE SIGNAL SCHOOL</strong>
            <small className="block text-[11px] uppercase tracking-[.14em] text-emerald-100">
              Signal Regiment, Philippine Army
            </small>
          </span>
        </button>
        {step !== "landing" && (
          <button
            onClick={() => go(back)}
            className="flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10"
          >
            <ArrowLeft size={16} /> Back
          </button>
        )}
      </div>
    </header>
  );
}

function Progress({ step }: { step: Step }) {
  const idx = ["aor", "batch", "register", "confirm"].indexOf(step);
  return (
    <div className="mx-auto mb-8 grid max-w-3xl grid-cols-4 gap-2" aria-label="Registration progress">
      {["1 AOR", "2 Batch", "3 Registration", "4 Confirmation"].map((x, i) => (
        <div key={x} className="text-center">
          <div className={`mx-auto mb-2 h-1.5 rounded-full ${i <= idx ? "bg-[#0b7543]" : "bg-slate-200"}`} />
          <span className={`text-[11px] font-bold uppercase tracking-wide sm:text-xs ${i <= idx ? "text-[#075b32]" : "text-slate-400"}`}>
            {x}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const [step, setStep] = useState<Step>("landing");
  const [aorCode, setAorCode] = useState("");
  const [batchId, setBatchId] = useState("");
  const [draft, setDraftState] = useState<Draft>(getStoredDraft);
  const [confirmation, setConfirmation] = useState<Registration | null>(null);

  function setDraft(updater: React.SetStateAction<Draft>) {
    setDraftState((prev) => {
      const next = typeof updater === "function" ? (updater as (p: Draft) => Draft)(prev) : updater;
      persistDraft(next);
      return next;
    });
  }

  const batches = useMemo(() => BATCHES.filter((b) => b.aorCode === aorCode), [aorCode]);
  const selected = BATCHES.find((b) => b.batchId === batchId);

  function chooseAor(code: string) {
    setAorCode(code);
    setBatchId("");
    setStep("batch");
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Header step={step} go={setStep} />
      {step === "landing" ? (
        <Landing onStart={() => setStep("aor")} />
      ) : (
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <Progress step={step} />
          {step === "aor" && <AorSelection onSelect={chooseAor} />}
          {step === "batch" && (
            <BatchSelection
              aorCode={aorCode}
              batches={batches}
              onSelect={(id) => {
                setBatchId(id);
                setStep("register");
              }}
            />
          )}
          {step === "register" && selected && (
            <RegistrationForm
              batch={selected}
              draft={draft}
              setDraft={setDraft}
              onDone={(data) => {
                clearStoredDraft();
                setDraftState(emptyDraft);
                setConfirmation(data);
                setStep("confirm");
              }}
            />
          )}
          {step === "confirm" && confirmation && <Confirmation data={confirmation} />}
        </main>
      )}
      <Footer />
    </div>
  );
}

function Landing({ onStart }: { onStart: () => void }) {
  return (
    <main>
      <section className="relative overflow-hidden bg-[#062d20] text-white">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(120deg,transparent_45%,#1e8d58_45%,#1e8d58_46%,transparent_46%),radial-gradient(circle_at_80%_20%,#d8a62b_0,transparent_30%)]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.35fr_.65fr] md:py-16">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 border-l-4 border-yellow-400 bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-wider">
              <ShieldCheck size={18} /> TESDA Certification Opportunity
            </div>
            <h1 className="max-w-4xl text-4xl font-black uppercase leading-[1.04] tracking-tight sm:text-5xl lg:text-[3.5rem]">
              Artificial Intelligence Fundamentals and Applications
            </h1>
            <p className="mt-3 text-xl font-bold text-yellow-300 sm:text-2xl">In-House Training (AIFAT)</p>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50">
              Building AI-ready signalers through the practical and responsible use of generative AI, automation, data privacy, and ethics.
            </p>
            <button
              onClick={onStart}
              className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-yellow-500 bg-[#0c7a45] px-6 py-3 font-bold text-white shadow-lg hover:bg-[#09693b]"
            >
              Select your AOR <ArrowRight size={19} />
            </button>
          </div>
          <aside className="self-end border border-white/15 bg-black/20 p-6 backdrop-blur">
            <RadioTower className="mb-5 text-yellow-300" size={42} />
            <p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-200">Conducted by</p>
            <h2 className="mt-2 text-2xl font-black">The Signal School</h2>
            <p className="mt-3 leading-7 text-emerald-50">
              In collaboration with a TESDA-accredited training provider.
            </p>
            <p className="mt-4 border-t border-white/15 pt-4 text-sm text-emerald-100">
              Successful completers may qualify for the corresponding TESDA certification, subject to applicable requirements.
            </p>
          </aside>
        </div>
      </section>

      <section id="training" className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <p className="text-sm font-black uppercase tracking-[.2em] text-[#0b7543]">Training at a glance</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            [CalendarDays, "5 Days", "Training Duration"],
            [Clock3, "36 Academic Periods", "Academic Requirement"],
            [Bot, "Generative AI", "Training Area"],
            [Cpu, "AI-Enabled Automation", "Training Area"],
            [ShieldCheck, "Data Privacy and Ethics", "Training Area"],
          ].map(([I, a, b]) => {
            const Icon = I as typeof CalendarDays;
            return (
              <article key={a as string} className="border-t-4 border-[#0b7543] bg-white p-5 shadow-sm">
                <Icon className="text-[#0b7543]" />
                <h3 className="mt-4 font-black uppercase">{a as string}</h3>
                <p className="mt-1 text-sm text-slate-600">{b as string}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section id="about" className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[.72fr_1.28fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[.2em] text-[#0b7543]">About the training</p>
            <h2 className="mt-3 text-3xl font-black">Responsible AI capability for the workplace</h2>
          </div>
          <p className="text-lg leading-8 text-slate-700">
            AIFAT is a five-day training designed to develop the fundamental knowledge and practical skills of personnel in the effective and responsible use of Artificial Intelligence tools. It develops responsible AI-enabled users capable of applying available AI tools to selected workplace tasks while maintaining human judgment and accountability.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="text-sm font-black uppercase tracking-[.2em] text-[#0b7543]">Key training areas</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {[
            [
              Bot,
              "Generative AI",
              "Access and interact with generative AI tools, develop and refine prompts, and evaluate AI-generated outputs for workplace applications.",
            ],
            [
              Cpu,
              "AI-Enabled Automation",
              "Identify tasks suitable for automation and configure, test, monitor, and update basic AI-enabled workflows.",
            ],
            [
              ShieldCheck,
              "Data Privacy and Ethics",
              "Apply responsible AI use, data privacy, security, fairness, transparency, and accountability in the use of AI tools.",
            ],
          ].map(([I, a, b]) => {
            const Icon = I as typeof Bot;
            return (
              <article key={a as string} className="rounded-xl bg-[#073b27] p-6 text-white">
                <Icon className="text-yellow-300" size={32} />
                <h3 className="mt-5 text-xl font-black uppercase">{a as string}</h3>
                <p className="mt-3 leading-7 text-emerald-50">{b as string}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-8 flex flex-col items-start justify-between gap-4 border-l-4 border-yellow-500 bg-emerald-50 p-5 sm:flex-row sm:items-center">
          <p className="max-w-3xl font-semibold text-emerald-950">
            Ready to register? Select the AOR where your unit belongs to view authorized AIFAT batches.
          </p>
          <button
            onClick={onStart}
            className="flex min-h-12 shrink-0 items-center gap-2 rounded-lg bg-[#075b32] px-5 py-3 font-bold text-white"
          >
            Select your AOR <ArrowRight size={18} />
          </button>
        </div>
      </section>
    </main>
  );
}

function AorSelection({ onSelect }: { onSelect: (code: string) => void }) {
  return (
    <section>
      <p className="text-sm font-black uppercase tracking-[.18em] text-[#0b7543]">Step 1</p>
      <h1 className="mt-2 text-3xl font-black uppercase">Select Your Area of Responsibility (AOR)</h1>
      <p className="mt-2 text-slate-600">Select the AOR where your unit belongs to view the available AIFAT training batches.</p>
      <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {AORS.map(({ name, code }) => (
          <button
            key={code}
            onClick={() => onSelect(code)}
            className={`group min-h-28 rounded-xl border-2 bg-white p-4 text-left shadow-sm hover:border-[#0b7543] hover:shadow-md ${
              code === "T" ? "border-yellow-500" : "border-slate-200"
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Area of Responsibility</span>
            <strong className="mt-2 block text-xl group-hover:text-[#075b32]">{name}</strong>
            {code === "T" && <span className="mt-2 block text-xs font-bold text-[#075b32]">Online and Face-to-Face</span>}
          </button>
        ))}
      </div>
    </section>
  );
}

function BatchSelection({
  aorCode,
  batches,
  onSelect,
}: {
  aorCode: string;
  batches: Batch[];
  onSelect: (id: string) => void;
}) {
  const aor = AORS.find((a) => a.code === aorCode);
  return (
    <section>
      <div className="rounded-lg bg-slate-100 p-4">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Selected AOR</span>
        <strong className="ml-3 text-lg">{aor?.name}</strong>
      </div>
      <h1 className="mt-7 text-3xl font-black uppercase">Available Training Batches</h1>
      <p className="mt-2 text-slate-600">
        {aorCode === "T"
          ? "Online and face-to-face batches are available for NCR AOR."
          : "Only Online AM and Online PM batches are authorized for this AOR."}
      </p>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        {batches.map((batch) => (
          <BatchCard key={batch.batchId} batch={batch} onSelect={() => onSelect(batch.batchId)} />
        ))}
      </div>
    </section>
  );
}

function BatchCard({ batch, onSelect }: { batch: Batch; onSelect: () => void }) {
  const isExpired = Boolean(batch.registrationDeadline && Date.now() > Date.parse(batch.registrationDeadline));
  const isFull = batch.status === "FULL";
  const isClosed = batch.status === "CLOSED";
  const isDisabled = !batch.enabled;
  const canRegister = !isDisabled && !isExpired && !isFull && !isClosed && (batch.status === "OPEN" || batch.status === "NEARLY FULL");

  let badgeText: string = batch.status;
  let badgeClasses = "bg-emerald-100 text-emerald-900 border border-emerald-300";
  let buttonLabel = "Select this batch";

  if (isDisabled) {
    badgeText = "UNAVAILABLE";
    badgeClasses = "bg-slate-200 text-slate-700 border border-slate-300";
    buttonLabel = "Batch Unavailable";
  } else if (isExpired) {
    badgeText = "REGISTRATION ENDED";
    badgeClasses = "bg-amber-100 text-amber-900 border border-amber-300";
    buttonLabel = "Registration Ended";
  } else if (isFull) {
    badgeText = "FULL";
    badgeClasses = "bg-red-100 text-red-900 border border-red-300";
    buttonLabel = "Batch Full";
  } else if (isClosed) {
    badgeText = "CLOSED";
    badgeClasses = "bg-slate-200 text-slate-800 border border-slate-300";
    buttonLabel = "Registration Closed";
  } else if (batch.status === "NEARLY FULL") {
    badgeClasses = "bg-amber-100 text-amber-900 border border-amber-300";
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#0b7543]">{batch.classDesignation}</p>
          <h2 className="mt-1 text-xl font-black">
            {batch.deliveryMode} {batch.session}
          </h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClasses}`}>{badgeText}</span>
      </div>
      <dl className="mt-5 grid gap-3 text-sm text-slate-700">
        <div className="flex gap-2">
          <CalendarDays size={18} />
          <span>{batch.startDate}–{batch.endDate}</span>
        </div>
        <div className="flex gap-2">
          <Clock3 size={18} />
          <span>{batch.startTime}–{batch.endTime}</span>
        </div>
        <div className="flex gap-2">
          <MapPin size={18} />
          <span>{batch.venue}</span>
        </div>
        <div className="flex gap-2">
          <Users size={18} />
          <span>Maximum capacity: {batch.capacity ?? "To be announced"}</span>
        </div>
        <div>
          <strong>Registration deadline:</strong> {batch.registrationDeadline ?? "To be announced"}
        </div>
      </dl>
      <button
        disabled={!canRegister}
        onClick={onSelect}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#075b32] px-4 py-3 font-bold text-white transition hover:bg-[#064e2b] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 disabled:hover:bg-slate-300"
      >
        {buttonLabel} {canRegister && <ArrowRight size={18} />}
      </button>
    </article>
  );
}

function RegistrationForm({
  batch,
  draft,
  setDraft,
  onDone,
}: {
  batch: Batch;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onDone: (r: Registration) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function change<K extends keyof Draft>(name: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [name]: value }));
  }

  const clientCalculatedAge = useMemo(() => calculateAge(draft.birthdate), [draft.birthdate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");

    if (draft.consent !== true) {
      setError("The required personal information cannot be processed without the necessary privacy consent.");
      setBusy(false);
      return;
    }

    if (!draft.applicantCertified) {
      setError("You must certify that the information provided is true and correct.");
      setBusy(false);
      return;
    }

    if (!draft.lastName.trim() || !draft.firstName.trim()) {
      setError("Last Name and First Name are required.");
      setBusy(false);
      return;
    }

    if (!draft.street.trim() || !draft.barangay.trim() || !draft.cityMunicipality.trim() || !draft.province.trim() || !draft.region.trim()) {
      setError("Complete permanent mailing address is required.");
      setBusy(false);
      return;
    }

    if (!draft.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) {
      setError("Please enter a valid email address.");
      setBusy(false);
      return;
    }

    if (!draft.contactNumber.trim() || !/^[0-9+() -]{7,20}$/.test(draft.contactNumber.trim())) {
      setError("Please enter a valid contact number (7 to 20 digits).");
      setBusy(false);
      return;
    }

    if (!draft.sex) {
      setError("Please select your sex.");
      setBusy(false);
      return;
    }

    if (!draft.civilStatus) {
      setError("Please select your civil status.");
      setBusy(false);
      return;
    }

    if (!draft.birthdate || clientCalculatedAge === null || clientCalculatedAge < 15 || clientCalculatedAge > 100) {
      setError("Please enter a valid birthdate (trainee must be at least 15 years old).");
      setBusy(false);
      return;
    }

    if (!draft.birthCity.trim() || !draft.birthProvince.trim() || !draft.birthRegion.trim()) {
      setError("Birthplace city, province, and region are required.");
      setBusy(false);
      return;
    }

    if (!draft.employmentStatus) {
      setError("Please select your employment status before training.");
      setBusy(false);
      return;
    }

    if ((draft.employmentStatus === "Wage-Employed" || draft.employmentStatus === "Underemployed") && (!draft.employmentType || draft.employmentType === "None")) {
      setError("Please select your specific employment type.");
      setBusy(false);
      return;
    }

    if (!draft.educationalAttainment) {
      setError("Please select your highest educational attainment.");
      setBusy(false);
      return;
    }

    if (!draft.learnerClassification) {
      setError("Please select your learner classification.");
      setBusy(false);
      return;
    }

    if (draft.learnerClassification === "Others (Please Specify)" && !draft.classificationOthers.trim()) {
      setError("Please specify your learner classification.");
      setBusy(false);
      return;
    }

    if (draft.isScholar && !draft.scholarshipPackage) {
      setError("Please select your scholarship package.");
      setBusy(false);
      return;
    }

    if (draft.isScholar && draft.scholarshipPackage === "Others" && !draft.scholarshipPackageOthers.trim()) {
      setError("Please specify your scholarship package name.");
      setBusy(false);
      return;
    }

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          aor: batch.aorCode,
          batchId: batch.batchId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration could not be completed.");
      }
      onDone(data.registration);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration could not be completed.");
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="mb-6">
        <p className="text-sm font-black uppercase tracking-[.18em] text-[#0b7543]">Step 3</p>
        <h1 className="mt-1 text-3xl font-black uppercase">Registration Form — Learner's Profile</h1>
        <p className="text-xs font-semibold text-slate-500">
          Technical Education and Skills Development Authority (TESDA MIS 03-01, ver. 2021)
        </p>
      </div>

      {/* COMPACT SECTION ORIENTATION INDICATOR */}
      <nav aria-label="Form section orientation" className="sticky top-16 z-20 mb-6 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm backdrop-blur text-xs">
        {[
          { id: "sec-learner-profile", label: "Learner Profile", num: "1" },
          { id: "sec-personal-info", label: "Personal Information", num: "2" },
          { id: "sec-classification", label: "Classification", num: "3" },
          { id: "sec-scholarship", label: "Training / Scholarship", num: "4" },
          { id: "sec-consent", label: "Consent & Declaration", num: "5" },
        ].map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-bold text-slate-700 hover:bg-emerald-50 hover:text-[#075b32] transition"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] text-slate-600 font-bold">
              {s.num}
            </span>
            {s.label}
          </a>
        ))}
      </nav>

      {/* READ-ONLY SELECTED TRAINING SUMMARY */}
      <div className="mb-8 rounded-xl border border-emerald-300/80 bg-[#062d20] p-6 text-white shadow">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-white/15 pb-4">
          <div>
            <span className="rounded bg-yellow-400/20 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-yellow-300">
              Selected Training Class (Read-Only)
            </span>
            <h2 className="mt-2 text-xl font-black text-white">{batch.classDesignation}</h2>
          </div>
          <div className="text-left sm:text-right">
            <span className="inline-block rounded-full bg-emerald-100/20 px-3 py-1 text-xs font-bold text-emerald-200">
              {batch.deliveryMode} ({batch.session})
            </span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="text-emerald-200">Area of Responsibility:</span>
            <p className="font-bold text-white">{batch.aorName}</p>
          </div>
          <div>
            <span className="text-emerald-200">Training Schedule:</span>
            <p className="font-bold text-white">{batch.startDate} – {batch.endDate}</p>
          </div>
          <div>
            <span className="text-emerald-200">Session Hours:</span>
            <p className="font-bold text-white">{batch.startTime} – {batch.endTime}</p>
          </div>
          <div>
            <span className="text-emerald-200">Training Venue:</span>
            <p className="font-bold text-white">{batch.venue}</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-8">
        {/* SECTION 1: LEARNER PROFILE */}
        <section id="sec-learner-profile" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-black uppercase text-slate-900">1. Learner Profile</h2>
            <p className="text-xs text-slate-500">Full legal name, complete permanent mailing address, and contact details.</p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">Last Name *</label>
              <input
                type="text"
                required
                value={draft.lastName}
                onChange={(e) => change("lastName", e.target.value)}
                placeholder="e.g. DELA CRUZ"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">First Name *</label>
              <input
                type="text"
                required
                value={draft.firstName}
                onChange={(e) => change("firstName", e.target.value)}
                placeholder="e.g. JUAN"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">Middle Name</label>
              <input
                type="text"
                value={draft.middleName}
                onChange={(e) => change("middleName", e.target.value)}
                placeholder="e.g. SANTOS"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">Extension Name (Jr., Sr., etc.)</label>
              <input
                type="text"
                value={draft.extensionName}
                onChange={(e) => change("extensionName", e.target.value)}
                placeholder="e.g. Jr., III"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
            </div>
          </div>

          {/* Address */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-black uppercase text-[#075b32]">Complete Permanent Mailing Address</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700">Number, Street *</label>
                <input
                  type="text"
                  required
                  value={draft.street}
                  onChange={(e) => change("street", e.target.value)}
                  placeholder="House/Building No., Street"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Barangay *</label>
                <input
                  type="text"
                  required
                  value={draft.barangay}
                  onChange={(e) => change("barangay", e.target.value)}
                  placeholder="Enter barangay"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">District (Optional)</label>
                <input
                  type="text"
                  value={draft.district}
                  onChange={(e) => change("district", e.target.value)}
                  placeholder="Enter district (optional)"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">City / Municipality *</label>
                <input
                  type="text"
                  required
                  value={draft.cityMunicipality}
                  onChange={(e) => change("cityMunicipality", e.target.value)}
                  placeholder="Enter city or municipality"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Province *</label>
                <input
                  type="text"
                  required
                  value={draft.province}
                  onChange={(e) => change("province", e.target.value)}
                  placeholder="Enter province"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Region *</label>
                <input
                  type="text"
                  required
                  value={draft.region}
                  onChange={(e) => change("region", e.target.value)}
                  placeholder="Enter or select region"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-black uppercase text-[#075b32]">Contact & Nationality</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-bold text-slate-700">Email Address *</label>
                <input
                  type="email"
                  required
                  value={draft.email}
                  onChange={(e) => change("email", e.target.value)}
                  placeholder="e.g. name@example.com"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Contact Number *</label>
                <input
                  type="tel"
                  required
                  pattern="[0-9+() -]{7,20}"
                  value={draft.contactNumber}
                  onChange={(e) => change("contactNumber", e.target.value)}
                  placeholder="e.g. 0917 123 4567"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700">Nationality *</label>
                <input
                  type="text"
                  required
                  value={draft.nationality}
                  onChange={(e) => change("nationality", e.target.value)}
                  placeholder="Filipino"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: PERSONAL INFORMATION */}
        <section id="sec-personal-info" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-black uppercase text-slate-900">2. Personal Information</h2>
            <p className="text-xs text-slate-500">Demographic details, birthdate, birth location, and educational background.</p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-slate-700">Sex *</label>
              <select
                required
                value={draft.sex}
                onChange={(e) => change("sex", e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold"
              >
                <option value="" disabled>Select Sex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Civil Status *</label>
              <select
                required
                value={draft.civilStatus}
                onChange={(e) => change("civilStatus", e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold"
              >
                <option value="" disabled>Select Civil Status</option>
                {TESDA_CIVIL_STATUSES.map((cs) => (
                  <option key={cs} value={cs}>{cs}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Birthdate *</label>
              <input
                type="date"
                required
                value={draft.birthdate}
                onChange={(e) => change("birthdate", e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
              {clientCalculatedAge !== null && (
                <span className={`mt-1 block text-[11px] font-bold ${clientCalculatedAge < 15 ? "text-red-600" : "text-[#075b32]"}`}>
                  Calculated Age: {clientCalculatedAge} years old {clientCalculatedAge < 15 && "(Must be at least 15 yrs old)"}
                </span>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Birthplace: City / Municipality *</label>
              <input
                type="text"
                required
                value={draft.birthCity}
                onChange={(e) => change("birthCity", e.target.value)}
                placeholder="Enter birth city or municipality"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Birthplace: Province *</label>
              <input
                type="text"
                required
                value={draft.birthProvince}
                onChange={(e) => change("birthProvince", e.target.value)}
                placeholder="Enter birth province"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700">Birthplace: Region *</label>
              <input
                type="text"
                required
                value={draft.birthRegion}
                onChange={(e) => change("birthRegion", e.target.value)}
                placeholder="Enter birth region"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
            </div>
          </div>
        </section>

        {/* SECTION 3: EMPLOYMENT BEFORE TRAINING */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-black uppercase text-slate-900">3. Employment Before Training</h2>
            <p className="text-xs text-slate-500">Employment background prior to training commencement.</p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700">Employment Status *</label>
              <select
                required
                value={draft.employmentStatus}
                onChange={(e) => {
                  const s = e.target.value;
                  change("employmentStatus", s);
                  if (s !== "Wage-Employed" && s !== "Underemployed") {
                    change("employmentType", "None");
                  }
                }}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold"
              >
                <option value="" disabled>Select Employment Status</option>
                {TESDA_EMPLOYMENT_STATUSES.map((es) => (
                  <option key={es} value={es}>{es}</option>
                ))}
              </select>
            </div>

            {(draft.employmentStatus === "Wage-Employed" || draft.employmentStatus === "Underemployed") && (
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Employment Type * (Applicable for Wage-Employed/Underemployed)
                </label>
                <select
                  required
                  value={draft.employmentType}
                  onChange={(e) => change("employmentType", e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold"
                >
                  <option value="" disabled>Select Employment Type</option>
                  {TESDA_EMPLOYMENT_TYPES.map((et) => (
                    <option key={et} value={et}>{et}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>

        {/* SECTION 4: EDUCATIONAL ATTAINMENT */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-black uppercase text-slate-900">4. Educational Attainment Before Training</h2>
            <p className="text-xs text-slate-500">Highest educational level completed.</p>
          </div>

          <div className="mt-5">
            <label className="block text-xs font-bold text-slate-700">Educational Attainment *</label>
            <select
              required
              value={draft.educationalAttainment}
              onChange={(e) => change("educationalAttainment", e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold"
            >
              <option value="" disabled>Select Highest Attainment</option>
              {TESDA_EDUCATIONAL_ATTAINMENTS.map((ea) => (
                <option key={ea} value={ea}>{ea}</option>
              ))}
            </select>
          </div>
        </section>

        {/* SECTION 5: PARENT / GUARDIAN (OPTIONAL) */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black uppercase text-slate-900">5. Parent / Guardian</h2>
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
                Optional / Pending Requirement
              </span>
            </div>
            <p className="text-xs text-slate-500">Parent or guardian contact details as requested on the TESDA profile form.</p>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700">Parent / Guardian Full Name</label>
              <input
                type="text"
                value={draft.parentGuardianName}
                onChange={(e) => change("parentGuardianName", e.target.value)}
                placeholder="Enter parent or guardian full name (optional)"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">Complete Permanent Mailing Address</label>
              <input
                type="text"
                value={draft.parentGuardianAddress}
                onChange={(e) => change("parentGuardianAddress", e.target.value)}
                placeholder="Enter complete address (optional)"
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
              />
            </div>
          </div>
        </section>

        {/* SECTION 3: LEARNER CLASSIFICATION */}
        <section id="sec-classification" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-black uppercase text-slate-900">3. Learner Classification</h2>
            <p className="text-xs text-slate-500">Select the applicable classification from the official TESDA list.</p>
          </div>

          <div className="mt-5">
            <label className="block text-xs font-bold text-slate-700">Learner Classification *</label>
            <select
              required
              value={draft.learnerClassification}
              onChange={(e) => change("learnerClassification", e.target.value)}
              className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold"
            >
              <option value="" disabled>Select Classification</option>
              {TESDA_LEARNER_CLASSIFICATIONS.map((lc) => (
                <option key={lc} value={lc}>{lc}</option>
              ))}
            </select>

            {draft.learnerClassification === "Others (Please Specify)" && (
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-700">Specify Classification *</label>
                <input
                  type="text"
                  required
                  value={draft.classificationOthers}
                  onChange={(e) => change("classificationOthers", e.target.value)}
                  placeholder="Please state your specific learner classification"
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-xs"
                />
              </div>
            )}
          </div>
        </section>

        {/* SECTION 4: TRAINING & SCHOLARSHIP INFORMATION */}
        <section id="sec-scholarship" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">
              System Populated
            </span>
            <h2 className="mt-1 text-base font-black uppercase text-slate-900">4. Training & Scholarship Information</h2>
            <p className="text-xs text-slate-500">Official course qualification and approved scholarship program details.</p>
          </div>
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Enrolled Training Title</span>
            <p className="mt-1 text-base font-black text-[#075b32]">{DEFAULT_COURSE_QUALIFICATION}</p>
          </div>
        </section>

        {/* SECTION 8: SCHOLARSHIP INFORMATION */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-black uppercase text-slate-900">8. Scholarship Package</h2>
            <p className="text-xs text-slate-500">Indicate whether your enrollment is under an approved scholarship program.</p>
          </div>

          <div className="mt-5 space-y-4">
            <div>
              <span className="block text-xs font-bold text-slate-700 mb-2">
                Are you enrolled under a scholarship package? *
              </span>
              <div className="flex gap-6 text-xs font-bold text-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isScholar"
                    checked={draft.isScholar === true}
                    onChange={() => change("isScholar", true)}
                    className="h-4 w-4 accent-[#075b32]"
                  />
                  <span>Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="isScholar"
                    checked={draft.isScholar === false}
                    onChange={() => {
                      change("isScholar", false);
                      change("scholarshipPackage", "");
                      change("scholarshipPackageOthers", "");
                    }}
                    className="h-4 w-4 accent-[#075b32]"
                  />
                  <span>No</span>
                </label>
              </div>
            </div>

            {draft.isScholar && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2 rounded-lg bg-emerald-50/50 p-4 border border-emerald-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Type of Scholarship Package *</label>
                  <select
                    required
                    value={draft.scholarshipPackage}
                    onChange={(e) => change("scholarshipPackage", e.target.value)}
                    className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold"
                  >
                    <option value="" disabled>Select Scholarship Package</option>
                    {TESDA_SCHOLARSHIP_PACKAGES.map((sp) => (
                      <option key={sp} value={sp}>{sp}</option>
                    ))}
                  </select>
                </div>

                {draft.scholarshipPackage === "Others" && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700">Specify Scholarship Package *</label>
                    <input
                      type="text"
                      required
                      value={draft.scholarshipPackageOthers}
                      onChange={(e) => change("scholarshipPackageOthers", e.target.value)}
                      placeholder="e.g. Program Name"
                      className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* SECTION 5: PRIVACY CONSENT AND DECLARATION */}
        <section id="sec-consent" className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-base font-black uppercase text-slate-900">5. Privacy Consent & Applicant Declaration</h2>
            <p className="text-xs text-slate-500">Legal data processing agreement and accuracy certification.</p>
          </div>

          <div className="mt-5 space-y-5">
            <details className="rounded-lg bg-slate-50 p-4 text-xs text-slate-700 leading-relaxed" open>
              <summary className="cursor-pointer font-bold text-[#075b32] mb-2">
                TESDA Data Privacy Notice
              </summary>
              <p>
                In compliance with the Data Privacy Act of 2012 (Republic Act No. 10173), personal information and learner profile data collected through this portal are processed strictly for legitimate training administration, learner records encoding, evaluation, and endorsement for TESDA certification opportunity, subject to applicable requirements, conducted by The Signal School in collaboration with a TESDA-accredited training provider.
              </p>
            </details>

            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="block text-xs font-bold text-slate-800">Privacy Agreement *</span>
                {draft.consent === null && (
                  <span className="text-[11px] font-bold text-slate-400 italic">Please make an explicit selection</span>
                )}
              </div>
              <div className="flex gap-6 text-xs font-bold text-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="consent"
                    checked={draft.consent === true}
                    onChange={() => change("consent", true)}
                    className="h-4 w-4 accent-[#075b32]"
                  />
                  <span>Agree</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="consent"
                    checked={draft.consent === false}
                    onChange={() => change("consent", false)}
                    className="h-4 w-4 accent-red-600"
                  />
                  <span>Disagree</span>
                </label>
              </div>

              {draft.consent === false && (
                <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-bold">Consent Required for Registration</p>
                      <p className="mt-0.5 text-amber-800">
                        The required personal information and trainee profile cannot be processed or registered without the necessary consent under the Data Privacy Act. You must choose &ldquo;Agree&rdquo; to complete course enrollment.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 text-xs leading-5 text-emerald-950 cursor-pointer">
              <input
                type="checkbox"
                required
                checked={draft.applicantCertified}
                onChange={(e) => change("applicantCertified", e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#075b32]"
              />
              <span className="font-bold">
                Applicant Certification: I certify that the information I have provided in this Registration Form - Learner&apos;s Profile (TESDA MIS 03-01) is true and correct.
              </span>
            </label>

            {error && (
              <div role="alert" className="rounded-lg bg-red-50 p-4 text-xs font-bold text-red-800">
                {error}
              </div>
            )}

            <button
              disabled={busy || draft.consent !== true || !draft.applicantCertified}
              type="submit"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#075b32] px-5 py-3 text-sm font-bold text-white hover:bg-[#054927] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Submitting Registration…" : "Submit Registration"} <ArrowRight size={18} />
            </button>
          </div>
        </section>
      </form>
    </section>
  );
}

function Confirmation({ data }: { data: Registration }) {
  const b = BATCHES.find((x) => x.batchId === data.batchId)!;
  const verifyUrl = `/verify/${encodeURIComponent(data.referenceNumber)}`;

  return (
    <section className="mx-auto max-w-3xl">
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-10">
        <div className="text-center">
          <CheckCircle2 className="mx-auto text-[#0b7543]" size={64} />
          <p className="mt-4 text-sm font-black uppercase tracking-[.18em] text-[#0b7543]">
            Registration Successful
          </p>
          <h1 className="mt-2 text-3xl font-black">You are registered for AIFAT</h1>
          <p className="mt-2 text-slate-600 text-sm">
            Your TESDA Learners Profile has been recorded. Retain your reference number and monitor your registered email address for further training instructions.
          </p>
        </div>

        <div className="mt-8 rounded-xl bg-slate-50 p-5 sm:p-7">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Reference Number</p>
          <p className="mt-1 break-all text-2xl font-black tracking-wide text-[#075b32]">{data.referenceNumber}</p>

          <dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
            {[
              ["Learner Full Name", data.fullName],
              ["Email Address", data.email],
              ["Contact Number", data.contactNumber],
              ["Course / Qualification", data.courseQualification || DEFAULT_COURSE_QUALIFICATION],
              ["Area of Responsibility", b?.aorName || data.aor],
              ["Class Designation", b?.classDesignation || data.classDesignation],
              ["Delivery Mode", b?.deliveryMode || data.deliveryMode],
              ["Session", b?.session || data.session],
              ["Training Dates", `${b?.startDate || data.startDate} – ${b?.endDate || data.endDate}`],
              ["Training Time", `${b?.startTime || data.startTime} – ${b?.endTime || data.endTime}`],
              ["Venue", b?.venue || data.venue],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-bold text-slate-500 text-xs">{k}</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <a
            href={verifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border-2 border-[#075b32] bg-white px-5 py-3 font-bold text-[#075b32] hover:bg-emerald-50 text-xs"
          >
            <ShieldCheck size={18} /> View Official Verification Record
          </a>
          <button
            onClick={() => window.print()}
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-[#075b32] px-5 py-3 font-bold text-white hover:bg-[#054927] text-xs"
          >
            <Check size={18} /> Print / Save Confirmation
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-12 border-t-4 border-yellow-500 bg-[#032d1d] text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Mark />
          <div>
            <strong>{DEFAULT_OPERATIONAL_CONFIG.officeName}</strong>
            <p className="text-xs text-emerald-100">{DEFAULT_OPERATIONAL_CONFIG.officeAddress}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <p className="text-sm font-bold uppercase tracking-[.16em] text-yellow-300">Honor. Patriotism. Duty.</p>
          <a href="/admin/login" className="text-xs font-semibold text-emerald-300/60 hover:text-emerald-200">
            Administration Portal
          </a>
        </div>
      </div>
    </footer>
  );
}
