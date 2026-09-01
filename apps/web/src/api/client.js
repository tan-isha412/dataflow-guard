import axios from "axios";
import { useAuthStore } from "../store/authStore.js";

// The single choke point every API call passes through — same idea
// as db.js being the one shared Prisma instance on the backend.
export const apiClient = axios.create({
  baseURL: "/api/v1" // proxied to localhost:5000 by vite.config.js
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});