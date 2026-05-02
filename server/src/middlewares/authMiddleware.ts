import type { NextFunction, Request, Response } from "express";
import { authCookieName, getUserById, verifyAuthToken } from "../services/authService";

const getTokenFromRequest = (req: Request) => {
  const fromCookie = req.cookies?.[authCookieName];
  if (typeof fromCookie === "string" && fromCookie) {
    return fromCookie;
  }

  const authHeader = req.header("authorization");
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      req.authUser = undefined;
      return next();
    }

    const authUser = verifyAuthToken(token);
    if (!authUser) {
      req.authUser = undefined;
      return next();
    }

    req.authUser = (await getUserById(authUser.id)) ?? undefined;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getTokenFromRequest(req);
    if (!token) {
      return res.status(401).json({ message: "尚未登入。" });
    }

    const authUser = verifyAuthToken(token);
    if (!authUser) {
      return res.status(401).json({ message: "登入憑證無效或已過期。" });
    }

    const freshUser = await getUserById(authUser.id);
    if (!freshUser) {
      return res.status(401).json({ message: "找不到使用者或已停用。" });
    }

    req.authUser = freshUser;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requireAuth(req, res, () => undefined);
    if (!req.authUser) {
      return;
    }

    if (!req.authUser.isAdmin) {
      return res.status(403).json({ message: "需要管理員權限。" });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};
