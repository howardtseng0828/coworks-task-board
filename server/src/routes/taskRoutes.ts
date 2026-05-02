import fs from "node:fs";
import path from "node:path";
import type { Response } from "express";
import multer from "multer";
import { Router } from "express";
import { z } from "zod";
import type { AuthUser } from "../models/types";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  addAttachment,
  addComment,
  createTask,
  deleteAttachment,
  deleteComment,
  deleteTask,
  getTaskById,
  getTaskManagePermission,
  listTasks,
  setTaskStatus,
  updateTask
} from "../services/taskService";
import { asyncHandler } from "../utils/asyncHandler";

const taskStatusSchema = z.enum(["todo", "done"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date format must be YYYY-MM-DD");
const positiveIntArraySchema = z.array(z.number().int().positive()).default([]);
const tagsSchema = z.array(z.string().trim().min(1).max(60)).default([]);

const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().optional(),
  status: taskStatusSchema.optional(),
  dueDate: dateSchema.optional(),
  groupId: z.number().int().positive().nullable().optional(),
  departmentIds: positiveIntArraySchema.optional(),
  assigneeIds: positiveIntArraySchema.optional(),
  tags: tagsSchema.optional()
});

const updateTaskSchema = createTaskSchema.partial().refine((payload) => Object.keys(payload).length > 0, {
  message: "At least one field is required."
});

const taskFilterSchema = z.object({
  q: z.string().trim().optional(),
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  status: z.enum(["todo", "done", "all"]).optional(),
  groupId: z.coerce.number().int().positive().optional(),
  scope: z.enum(["all", "related", "delegated", "todo"]).optional()
});

const commentSchema = z.object({
  message: z.string().trim().min(1).max(1000)
});

const parseId = (id: string) => {
  const parsed = Number(id);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeUploadedFileName = (rawName: string) => {
  const source = rawName?.trim() || "file";
  try {
    // Fix common mojibake case from multipart filename encoding on Windows/IIS.
    const decoded = Buffer.from(source, "latin1").toString("utf8").trim();
    return decoded || source;
  } catch {
    return source;
  }
};

const ensureTaskManagePermission = async (res: Response, taskId: number, authUser: AuthUser) => {
  const permission = await getTaskManagePermission(taskId, authUser);
  if (permission === "allowed") {
    return true;
  }

  if (permission === "task_not_found") {
    res.status(404).json({ message: "Task not found." });
    return false;
  }

  res.status(403).json({ message: "You can only manage your own tasks." });
  return false;
};

const uploadRoot = process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), "server", "uploads");
fs.mkdirSync(uploadRoot, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadRoot),
    filename: (_req, file, callback) => {
      const extension = path.extname(normalizeUploadedFileName(file.originalname || "")).slice(0, 20);
      const stamp = Date.now();
      const nonce = Math.random().toString(36).slice(2, 10);
      callback(null, `${stamp}-${nonce}${extension}`);
    }
  }),
  limits: {
    fileSize: 500 * 1024 * 1024
  }
});

export const taskRoutes = Router();
taskRoutes.use(requireAuth);

taskRoutes.get(
  "/",
  asyncHandler(async (req, res) => {
    const query = taskFilterSchema.parse({
      q: typeof req.query.q === "string" ? req.query.q : undefined,
      startDate: typeof req.query.startDate === "string" ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === "string" ? req.query.endDate : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined,
      groupId:
        typeof req.query.groupId === "string" && req.query.groupId !== "all"
          ? req.query.groupId
          : undefined,
      scope: typeof req.query.scope === "string" ? req.query.scope : undefined
    });

    res.json({ data: await listTasks(req.authUser!.id, query) });
  })
);

taskRoutes.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) {
      res.status(400).json({ message: "Invalid task id." });
      return;
    }

    const task = await getTaskById(taskId);
    if (!task) {
      res.status(404).json({ message: "Task not found." });
      return;
    }

    res.json({ data: task });
  })
);

taskRoutes.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = createTaskSchema.parse(req.body);
    const task = await createTask(req.authUser!.id, payload);
    res.status(201).json({ data: task });
  })
);

taskRoutes.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) {
      res.status(400).json({ message: "Invalid task id." });
      return;
    }

    const allowed = await ensureTaskManagePermission(res, taskId, req.authUser!);
    if (!allowed) {
      return;
    }

    const payload = updateTaskSchema.parse(req.body);
    const task = await updateTask(req.authUser!.id, taskId, payload);
    if (!task) {
      res.status(404).json({ message: "Task not found." });
      return;
    }

    res.json({ data: task });
  })
);

