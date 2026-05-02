import type { AuthUser } from "../types";
import { API_BASE, apiRequest } from "./api";

const getApiRoot = () => {
  if (API_BASE.startsWith("http://") || API_BASE.startsWith("https://")) {
    return API_BASE;
  }
  return API_BASE.startsWith("/") ? API_BASE : `/${API_BASE}`;
};

export const authService = {
  getCurrentUser: () => apiRequest<AuthUser>("/auth/me"),

  loginWithHht: (payload: { userNo: string; password: string }) =>
    apiRequest<AuthUser>("/auth/hht/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  linkInternal: (payload: { userNo: string; password: string }) =>
    apiRequest<AuthUser>("/auth/hht/link", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  logout: () =>
    apiRequest<void>("/auth/logout", {
      method: "POST"
    }),

  getLineLoginUrl: (redirectUrl: string) => {
    const root = getApiRoot();
    return `${root}/auth/line/login?redirect=${encodeURIComponent(redirectUrl)}`;
  },

  getLineLinkUrl: (redirectUrl: string) => {
    const root = getApiRoot();
    return `${root}/auth/line/link?redirect=${encodeURIComponent(redirectUrl)}`;
  }
};
