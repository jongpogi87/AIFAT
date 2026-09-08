import { useState } from "react";
import { useRouter } from "@/lib/router";
import { loginAdmin, requestAdminPasswordReset } from "@/lib/admin/admin-service";
import { ShieldCheck, Lock, Mail, ArrowRight } from "lucide-react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError("Administrative email is required.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setError("Please enter a valid administrative email address.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    setBusy(true);
    try {
      await loginAdmin(cleanEmail, password);
      router.push("/admin");
    } catch (err: any) {
      setError(err?.message || "Authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleForgotPassword() {
    setError("");
    setNotice("");

    const cleanEmail = email.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      setError("Please enter your administrative email address above to receive reset instructions.");
      return;
    }

    setResetBusy(true);
    try {
      const res = await requestAdminPasswordReset(cleanEmail);
      setNotice(res.message);
    } catch (err: any) {
      setError(err?.message || "Unable to process password reset.");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-[#062d20] px-4 py-12 text-white sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto grid h-16 w-16 place-items-center border-2 border-yellow-400/80 bg-emerald-950 text-xl font-black tracking-widest text-yellow-300 shadow-lg">
          TSS
        </div>
        <h1 className="mt-6 text-center text-2xl font-black uppercase tracking-wide">
          The Signal School
        </h1>
        <p className="mt-1 text-center text-xs uppercase tracking-[.18em] text-emerald-200">
          Signal Regiment, Philippine Army
        </p>
        <p className="mt-3 text-center text-sm font-semibold text-yellow-300">
          AIFAT Training Administration Portal
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-white/15 bg-black/30 p-6 shadow-2xl backdrop-blur sm:p-8">
          <div className="mb-6 flex items-center gap-2 border-b border-white/10 pb-4 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck size={16} /> Restricted Official Access
          </div>

          {process.env.NEXT_PUBLIC_LOCAL_DEV_ADMIN === "true" && (
            <div className="mb-6 rounded-lg border border-amber-500/50 bg-amber-950/40 p-3 text-xs text-amber-200">
              <div className="flex items-center justify-between font-bold">
                <span>🛠️ LOCAL DEV ADMIN MODE</span>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("admin@example.invalid");
                    setPassword("dev-admin-local");
                  }}
                  className="rounded border border-amber-400/40 bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-300 transition-colors hover:bg-amber-500/30"
                >
                  Fill Dev Credentials
                </button>
              </div>
              <p className="mt-1 text-[11px] text-amber-300/80">
                Memory-backed desktop preview active. Email: <code className="text-white">admin@example.invalid</code> | Password: <code className="text-white">dev-admin-local</code>
              </p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-100">
                Administrative Email
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-emerald-400">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter administrative email"
                  className="min-h-12 w-full rounded-lg border border-white/20 bg-white/10 pl-10 pr-3 text-sm text-white placeholder-white/40 focus:border-yellow-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-100">
                Password
              </label>
              <div className="relative mt-1">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-emerald-400">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="min-h-12 w-full rounded-lg border border-white/20 bg-white/10 pl-10 pr-3 text-sm text-white placeholder-white/40 focus:border-yellow-400 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetBusy || busy}
                className="text-xs font-semibold text-yellow-300 transition-colors hover:text-yellow-200 hover:underline disabled:opacity-50"
              >
                {resetBusy ? "Sending reset instructions…" : "Forgot password?"}
              </button>
            </div>

            {notice && (
              <div
                role="status"
                className="rounded-lg border border-emerald-500/40 bg-emerald-950/70 p-3 text-xs font-semibold text-emerald-200"
              >
                {notice}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-red-500/40 bg-red-950/60 p-3 text-xs font-semibold text-red-200"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-yellow-500 bg-[#0c7a45] px-4 py-3 text-sm font-bold text-white shadow hover:bg-[#09693b] disabled:opacity-50"
            >
              {busy ? "Authenticating…" : "Authenticate & Enter"} <ArrowRight size={16} />
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-emerald-300/80">
            Authorized for Signal Regiment designated training officers and administrative personnel only. Unauthorized access attempts are monitored and recorded.
          </p>
        </div>
      </div>
    </div>
  );
}
