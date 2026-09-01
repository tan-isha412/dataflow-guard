import { create } from "zustand";
import { persist } from "zustand/middleware";

// The frontend's equivalent of req.auth on the backend — one place
// the whole app reads "am I logged in, and as who." Persisted to
// localStorage so a page refresh doesn't log the user out.
export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      organization: null,
      accessToken: null,
      refreshToken: null,

      setAuth: ({ user, organization, accessToken, refreshToken }) =>
        set({ user, organization, accessToken, refreshToken }),

      clearAuth: () =>
        set({ user: null, organization: null, accessToken: null, refreshToken: null })
    }),
    { name: "dataflow-guardian-auth" }
  )
);