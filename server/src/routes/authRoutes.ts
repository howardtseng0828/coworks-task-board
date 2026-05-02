import type { Response } from "express";
import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/authMiddleware";
import {
  authActionCookieName,
  authCookieName,
  authLinkUserCookieName,
  authRedirectCookieName,
  authStateCookieName,
  buildLineAuthorizeUrl,
  createOauthState,
  exchangeLineCodeForAccessToken,
  fetchLineProfile,
  getSafeRedirectUrl,
  linkInternalAccountToUser,
  linkLineProfileToUser,
  loginWithInternalPassword,
  signAuthToken,
  upsertUserByLineProfile
} from "../services/authService";
import { asyncHandler } from "../utils/asyncHandler";

export const authRoutes = Router();

const isProduction = process.env.NODE_ENV === "production";
const authCookieMaxAge = 7 * 24 * 60 * 60 * 1000;
const oauthCookieMaxAge = 10 * 60 * 1000;
const hhtLoginSchema = z.object({
  userNo: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(255)
});

type OauthAction = "login" | "link";

const buildCookieOptions = (maxAge: number) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax" as const,
  path: "/",
  maxAge
});

const clearOauthCookies = (res: Response) => {
  res.clearCookie(authStateCookieName, { path: "/" });
  res.clearCookie(authRedirectCookieName, { path: "/" });
  res.clearCookie(authActionCookieName, { path: "/" });
  res.clearCookie(authLinkUserCookieName, { path: "/" });
};

const setOauthCookies = (
  res: Response,
  params: { state: string; redirectUrl: string; action: OauthAction; linkUserId?: number }
) => {
  res.cookie(authStateCookieName, params.state, buildCookieOptions(oauthCookieMaxAge));
  res.cookie(authRedirectCookieName, params.redirectUrl, buildCookieOptions(oauthCookieMaxAge));
  res.cookie(authActionCookieName, params.action, buildCookieOptions(oauthCookieMaxAge));

  if (params.action === "link" && params.linkUserId) {
    res.cookie(
      authLinkUserCookieName,
      String(params.linkUserId),
      buildCookieOptions(oauthCookieMaxAge)
    );
  } else {
    res.clearCookie(authLinkUserCookieName, { path: "/" });
  }
};

authRoutes.get(
  "/line/login",
  asyncHandler(async (req, res) => {
    const state = createOauthState();
    const redirectUrl = getSafeRedirectUrl(req.query.redirect);
    const authorizeUrl = buildLineAuthorizeUrl(state);

    setOauthCookies(res, {
      state,
      redirectUrl,
      action: "login"
    });

    res.redirect(authorizeUrl);
  })
);

authRoutes.get(
  "/line/link",
  requireAuth,
  asyncHandler(async (req, res) => {
    const state = createOauthState();
    const redirectUrl = getSafeRedirectUrl(req.query.redirect);
    const authorizeUrl = buildLineAuthorizeUrl(state);

    setOauthCookies(res, {
      state,
      redirectUrl,
      action: "link",
      linkUserId: req.authUser!.id
    });

    res.redirect(authorizeUrl);
  })
);

authRoutes.post(
  "/internal/login",
  asyncHandler(async (req, res) => {
    const payload = hhtLoginSchema.parse(req.body);
    const user = await loginWithInternalPassword(payload.userNo, payload.password);

    if (!user) {
      res.status(401).json({ message: "帳號或密碼錯誤。" });
      return;
    }

    const appToken = signAuthToken(user);
    res.cookie(authCookieName, appToken, buildCookieOptions(authCookieMaxAge));
    res.json({ data: user });
  })
);

authRoutes.post(
  "/internal/link",
  requireAuth,
  asyncHandler(async (req, res) => {
    const payload = hhtLoginSchema.parse(req.body);

    try {
      const user = await linkInternalAccountToUser(req.authUser!.id, payload.userNo, payload.password);
      if (!user) {
        res.status(401).json({ message: "帳號或密碼錯誤。" });
        return;
      }

      const appToken = signAuthToken(user);
      res.cookie(authCookieName, appToken, buildCookieOptions(authCookieMaxAge));
      res.json({ data: user });
    } catch (error) {
      if (error instanceof Error && error.message === "internal_already_linked_to_another_user") {
        res.status(409).json({ message: "這個 此帳號已綁定其他使用者。" });
        return;
      }
      throw error;
    }
  })
);

authRoutes.get(
  "/line/callback",
  asyncHandler(async (req, res) => {
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const authError = typeof req.query.error === "string" ? req.query.error : "";
    const expectedState = req.cookies?.[authStateCookieName];
    const redirectUrl = getSafeRedirectUrl(req.cookies?.[authRedirectCookieName]);
    const action = req.cookies?.[authActionCookieName] === "link" ? "link" : "login";
    const rawLinkUserId = req.cookies?.[authLinkUserCookieName];

    clearOauthCookies(res);

    if (authError) {
      res.redirect(`${redirectUrl}?authError=${encodeURIComponent(authError)}`);
      return;
    }

    if (!code || !state || state !== expectedState) {
      res.redirect(`${redirectUrl}?authError=invalid_oauth_state`);
      return;
    }

    const accessToken = await exchangeLineCodeForAccessToken(code);
    const lineProfile = await fetchLineProfile(accessToken);

    if (action === "link") {
      const linkUserId = Number(rawLinkUserId);
      if (!Number.isInteger(linkUserId) || linkUserId <= 0) {
        res.redirect(`${redirectUrl}?authError=invalid_link_session`);
        return;
      }

      try {
        const appUser = await linkLineProfileToUser(linkUserId, lineProfile);
        const appToken = signAuthToken(appUser);
        res.cookie(authCookieName, appToken, buildCookieOptions(authCookieMaxAge));

        const delimiter = redirectUrl.includes("?") ? "&" : "?";
        res.redirect(`${redirectUrl}${delimiter}lineLinked=1`);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : "line_link_failed";
        if (message === "line_already_linked_to_another_user") {
          res.redirect(`${redirectUrl}?authError=line_already_linked`);
          return;
        }
        if (message === "link_user_not_found") {
          res.redirect(`${redirectUrl}?authError=link_user_not_found`);
          return;
        }
        res.redirect(`${redirectUrl}?authError=line_link_failed`);
        return;
      }
    }

    const appUser = await upsertUserByLineProfile(lineProfile);
    const appToken = signAuthToken(appUser);

    res.cookie(authCookieName, appToken, buildCookieOptions(authCookieMaxAge));
    res.redirect(redirectUrl);
  })
);

authRoutes.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: req.authUser });
  })
);

authRoutes.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    res.clearCookie(authCookieName, { path: "/" });
    clearOauthCookies(res);
    res.status(204).send();
  })
);
