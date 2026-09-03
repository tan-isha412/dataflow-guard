import { createBrowserRouter } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute.jsx";
import { AppLayout } from "../components/layout/AppLayout.jsx";
import { LoginPage } from "../pages/Login/LoginPage.jsx";
import { RegisterPage } from "../pages/Login/RegisterPage.jsx";
import { DashboardPage } from "../pages/Dashboard/DashboardPage.jsx";
import { PlaygroundPage } from "../pages/Playground/PlaygroundPage.jsx";
import { PoliciesPage } from "../pages/Policies/PoliciesPage.jsx";
import { DestinationsPage } from "../pages/Destinations/DestinationsPage.jsx";
import { ApprovalsPage } from "../pages/Approvals/ApprovalPage.jsx";
import { AuditLogsPage } from "../pages/AuditLogs/AuditLogsPage.jsx";
import { AnalyticsPage } from "../pages/Analytics/AnalyticsPage.jsx";
import { OrganizationPage } from "../pages/Organization/OrganizationPage.jsx";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/playground", element: <PlaygroundPage /> },
          { path: "/policies", element: <PoliciesPage /> },
          { path: "/destinations", element: <DestinationsPage /> },
          { path: "/approvals", element: <ApprovalsPage /> },
          { path: "/audit", element: <AuditLogsPage /> },
          { path: "/analytics", element: <AnalyticsPage /> },
          { path: "/organization", element: <OrganizationPage /> }
        ]
      }
    ]
  }
]);