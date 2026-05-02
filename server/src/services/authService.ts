import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { execute, queryOne } from "../db/database";
import type { AuthProvider, AuthUser } from "../models/types";

interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

interface AppUserRow {
  id: number;
  lineUserId: string | null;
  internalUserNo: string | null;
  name: string;
  avatar: string;
  IsAdmin: boolean | number | null;
}

interface HhtLoginRow {
  UserNo: string;
  U_Name: string | null;
  U_Pwd: string | null;
  IsAdmin: boolean | number | null;
}

const lineChannelId = process.env.LINE_CHANNEL_ID ?? "";
const lineChannelSecret = process.env.LINE_CHANNEL_SECRET ?? "";
const lineRedirectUri = process.env.LINE_REDIRECT_URI ?? "http://localhost:4000/api/auth/line/callback";
const jwtSecret = process.env.JWT_SECRET ?? "change-me-in-production";
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

export const authCookieName = process.env.AUTH_COOKIE_NAME ?? "coworks_token";
export const authStateCookieName = "line_oauth_state";
export const authRedirectCookieName = "line_oauth_redirect";
export const authActionCookieName = "line_oauth_action";
export const authLinkUserCookieName = "line_oauth_link_user";

const fallbackAvatar = "https://api.dicebear.com/9.x/thumbs/svg?seed=CoworksUser";

const assertLineConfig = () => {
  if (!lineChannelId || !lineChannelSecret || !lineRedirectUri) {
    throw new Error(
      "LINE Login is not configured. Please set LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, and LINE_REDIRECT_URI."
    );
  }
};

const toBoolean = (value: unknown) => value === true || Number(value) === 1;

const resolveAuthProvider = (
  preferred: AuthProvider | null | undefined,
  fallbackHhtUserNo: string | null | undefined
): AuthProvider => {
  if (preferred === "line" || preferred === "internal") {
    return preferred;
  }
  return fallbackHhtUserNo ? "internal" : "line";
};

const mapRowToAuthUser = (row: AppUserRow, preferredProvider?: AuthProvider): AuthUser => ({
  id: row.id,
  lineUserId: row.lineUserId,
  internalUserNo: row.internalUserNo,
  name: row.name,
  avatar: row.avatar,
  isAdmin: toBoolean(row.IsAdmin),
  authProvider: resolveAuthProvider(preferredProvider, row.internalUserNo)
});

const getAvatarByName = (name: string) =>
  `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name || "CoworksUser")}`;

const getAppUserRowById = async (userId: number) => {
  return queryOne<AppUserRow>(
    `
      SELECT id, lineUserId, internalUserNo, name, avatar, IsAdmin
      FROM dbo.AR_LineUsers
      WHERE id = @id;
    `,
    { id: userId }
  );
};

const getInternalLoginByUserNo = async (userNo: string) => {
  return queryOne<HhtLoginRow>(
    `
      DECLARE @sql NVARCHAR(MAX);

      IF COL_LENGTH('WIP.dbo.Login', 'IsAdmin') IS NOT NULL
      BEGIN
        SET @sql = N'
          SELECT TOP (1)
            CAST(UserNo AS NVARCHAR(80)) AS UserNo,
            CAST(U_Name AS NVARCHAR(120)) AS U_Name,
            CAST(U_Pwd AS NVARCHAR(255)) AS U_Pwd,
            CAST(ISNULL(IsAdmin, 0) AS BIT) AS IsAdmin
          FROM [WIP].[dbo].[Login]
          WHERE UserNo = @userNo;
        ';
      END
      ELSE
      BEGIN
        SET @sql = N'
          SELECT TOP (1)
            CAST(UserNo AS NVARCHAR(80)) AS UserNo,
            CAST(U_Name AS NVARCHAR(120)) AS U_Name,
            CAST(U_Pwd AS NVARCHAR(255)) AS U_Pwd,
            CAST(0 AS BIT) AS IsAdmin
          FROM [WIP].[dbo].[Login]
          WHERE UserNo = @userNo;
        ';
      END;

      EXEC sp_executesql @sql, N'@userNo NVARCHAR(80)', @userNo = @userNo;
    `,
    { userNo }
  );
};

