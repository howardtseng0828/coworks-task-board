import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../middlewares/authMiddleware";
import {
  createGroup,
  deleteGroupByPseudoId,
  deleteUserById,
  getGroups,
  getUsers,
  updateUserAdminStatus
} from "../services/lookupsService";
import { asyncHandler } from "../utils/asyncHandler";

export const lookupRoutes = Router();

lookupRoutes.use(requireAuth);

const parseId = (id: string) => {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

lookupRoutes.get(
  "/users",
  asyncHandler(async (_req, res) => {
    res.json({ data: await getUsers() });
  })
);

lookupRoutes.get(
  "/groups",
  asyncHandler(async (_req, res) => {
    res.json({ data: await getGroups() });
  })
);

lookupRoutes.post(
  "/groups",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = z.object({ name: z.string().trim().min(1).max(200) }).parse(req.body);

    try {
      const group = await createGroup(payload.name);
      res.status(201).json({ data: group });
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_group_name") {
        res.status(400).json({ message: "群組名稱不可使用。" });
        return;
      }
      throw error;
    }
  })
);

lookupRoutes.delete(
  "/groups/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const groupId = parseId(req.params.id);
    if (!groupId) {
      res.status(400).json({ message: "群組 ID 格式錯誤。" });
      return;
    }

    const deleted = await deleteGroupByPseudoId(groupId);
    if (!deleted) {
      res.status(404).json({ message: "找不到群組。" });
      return;
    }

    res.status(204).send();
  })
);

lookupRoutes.patch(
  "/users/:id/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.id);
    if (!userId) {
      res.status(400).json({ message: "使用者 ID 格式錯誤。" });
      return;
    }

    if (req.authUser?.id === userId) {
      res.status(400).json({ message: "不能修改自己的管理員權限。" });
      return;
    }

    const payload = z.object({ isAdmin: z.boolean() }).parse(req.body);
    const user = await updateUserAdminStatus(userId, payload.isAdmin);
    if (!user) {
      res.status(404).json({ message: "找不到使用者。" });
      return;
    }

    res.json({ data: user });
  })
);

lookupRoutes.delete(
  "/users/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const userId = parseId(req.params.id);
    if (!userId) {
      res.status(400).json({ message: "使用者 ID 格式錯誤。" });
      return;
    }

    if (req.authUser?.id === userId) {
      res.status(400).json({ message: "不能刪除自己。" });
      return;
    }

    const deleted = await deleteUserById(userId);
    if (!deleted) {
      res.status(404).json({ message: "找不到使用者。" });
      return;
    }

    res.status(204).send();
  })
);
