import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";

// The frontend's equivalent of requireAuth middleware — instead of
// the server rejecting a request with 401, the router redirects
// to /login before a protected page ever renders.
export function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}