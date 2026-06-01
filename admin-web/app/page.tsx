import AdminDashboard from "../components/AdminDashboard";
import LoginPanel from "../components/LoginPanel";
import { listLicenses, listLiteTrials, listSupportTickets } from "../lib/backend";
import { hasAdminSession } from "../lib/session";

export default async function AdminHome() {
  const isAuthenticated = await hasAdminSession();

  if (!isAuthenticated) {
    return <LoginPanel />;
  }

  const [{ licenses }, { trials }, { tickets }] = await Promise.all([
    listLicenses(),
    listLiteTrials(),
    listSupportTickets(),
  ]);

  return <AdminDashboard initialLicenses={licenses} initialLiteTrials={trials} initialTickets={tickets} />;
}
