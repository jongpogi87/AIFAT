"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, CheckCircle2, Clock3, Laptop, MapPin, RadioTower, ShieldCheck, Sparkles, Users } from "lucide-react";

type Step = "landing" | "aor" | "batch" | "register" | "confirm";
type Registration = { referenceNumber: string; fullName: string; rank: string; unit: string; email: string; contactNumber: string; serviceCategory: string; aor: string; batchId: string };
const AORS = [..."ABCDEFGHIJK", "TSS"];
const schedule = "14–25 September 2026";
const allBatches = [
  { id: "online-am", name: "Online AM", mode: "Online", time: "0800–1200H", icon: Laptop },
  { id: "online-pm", name: "Online PM", mode: "Online", time: "1300–1700H", icon: Laptop },
  { id: "f2f-am", name: "Face-to-Face AM", mode: "Face-to-Face", time: "0800–1200H", icon: Users },
  { id: "f2f-pm", name: "Face-to-Face PM", mode: "Face-to-Face", time: "1300–1700H", icon: Users },
];

function Mark() { return <div className="grid h-12 w-12 shrink-0 place-items-center border border-yellow-400/60 bg-emerald-950 text-sm font-black tracking-widest text-yellow-300">TSS</div>; }
function Header({ step, go }: { step: Step; go: (s: Step) => void }) {
  return <header className="sticky top-0 z-30 border-b border-white/10 bg-[#043421]/95 text-white backdrop-blur">
    <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
      <button onClick={() => go("landing")} className="flex items-center gap-3 text-left" aria-label="Return to home"><Mark/><span><strong className="block text-base tracking-wide sm:text-lg">THE SIGNAL SCHOOL</strong><small className="block text-[11px] uppercase tracking-[.14em] text-emerald-100">Signal Regiment, Philippine Army</small></span></button>
      {step !== "landing" && <button onClick={() => go(step === "aor" ? "landing" : step === "batch" ? "aor" : "batch")} className="flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10"><ArrowLeft size={16}/> Back</button>}
    </div>
  </header>;
}
function Progress({ step }: { step: Step }) {
  const idx = ["aor","batch","register","confirm"].indexOf(step);
  return <div className="mx-auto mb-7 grid max-w-3xl grid-cols-4 gap-2" aria-label="Registration progress">
    {["AOR", "Batch", "Details", "Confirmed"].map((x,i)=><div key={x} className="text-center"><div className={`mx-auto mb-2 h-1.5 rounded-full ${i<=idx?"bg-[#0b7543]":"bg-slate-200"}`}/><span className={`text-xs font-bold uppercase tracking-wider ${i<=idx?"text-[#075b32]":"text-slate-400"}`}>{x}</span></div>)}
  </div>;
}

