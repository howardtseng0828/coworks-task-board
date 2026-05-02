import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import path from "node:path";
import { ZodError } from "zod";
import { authRoutes } from "./routes/authRoutes";
import { lookupRoutes } from "./routes/lookupRoutes";
import { notificationRoutes } from "./routes/notificationRoutes";
import { taskRoutes } from "./routes/taskRoutes";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
const uploadDir = process.env.UPLOAD_DIR ?? path.resolve(process.cwd(), "server", "uploads");

export const app = express();

app.use(
  cors({
    origin: frontendUrl,
    credentials: true
  })
);
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/lookups", lookupRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/uploads", express.static(uploadDir));

app.use((_req, res) => {
  res.status(404).json({ message: "找不到 API 路由。" });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({
      message: "參數驗證失敗。",
      issues: error.issues
    });
  }

  console.error(error);
  return res.status(500).json({ message: "伺服器發生錯誤。" });
});
