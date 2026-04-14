import { Outlet } from "react-router-dom";
import { AppHeader } from "./components/layout/app-header";
import { AppSidebar } from "./components/layout/app-sidebar";

export function AppShell() {
  return (
    <div className="app-shell">
      <AppSidebar />
      <div className="app-shell__content">
        <AppHeader />
        <main className="app-shell__main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
