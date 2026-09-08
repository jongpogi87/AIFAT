import { RouterProvider, type RouteConfig } from "@/lib/router";
import Home from "@/app/page";
import AdminDashboardPage from "@/app/admin/page";
import AdminLoginPage from "@/app/admin/login/page";
import AdminBatchesPage from "@/app/admin/batches/page";
import AdminLearnersPage from "@/app/admin/learners/page";
import AdminReportsPage from "@/app/admin/reports/page";
import AdminSettingsPage from "@/app/admin/settings/page";
import VerifyPage from "@/components/verify-page";

const routes: RouteConfig[] = [
  { pattern: "/", component: Home },
  { pattern: "/admin", component: AdminDashboardPage },
  { pattern: "/admin/login", component: AdminLoginPage },
  { pattern: "/admin/batches", component: AdminBatchesPage },
  { pattern: "/admin/learners", component: AdminLearnersPage },
  { pattern: "/admin/reports", component: AdminReportsPage },
  { pattern: "/admin/settings", component: AdminSettingsPage },
  { pattern: "/verify/:ref", component: VerifyPage },
  { pattern: "/verify/:reference", component: VerifyPage },
];

export default function App() {
  return <RouterProvider routes={routes} fallback={Home} />;
}