const mergeUserRecords = async (sourceUserId: number, targetUserId: number) => {
  if (sourceUserId === targetUserId) {
    return;
  }

  await execute(
    `
      UPDATE dbo.AR_LineTaskComment
      SET UserId = @targetUserId
      WHERE UserId = @sourceUserId;
    `,
    { sourceUserId, targetUserId }
  );

  await execute(
    `
      UPDATE dbo.AR_LineTaskNotification
      SET UserId = @targetUserId
      WHERE UserId = @sourceUserId;
    `,
    { sourceUserId, targetUserId }
  );

  await execute(
    `
      UPDATE dbo.AR_LineTaskNotification
      SET TriggerByUserId = @targetUserId
      WHERE TriggerByUserId = @sourceUserId;
    `,
    { sourceUserId, targetUserId }
  );

  await execute(
    `
      UPDATE dbo.AR_LineProjectAssignment
      SET AssignedByUserId = @targetUserId
      WHERE AssignedByUserId = @sourceUserId;
    `,
    { sourceUserId, targetUserId }
  );

  await execute(
    `
      IF OBJECT_ID('dbo.AR_LineTaskAssignee', 'U') IS NOT NULL
      BEGIN
        DELETE sourceRows
        FROM dbo.AR_LineTaskAssignee sourceRows
        INNER JOIN dbo.AR_LineTaskAssignee targetRows
          ON targetRows.TaskSID = sourceRows.TaskSID
         AND targetRows.UserId = @targetUserId
        WHERE sourceRows.UserId = @sourceUserId;

        UPDATE dbo.AR_LineTaskAssignee
        SET UserId = @targetUserId
        WHERE UserId = @sourceUserId;
      END;
    `,
    { sourceUserId, targetUserId }
  );

  await execute(
    `
      IF OBJECT_ID('dbo.AR_LineTaskAttachment', 'U') IS NOT NULL
      BEGIN
        UPDATE dbo.AR_LineTaskAttachment
        SET UploadedByUserId = @targetUserId
        WHERE UploadedByUserId = @sourceUserId;
      END;
    `,
    { sourceUserId, targetUserId }
  );

  await execute(
    `
      DELETE FROM dbo.AR_LineUsers
      WHERE id = @sourceUserId;
    `,
    { sourceUserId }
  );
};

const upsertUserByInternalLogin = async (
  userNo: string,
  name: string,
  isAdmin: boolean
): Promise<AuthUser> => {
  const existing = await queryOne<AppUserRow>(
    `
      SELECT id, lineUserId, internalUserNo, name, avatar, IsAdmin
      FROM dbo.AR_LineUsers
      WHERE internalUserNo = @internalUserNo;
    `,
    { internalUserNo: userNo }
  );

  const displayName = name.trim() || userNo.trim();
  const avatar = existing?.avatar?.trim() || getAvatarByName(displayName) || fallbackAvatar;

  if (existing) {
    await execute(
      `
        UPDATE dbo.AR_LineUsers
        SET name = @name, avatar = @avatar, IsAdmin = @isAdmin
        WHERE id = @id;
      `,
      {
        id: existing.id,
        name: displayName,
        avatar,
        isAdmin: isAdmin ? 1 : 0
      }
    );

    return mapRowToAuthUser(
      {
        ...existing,
        name: displayName,
        avatar,
        IsAdmin: isAdmin ? 1 : 0
      },
      "internal"
    );
  }

  const inserted = await queryOne<{ id: number; IsAdmin: boolean | number }>(
    `
      INSERT INTO dbo.AR_LineUsers (lineUserId, internalUserNo, name, avatar, IsAdmin)
      OUTPUT INSERTED.id, INSERTED.IsAdmin
      VALUES (NULL, @internalUserNo, @name, @avatar, @isAdmin);
    `,
    {
      internalUserNo: userNo,
      name: displayName,
      avatar,
      isAdmin: isAdmin ? 1 : 0
    }
  );

  if (!inserted) {
    throw new Error("Failed to create local user from HHT account.");
  }

  return {
    id: inserted.id,
    lineUserId: null,
    internalUserNo: userNo,
    name: displayName,
    avatar,
    isAdmin: toBoolean(inserted.IsAdmin),
    authProvider: "internal"
  };
};

