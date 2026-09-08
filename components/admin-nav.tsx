import { Link, usePathname, useRouter } from "@/lib/router";
import { logoutAdmin } from "@/lib/admin/admin-service";
import { LayoutDashboard, Layers, Users, FileText, Settings, LogOut, ExternalLink } from "lucide-react";

export function AdminNav({ username, role }: { username?: string; role?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    try {
      await logoutAdmin();
      router.push("/admin/login");
    } catch {
      router.push("/admin/login");
    }
  }

  const links = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/batches", label: "Batches", icon: Layers },
    { href: "/admin/learners", label: "Learner Roster", icon: Users },
    { href: "/admin/reports", label: "Reports & Export", icon: FileText },
    { href: "/admin/settings", label: "Operational Settings", icon: Settings },
  ];

  return (
    <header className="border-b border-white/10 bg-[#043421] text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center border border-yellow-400/60 bg-emerald-950 text-xs font-black tracking-widest text-yellow-300">
            TSS
          </div>
          <div>
            <span className="block text-sm font-black tracking-wide sm:text-base">
              THE SIGNAL SCHOOL <span className="ml-2 rounded bg-yellow-400/20 px-1.5 py-0.5 text-[10px] font-bold text-yellow-300">ADMIN</span>
            </span>
            <span className="block text-[11px] uppercase tracking-[.12em] text-emerald-100">
              AIFAT Training Administration Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/"
            target="_blank"
            className="hidden items-center gap-1 text-xs font-semibold text-emerald-200 hover:text-white sm:flex"
          >
            Public Portal <ExternalLink size={12} />
          </Link>
          <div className="hidden border-l border-white/15 pl-3 text-right text-xs sm:block">
            <span className="block font-bold">{username || "Administrator"}</span>
            <span className="block text-[10px] uppercase text-emerald-200">{role || "TSS Staff"}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex min-h-9 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-900/60"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </div>

      <nav className="border-t border-white/10 bg-[#032618]">
        <div className="mx-auto flex max-w-7xl space-x-1 overflow-x-auto px-4 sm:px-6">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-xs font-bold transition-colors ${
                  isActive
                    ? "border-yellow-400 bg-white/5 text-yellow-300"
                    : "border-transparent text-emerald-100 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
