import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead
} from "../services/notificationService";
import { asyncHandler } from "../utils/asyncHandler";

const parseId = (id: string) => {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const notificationRoutes = Router();
notificationRoutes.use(requireAuth);

notificationRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = z
      .object({
        limit: z.coerce.number().int().positive().max(100).optional()
      })
      .parse(req.query);

    const payload = await listNotifications(req.authUser!.id, query.limit ?? 20);
    res.json({ data: payload });
  })
);

notificationRoutes.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const notificationId = parseId(req.params.id);
    if (!notificationId) {
      res.status(400).json({ message: "Invalid notification id." });
      return;
    }

    const updated = await markNotificationAsRead(req.authUser!.id, notificationId);
    res.json({ data: { updated } });
  })
);

notificationRoutes.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    const updatedCount = await markAllNotificationsAsRead(req.authUser!.id);
    res.json({ data: { updatedCount } });
  })
);
