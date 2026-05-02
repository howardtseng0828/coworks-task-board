import { execute, queryAll, queryOne } from "../db/database";
import type { NotificationItem } from "../models/types";

interface NotificationRow {
  ID: number | string;
  UserId: number;
  TaskSID: number | string;
  NotificationType: string;
  Message: string;
  IsRead: boolean | number;
  CreatedAt: string | Date;
  ReadAt: string | Date | null;
}

const toId = (value: number | string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const toIsoDateTime = (value: string | Date | null | undefined) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }
  return parsed.toISOString();
};

const mapRowToNotification = (row: NotificationRow): NotificationItem => ({
  id: toId(row.ID),
  userId: row.UserId,
  taskId: toId(row.TaskSID),
  type: row.NotificationType,
  message: row.Message,
  isRead: row.IsRead === true || Number(row.IsRead) === 1,
  createdAt: toIsoDateTime(row.CreatedAt) ?? new Date().toISOString(),
  readAt: toIsoDateTime(row.ReadAt)
});

export const listNotifications = async (userId: number, limit = 20) => {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const rows = await queryAll<NotificationRow>(
    `
      SELECT
        ID,
        UserId,
        TaskSID,
        NotificationType,
        Message,
        IsRead,
        CreatedAt,
        ReadAt
      FROM dbo.AR_LineTaskNotification
      WHERE UserId = @userId
      ORDER BY CreatedAt DESC, ID DESC
      OFFSET 0 ROWS FETCH NEXT @limit ROWS ONLY;
    `,
    { userId, limit: safeLimit }
  );

  const unreadRow = await queryOne<{ count: number }>(
    `
      SELECT COUNT(1) AS count
      FROM dbo.AR_LineTaskNotification
      WHERE UserId = @userId AND IsRead = 0;
    `,
    { userId }
  );

  return {
    items: rows.map(mapRowToNotification),
    unreadCount: unreadRow?.count ?? 0
  };
};

export const markNotificationAsRead = async (userId: number, notificationId: number) => {
  const result = await execute(
    `
      UPDATE dbo.AR_LineTaskNotification
      SET IsRead = 1, ReadAt = SYSUTCDATETIME()
      WHERE ID = @notificationId AND UserId = @userId AND IsRead = 0;
    `,
    { notificationId, userId }
  );

  return (result.rowsAffected[0] ?? 0) > 0;
};

export const markAllNotificationsAsRead = async (userId: number) => {
  const result = await execute(
    `
      UPDATE dbo.AR_LineTaskNotification
      SET IsRead = 1, ReadAt = SYSUTCDATETIME()
      WHERE UserId = @userId AND IsRead = 0;
    `,
    { userId }
  );

  return result.rowsAffected[0] ?? 0;
};