taskRoutes.patch(
  "/:id/status",
  asyncHandler(async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) {
      res.status(400).json({ message: "Invalid task id." });
      return;
    }

    const allowed = await ensureTaskManagePermission(res, taskId, req.authUser!);
    if (!allowed) {
      return;
    }

    const payload = z.object({ status: taskStatusSchema }).parse(req.body);
    const task = await setTaskStatus(taskId, payload.status);
    if (!task) {
      res.status(404).json({ message: "Task not found." });
      return;
    }

    res.json({ data: task });
  })
);

taskRoutes.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) {
      res.status(400).json({ message: "Invalid task id." });
      return;
    }

    const allowed = await ensureTaskManagePermission(res, taskId, req.authUser!);
    if (!allowed) {
      return;
    }

    const deleted = await deleteTask(taskId);
    if (!deleted) {
      res.status(404).json({ message: "Task not found." });
      return;
    }

    res.status(204).send();
  })
);

taskRoutes.post(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) {
      res.status(400).json({ message: "Invalid task id." });
      return;
    }

    const allowed = await ensureTaskManagePermission(res, taskId, req.authUser!);
    if (!allowed) {
      return;
    }

    const payload = commentSchema.parse(req.body);
    const task = await addComment(taskId, payload.message, req.authUser!.id);
    if (!task) {
      res.status(404).json({ message: "Task not found." });
      return;
    }

    res.status(201).json({ data: task });
  })
);

taskRoutes.delete(
  "/:id/comments/:commentId",
  asyncHandler(async (req, res) => {
    const taskId = parseId(req.params.id);
    const commentId = parseId(req.params.commentId);
    if (!taskId || !commentId) {
      res.status(400).json({ message: "Invalid task/comment id." });
      return;
    }

    const result = await deleteComment(taskId, commentId, req.authUser!.id, req.authUser!.isAdmin);
    if (result.status === "task_not_found") {
      res.status(404).json({ message: "Task not found." });
      return;
    }
    if (result.status === "comment_not_found") {
      res.status(404).json({ message: "Comment not found." });
      return;
    }
    if (result.status === "forbidden") {
      res.status(403).json({ message: "You can only delete your own comments unless you are admin." });
      return;
    }

    res.json({ data: result.task });
  })
);

taskRoutes.post(
  "/:id/attachments",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const taskId = parseId(req.params.id);
    if (!taskId) {
      res.status(400).json({ message: "Invalid task id." });
      return;
    }

    const allowed = await ensureTaskManagePermission(res, taskId, req.authUser!);
    if (!allowed) {
      return;
    }

    if (!req.file) {
      res.status(400).json({ message: "No file uploaded." });
      return;
    }

    const task = await addAttachment(taskId, {
      fileName: normalizeUploadedFileName(req.file.originalname),
      storageFileName: req.file.filename,
      contentType: req.file.mimetype || null,
      fileSize: req.file.size,
      uploadedByUserId: req.authUser!.id
    });
    if (!task) {
      res.status(404).json({ message: "Task not found." });
      return;
    }

    res.status(201).json({ data: task });
  })
);

taskRoutes.delete(
  "/:id/attachments/:attachmentId",
  asyncHandler(async (req, res) => {
    const taskId = parseId(req.params.id);
    const attachmentId = parseId(req.params.attachmentId);
    if (!taskId || !attachmentId) {
      res.status(400).json({ message: "Invalid task/attachment id." });
      return;
    }

    const allowed = await ensureTaskManagePermission(res, taskId, req.authUser!);
    if (!allowed) {
      return;
    }

    const result = await deleteAttachment(taskId, attachmentId);
    if (result.status === "task_not_found") {
      res.status(404).json({ message: "Task not found." });
      return;
    }
    if (result.status === "attachment_not_found") {
      res.status(404).json({ message: "Attachment not found." });
      return;
    }

    const storageFileName = result.storageFileName?.trim();
    if (storageFileName) {
      const resolvedUploadRoot = path.resolve(uploadRoot);
      const filePath = path.resolve(resolvedUploadRoot, storageFileName);
      const isInsideUploadDir =
        filePath === resolvedUploadRoot || filePath.startsWith(`${resolvedUploadRoot}${path.sep}`);
      if (isInsideUploadDir) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          const nodeError = error as NodeJS.ErrnoException;
          if (nodeError.code !== "ENOENT") {
            throw error;
          }
        }
      }
    }

    res.json({ data: result.task });
  })
);
