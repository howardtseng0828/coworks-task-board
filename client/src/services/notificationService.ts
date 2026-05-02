import type { NotificationSummary } from "../types";
import { apiRequest } from "./api";

export const notificationService = {
  getNotifications: (limit = 20) =>
    apiRequest<NotificationSummary>(`/notifications?limit=${encodeURIComponent(String(limit))}`),

  markNotificationRead: (notificationId: number) =>
    apiRequest<{ updated: boolean }>(`/notifications/${notificationId}/read`, {
      method: "PATCH"
    }),

  markAllNotificationsRead: () =>
    apiRequest<{ updatedCount: number }>("/notifications/read-all", {
      method: "POST"
    })
};

