import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { Header } from "./Header.jsx";

// The shell every protected page renders inside. Sidebar + Header
// are always present; <Outlet /> swaps in whichever page matched
// the current route.
export function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-main">
        <Header />
        <main className="app-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}