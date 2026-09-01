import { useAuthStore } from "../store/authStore.js";
import { register as registerRequest, login as loginRequest } from "../api/endpoints/auth.js";

// Wraps the store + endpoint calls so a component just calls
// login(...)/register(...) without knowing about axios or tokens.
export function useAuth() {
  const { user, organization, accessToken, setAuth, clearAuth } = useAuthStore();

  async function login(credentials) {
    const result = await loginRequest(credentials);
    setAuth(result);
    return result;
  }

  async function register(details) {
    const result = await registerRequest(details);
    setAuth(result);
    return result;
  }

  function logout() {
    clearAuth();
  }

  return {
    user,
    organization,
    isAuthenticated: Boolean(accessToken),
    login,
    register,
    logout
  };
}