export const createOauthState = () => randomBytes(20).toString("hex");

export const getSafeRedirectUrl = (rawRedirect: unknown) => {
  if (typeof rawRedirect !== "string" || !rawRedirect.trim()) {
    return frontendUrl;
  }

  try {
    const url = new URL(rawRedirect);
    const appOrigin = new URL(frontendUrl).origin;
    if (url.origin === appOrigin) {
      return url.toString();
    }
    return frontendUrl;
  } catch {
    // Treat relative path as frontend path.
    if (rawRedirect.startsWith("/")) {
      return `${frontendUrl}${rawRedirect}`;
    }
    return frontendUrl;
  }
};

export const buildLineAuthorizeUrl = (state: string) => {
  assertLineConfig();
  const authorizeUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", lineChannelId);
  authorizeUrl.searchParams.set("redirect_uri", lineRedirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "profile openid");
  authorizeUrl.searchParams.set("nonce", createOauthState());
  return authorizeUrl.toString();
};

export const exchangeLineCodeForAccessToken = async (code: string) => {
  assertLineConfig();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: lineRedirectUri,
    client_id: lineChannelId,
    client_secret: lineChannelSecret
  });

  const response = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE token exchange failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as { access_token: string };
  if (!payload.access_token) {
    throw new Error("LINE token exchange succeeded but access_token is missing.");
  }

  return payload.access_token;
};

export const fetchLineProfile = async (accessToken: string) => {
  const response = await fetch("https://api.line.me/v2/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch LINE profile: ${response.status} ${errorText}`);
  }

  return (await response.json()) as LineProfile;
};

export const upsertUserByLineProfile = async (profile: LineProfile): Promise<AuthUser> => {
  const existing = await queryOne<AppUserRow>(
    `
      SELECT id, lineUserId, internalUserNo, name, avatar, IsAdmin
      FROM dbo.AR_LineUsers
      WHERE lineUserId = @lineUserId;
    `,
    { lineUserId: profile.userId }
  );

  if (existing) {
    const avatar = profile.pictureUrl ?? existing.avatar ?? fallbackAvatar;

    await execute(
      `
        UPDATE dbo.AR_LineUsers
        SET name = @name, avatar = @avatar
        WHERE id = @id;
      `,
      {
        id: existing.id,
        name: profile.displayName,
        avatar
      }
    );

    return mapRowToAuthUser(
      {
        ...existing,
        name: profile.displayName,
        avatar
      },
      "line"
    );
  }

  const inserted = await queryOne<{ id: number }>(
    `
      INSERT INTO dbo.AR_LineUsers (lineUserId, internalUserNo, name, avatar, IsAdmin)
      OUTPUT INSERTED.id
      VALUES (@lineUserId, NULL, @name, @avatar, 0);
    `,
    {
      lineUserId: profile.userId,
      name: profile.displayName,
      avatar: profile.pictureUrl ?? fallbackAvatar
    }
  );

  if (!inserted) {
    throw new Error("Failed to create local user from LINE profile.");
  }

  return {
    id: inserted.id,
    lineUserId: profile.userId,
    internalUserNo: null,
    name: profile.displayName,
    avatar: profile.pictureUrl ?? fallbackAvatar,
    isAdmin: false,
    authProvider: "line"
  };
};

