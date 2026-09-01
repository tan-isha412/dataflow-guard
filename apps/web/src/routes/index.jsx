import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute.jsx";
import { AppLayout } from "../components/layout/AppLayout.jsx";
import { LoginPage } from "../pages/Login/LoginPage.jsx";
import { RegisterPage } from "../pages/Login/RegisterPage.jsx";
import { DashboardPage } from "../pages/Dashboard/DashboardPage.jsx";
import { PlaygroundPage } from "../pages/Playground/PlaygroundPage.jsx";
import { PoliciesPage } from "../pages/Policies/PoliciesPage.jsx";
import { DestinationsPage } from "../pages/Destinations/DestinationsPage.jsx";
import { ApprovalsPage } from "../pages/Approvals/ApprovalsPage.jsx";
import { AuditLogsPage } from "../pages/AuditLogs/AuditLogsPage.jsx";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/approvals", element: <ApprovalsPage /> },
{ path: "/audit", element: <AuditLogsPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/playground", element: <PlaygroundPage /> },
          { path: "/policies", element: <PoliciesPage /> },
          { path: "/destinations", element: <DestinationsPage /> }
          // /approvals and /audit routes added on Day 15 once those pages exist
        ]
      }
    ]
  }
]);