export default function Home() {
  const [step,setStep]=useState<Step>("landing"); const [aor,setAor]=useState(""); const [batchId,setBatchId]=useState(""); const [confirmation,setConfirmation]=useState<Registration|null>(null);
  const batches=useMemo(()=>aor==="TSS"?allBatches:allBatches.slice(0,2),[aor]);
  const selectedBatch=allBatches.find(b=>b.id===batchId);
  const go=(s:Step)=>setStep(s);
  return <div className="min-h-screen"><Header step={step} go={go}/>
    {step==="landing" ? <main>
      <section className="relative overflow-hidden bg-[#062d20] text-white">
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(120deg,transparent_45%,#1e8d58_45%,#1e8d58_46%,transparent_46%),radial-gradient(circle_at_80%_20%,#d8a62b_0,transparent_30%)]"/>
        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.35fr_.65fr] md:py-20">
          <div><div className="mb-5 inline-flex items-center gap-2 border-l-4 border-yellow-400 bg-white/10 px-4 py-2 text-sm font-bold uppercase tracking-wider"><ShieldCheck size={18}/> TESDA certification opportunity</div>
          <h1 className="max-w-4xl text-4xl font-black uppercase leading-[1.05] tracking-tight sm:text-6xl">Artificial Intelligence Fundamentals and Applications</h1>
          <p className="mt-3 text-xl font-bold text-yellow-300 sm:text-2xl">In-House Training (AIFAT)</p>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50">Building AI-ready signalers through practical, responsible use of generative AI, automation, data privacy, and ethics.</p>
          <button onClick={()=>go("aor")} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#0c7a45] px-6 py-3 font-bold text-white shadow-lg hover:bg-[#09693b]">Select your AOR <ArrowRight size={19}/></button></div>
          <aside className="self-end border border-white/15 bg-black/20 p-6 backdrop-blur"><RadioTower className="mb-5 text-yellow-300" size={42}/><p className="text-sm font-bold uppercase tracking-[.18em] text-emerald-200">Conducted by</p><h2 className="mt-2 text-2xl font-black">The Signal School</h2><p className="mt-3 leading-7 text-emerald-50">In collaboration with a TESDA-accredited training provider.</p></aside>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[[CalendarDays,"5 training days","36 academic periods"],[Users,"All personnel","Signal Regiment and subordinate units"],[MapPin,"TSS / Online","As announced per batch"],[BookOpen,"Practical coverage","AI, automation, privacy and ethics"]].map(([I,a,b])=>{const Icon=I as typeof CalendarDays;return <article key={a as string} className="border-t-4 border-[#0b7543] bg-white p-5 shadow-sm"><Icon className="text-[#0b7543]"/><h3 className="mt-4 font-black">{a as string}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{b as string}</p></article>})}
      </div></section>
    </main> : <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6"><Progress step={step}/>
      {step==="aor" && <section><p className="text-sm font-black uppercase tracking-[.18em] text-[#0b7543]">Step 1</p><h1 className="mt-2 text-3xl font-black">Select your Area of Responsibility</h1><p className="mt-2 text-slate-600">Choose the AOR code assigned to your unit to view eligible batches.</p><div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">{AORS.map(code=><button key={code} onClick={()=>{setAor(code);setBatchId("");go("batch")}} className="group min-h-32 rounded-xl border-2 border-slate-200 bg-white p-4 shadow-sm hover:border-[#0b7543] hover:shadow-md"><div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-emerald-50 font-black text-[#075b32] group-hover:bg-[#075b32] group-hover:text-white">{code}</div><strong className="mt-3 block">{code==="TSS"?"TSS / Centralized":`AOR ${code}`}</strong></button>)}</div></section>}
      {step==="batch" && <section><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-black uppercase tracking-[.18em] text-[#0b7543]">Step 2 · {aor==="TSS"?"TSS / Centralized":`AOR ${aor}`}</p><h1 className="mt-2 text-3xl font-black">Choose an available batch</h1></div><span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-900">{batches.length} available</span></div><p className="mt-2 text-slate-600">{aor==="TSS"?"Online and face-to-face schedules are available.":"AOR A–K registrations are online only."}</p><div className="mt-7 grid gap-4 md:grid-cols-2">{batches.map(b=>{const Icon=b.icon;return <article key={b.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div className="grid h-12 w-12 place-items-center rounded-lg bg-emerald-50 text-[#0b7543]"><Icon/></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold uppercase">25 slots</span></div><h2 className="mt-5 text-xl font-black">{b.name}</h2><div className="mt-4 space-y-2 text-sm text-slate-600"><p className="flex gap-2"><CalendarDays size={18}/> {schedule} (Mon–Fri)</p><p className="flex gap-2"><Clock3 size={18}/> {b.time}</p></div><button onClick={()=>{setBatchId(b.id);go("register")}} className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-[#075b32] px-4 py-3 font-bold text-white hover:bg-[#064b2a]">Select batch <ArrowRight size={18}/></button></article>})}</div></section>}
      {step==="register" && selectedBatch && <RegistrationForm aor={aor} batch={selectedBatch} onDone={r=>{setConfirmation(r);go("confirm")}}/>}
      {step==="confirm" && confirmation && <Confirmation data={confirmation}/>}
    </main>}
    <footer className="mt-12 border-t-4 border-yellow-500 bg-[#032d1d] text-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex items-center gap-3"><Mark/><div><strong>THE SIGNAL SCHOOL</strong><p className="text-xs text-emerald-100">Fort Andres Bonifacio, Taguig City</p></div></div><p className="text-sm font-bold uppercase tracking-[.16em] text-yellow-300">Honor. Patriotism. Duty.</p></div></footer>
  </div>;
}

function RegistrationForm({aor,batch,onDone}:{aor:string;batch:(typeof allBatches)[number];onDone:(r:Registration)=>void}){
 const [busy,setBusy]=useState(false);const [error,setError]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError("");const fd=new FormData(e.currentTarget);const payload=Object.fromEntries(fd);try{const res=await fetch("/api/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...payload,aor,batchId:batch.id,consent:fd.get("consent")==="on"})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Registration could not be completed.");onDone(data.registration)}catch(err){setError(err instanceof Error?err.message:"Registration could not be completed.");setBusy(false)}}
 return <section><p className="text-sm font-black uppercase tracking-[.18em] text-[#0b7543]">Step 3</p><h1 className="mt-2 text-3xl font-black">Learner registration</h1><div className="mt-7 grid gap-6 lg:grid-cols-[.38fr_.62fr]"><aside className="h-fit rounded-xl bg-[#073b27] p-6 text-white"><Sparkles className="text-yellow-300"/><h2 className="mt-4 text-xl font-black">{batch.name}</h2><p className="mt-1 font-bold text-emerald-200">{aor==="TSS"?"TSS / Centralized":`AOR ${aor}`}</p><div className="mt-5 space-y-3 border-t border-white/15 pt-5 text-sm"><p>{schedule}</p><p>{batch.time}</p><p>{batch.mode}</p></div><p className="mt-6 text-xs leading-5 text-emerald-100">Your selected AOR and batch are locked for this registration.</p></aside><form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"><div className="grid gap-5 sm:grid-cols-2">{[["fullName","Full name","text","DELA CRUZ, JUAN P."],["rank","Rank","text","CPT"],["unit","Unit / Organization","text","Signal Regiment, PA"],["email","Email address","email","name@example.com"],["contactNumber","Contact number","tel","09XX XXX XXXX"]].map(([n,l,t,p])=><label key={n} className={n==="fullName"?"sm:col-span-2":""}><span className="mb-2 block text-sm font-bold">{l} *</span><input name={n} type={t} placeholder={p} required maxLength={n==="fullName"?100:80} className="min-h-12 w-full rounded-lg border border-slate-300 px-3 focus:border-[#0b7543]"/></label>)}<label><span className="mb-2 block text-sm font-bold">Service category *</span><select name="serviceCategory" required defaultValue="" className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="" disabled>Select category</option><option>Officer</option><option>Enlisted Personnel</option><option>Civilian Human Resource</option></select></label></div><label className="mt-6 flex gap-3 text-sm leading-6"><input name="consent" type="checkbox" required className="mt-1 h-5 w-5 accent-[#075b32]"/><span>I confirm that the information provided is correct and consent to its processing for training administration and certification, in accordance with applicable data privacy laws.</span></label>{error&&<div role="alert" className="mt-5 rounded-lg bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}<button disabled={busy} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#075b32] px-5 py-3 font-bold text-white disabled:opacity-60">{busy?"Submitting…":"Submit registration"}<ArrowRight size={18}/></button></form></div></section>
}

function Confirmation({data}:{data:Registration}){const b=allBatches.find(x=>x.id===data.batchId)!;return <section className="mx-auto max-w-3xl"><div className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm sm:p-10"><div className="text-center"><CheckCircle2 className="mx-auto text-[#0b7543]" size={64}/><p className="mt-4 text-sm font-black uppercase tracking-[.18em] text-[#0b7543]">Registration successful</p><h1 className="mt-2 text-3xl font-black">You’re registered for AIFAT</h1><p className="mt-2 text-slate-600">Keep your reference number for verification.</p></div><div className="mt-8 rounded-xl bg-slate-50 p-5 sm:p-7"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Reference number</p><p className="mt-1 text-2xl font-black tracking-wide text-[#075b32]">{data.referenceNumber}</p><dl className="mt-6 grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2">{[["Name",data.fullName],["Rank",data.rank],["Unit / Organization",data.unit],["AOR",data.aor==="TSS"?"TSS / Centralized":`AOR ${data.aor}`],["Batch",b.name],["Schedule",`${schedule} · ${b.time}`]].map(([k,v])=><div key={k}><dt className="font-bold text-slate-500">{k}</dt><dd className="mt-1 font-semibold">{v}</dd></div>)}</dl></div><button onClick={()=>window.print()} className="mt-7 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#075b32] px-5 py-3 font-bold text-white"><Check size={18}/> Print / save confirmation</button></div></section>}
