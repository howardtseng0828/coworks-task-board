import { useCallback, useEffect, useState } from "react";
import type { NotificationItem } from "../types";
import { notificationService } from "../services/notificationService";

const REFRESH_INTERVAL_MS = 30_000;

const parseError = (error: unknown) =>
  error instanceof Error ? error.message : "Failed to load notifications.";

export const useNotifications = (enabled: boolean) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!enabled) {
      setNotifications([]);
      setUnreadCount(0);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const payload = await notificationService.getNotifications(20);
      setNotifications(payload.items);
      setUnreadCount(payload.unreadCount);
    } catch (requestError) {
      setError(parseError(requestError));
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  const markAsRead = useCallback(
    async (notificationId: number) => {
      if (!enabled) {
        return;
      }

      setNotifications((prev) =>
        prev.map((item) => (item.id === notificationId ? { ...item, isRead: true } : item))
      );
      setUnreadCount((prev) => Math.max(prev - 1, 0));

      try {
        await notificationService.markNotificationRead(notificationId);
      } catch {
        await loadNotifications();
      }
    },
    [enabled, loadNotifications]
  );

  const markAllAsRead = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await notificationService.markAllNotificationsRead();
    } catch {
      await loadNotifications();
    }
  }, [enabled, loadNotifications]);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setError(null);
      return;
    }

    void loadNotifications();
    const timer = setInterval(() => {
      void loadNotifications();
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [enabled, loadNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    reload: loadNotifications,
    markAsRead,
    markAllAsRead
  };
};