export const linkLineProfileToUser = async (
  userId: number,
  profile: LineProfile
): Promise<AuthUser> => {
  const target = await getAppUserRowById(userId);

  if (!target) {
    throw new Error("link_user_not_found");
  }

  const lineOwner = await queryOne<AppUserRow>(
    `
      SELECT id, lineUserId, internalUserNo, name, avatar, IsAdmin
      FROM dbo.AR_LineUsers
      WHERE lineUserId = @lineUserId;
    `,
    { lineUserId: profile.userId }
  );

  if (lineOwner && lineOwner.id !== userId) {
    const ownerHhtUserNo = lineOwner.internalUserNo?.trim() || null;
    const targetHhtUserNo = target.internalUserNo?.trim() || null;

    if (ownerHhtUserNo && targetHhtUserNo && ownerHhtUserNo !== targetHhtUserNo) {
      throw new Error("line_already_linked_to_another_user");
    }

    await mergeUserRecords(lineOwner.id, userId);
  }

  const refreshedTarget = await getAppUserRowById(userId);
  if (!refreshedTarget) {
    throw new Error("link_user_not_found");
  }

  const nextName =
    refreshedTarget.name?.trim() || profile.displayName || refreshedTarget.internalUserNo || "HHT User";
  const nextAvatar = profile.pictureUrl?.trim() || refreshedTarget.avatar?.trim() || getAvatarByName(nextName);
  const mergedHhtUserNo = refreshedTarget.internalUserNo?.trim() || lineOwner?.internalUserNo?.trim() || null;
  const mergedIsAdmin = toBoolean(refreshedTarget.IsAdmin) || toBoolean(lineOwner?.IsAdmin);

  await execute(
    `
      UPDATE dbo.AR_LineUsers
      SET
        lineUserId = @lineUserId,
        internalUserNo = @internalUserNo,
        name = @name,
        avatar = @avatar,
        IsAdmin = @isAdmin
      WHERE id = @id;
    `,
    {
      id: userId,
      lineUserId: profile.userId,
      internalUserNo: mergedHhtUserNo,
      name: nextName,
      avatar: nextAvatar,
      isAdmin: mergedIsAdmin ? 1 : 0
    }
  );

  const linked = await getAppUserRowById(userId);

  if (!linked) {
    throw new Error("link_user_not_found");
  }

  return mapRowToAuthUser(linked, "line");
};

export const loginWithInternalPassword = async (userNo: string, password: string) => {
  const normalizedUserNo = userNo.trim();
  if (!normalizedUserNo || !password) {
    return null;
  }

  let record: HhtLoginRow | null;
  try {
    record = await getInternalLoginByUserNo(normalizedUserNo);
  } catch {
    throw new Error("Internal login source [WIP].[dbo].[Login] is not available.");
  }

  if (!record) {
    return null;
  }

  const storedPassword = typeof record.U_Pwd === "string" ? record.U_Pwd : "";
  if (storedPassword !== password) {
    return null;
  }

  const displayName = (record.U_Name ?? "").trim() || normalizedUserNo;
  const isAdmin = toBoolean(record.IsAdmin);
  return upsertUserByInternalLogin(normalizedUserNo, displayName, isAdmin);
};

export const linkInternalAccountToUser = async (
  userId: number,
  userNo: string,
  password: string
): Promise<AuthUser | null> => {
  const normalizedUserNo = userNo.trim();
  if (!normalizedUserNo || !password) {
    return null;
  }

  const target = await getAppUserRowById(userId);
  if (!target) {
    throw new Error("internal_link_user_not_found");
  }

  let record: HhtLoginRow | null;
  try {
    record = await getInternalLoginByUserNo(normalizedUserNo);
  } catch {
    throw new Error("Internal login source [WIP].[dbo].[Login] is not available.");
  }

  if (!record) {
    return null;
  }

  const storedPassword = typeof record.U_Pwd === "string" ? record.U_Pwd : "";
  if (storedPassword !== password) {
    return null;
  }

  const hhtOwner = await queryOne<AppUserRow>(
    `
      SELECT id, lineUserId, internalUserNo, name, avatar, IsAdmin
      FROM dbo.AR_LineUsers
      WHERE internalUserNo = @internalUserNo;
    `,
    { internalUserNo: normalizedUserNo }
  );

  if (hhtOwner && hhtOwner.id !== userId) {
    const ownerLineUserId = hhtOwner.lineUserId?.trim() || null;
    const targetLineUserId = target.lineUserId?.trim() || null;
    if (ownerLineUserId && targetLineUserId && ownerLineUserId !== targetLineUserId) {
      throw new Error("internal_already_linked_to_another_user");
    }

    await mergeUserRecords(hhtOwner.id, userId);
  }

  const refreshedTarget = await getAppUserRowById(userId);
  if (!refreshedTarget) {
    throw new Error("internal_link_user_not_found");
  }

  const displayName = (record.U_Name ?? "").trim() || normalizedUserNo;
  const mergedLineUserId =
    refreshedTarget.lineUserId?.trim() || hhtOwner?.lineUserId?.trim() || null;
  const nextName = refreshedTarget.name?.trim() || displayName;
  const nextAvatar =
    refreshedTarget.avatar?.trim() || getAvatarByName(nextName || displayName) || fallbackAvatar;
  const isAdmin = toBoolean(record.IsAdmin);

  await execute(
    `
      UPDATE dbo.AR_LineUsers
      SET
        lineUserId = @lineUserId,
        internalUserNo = @internalUserNo,
        name = @name,
        avatar = @avatar,
        IsAdmin = @isAdmin
      WHERE id = @id;
    `,
    {
      id: userId,
      lineUserId: mergedLineUserId,
      internalUserNo: normalizedUserNo,
      name: nextName,
      avatar: nextAvatar,
      isAdmin: isAdmin ? 1 : 0
    }
  );

  const linked = await getAppUserRowById(userId);
  if (!linked) {
    throw new Error("internal_link_user_not_found");
  }

  return mapRowToAuthUser(linked, linked.lineUserId ? "line" : "internal");
};

export const getUserById = async (userId: number): Promise<AuthUser | null> => {
  const row = await getAppUserRowById(userId);

  if (!row) {
    return null;
  }

  return mapRowToAuthUser(row);
};

export const signAuthToken = (user: AuthUser) => {
  return jwt.sign(
    {
      sub: String(user.id),
      lineUserId: user.lineUserId,
      internalUserNo: user.internalUserNo,
      name: user.name,
      avatar: user.avatar,
      isAdmin: user.isAdmin,
      authProvider: user.authProvider
    },
    jwtSecret,
    { expiresIn: "7d" }
  );
};

export const verifyAuthToken = (token: string): AuthUser | null => {
  try {
    const payload = jwt.verify(token, jwtSecret) as {
      sub: string;
      lineUserId?: unknown;
      internalUserNo?: unknown;
      name?: unknown;
      avatar?: unknown;
      isAdmin?: unknown;
      authProvider?: unknown;
    };

    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || userId <= 0) {
      return null;
    }

    const lineUserId = typeof payload.lineUserId === "string" ? payload.lineUserId : null;
    const internalUserNo = typeof payload.internalUserNo === "string" ? payload.internalUserNo : null;
    const name = typeof payload.name === "string" ? payload.name : "";
    const avatar = typeof payload.avatar === "string" ? payload.avatar : fallbackAvatar;
    const isAdmin = toBoolean(payload.isAdmin);
    const authProvider = resolveAuthProvider(
      payload.authProvider as AuthProvider | null | undefined,
      internalUserNo
    );

    return {
      id: userId,
      lineUserId,
      internalUserNo,
      name,
      avatar,
      isAdmin,
      authProvider
    };
  } catch {
    return null;
  }
};
