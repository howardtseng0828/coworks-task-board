import { execute, queryAll, queryOne } from "../db/database";
import type { Group, User } from "../models/types";
import { isLegacyPlaceholderGroup, toPseudoGroupId } from "./lineTaskHelpers";

const normalizeGroupName = (name: string) => name.trim().replace(/\s+/g, " ");

const getGroupNames = async () => {
  const rows = await queryAll<{ DepartmentName: string | null }>(
    `
      SELECT DISTINCT LTRIM(RTRIM(GroupName)) AS DepartmentName
      FROM dbo.AR_LineGroupList
      WHERE GroupName IS NOT NULL AND LTRIM(RTRIM(GroupName)) <> ''
      UNION
      SELECT DISTINCT LTRIM(RTRIM(DepartmentName)) AS DepartmentName
      FROM dbo.AR_LineTaskDepartment
      WHERE DepartmentName IS NOT NULL AND LTRIM(RTRIM(DepartmentName)) <> ''
      UNION
      SELECT DISTINCT LTRIM(RTRIM(LineGroupId)) AS DepartmentName
      FROM dbo.AR_LineProjectList
      WHERE LineGroupId IS NOT NULL AND LTRIM(RTRIM(LineGroupId)) <> '';
    `
  );

  const names = new Set<string>();
  rows.forEach((row) => {
    const name = row.DepartmentName?.trim();
    if (!name || isLegacyPlaceholderGroup(name)) {
      return;
    }
    names.add(name);
  });

  return [...names.values()].sort((a, b) => a.localeCompare(b));
};

export const getUsers = async (): Promise<User[]> => {
  return queryAll<User>(
    `
      SELECT
        id,
        lineUserId,
        internalUserNo,
        name,
        avatar,
        CAST(ISNULL(IsAdmin, 0) AS BIT) AS isAdmin
      FROM dbo.AR_LineUsers
      ORDER BY name ASC;
    `
  );
};

export const updateUserAdminStatus = async (userId: number, isAdmin: boolean): Promise<User | null> => {
  await execute(
    `
      UPDATE dbo.AR_LineUsers
      SET IsAdmin = @isAdmin
      WHERE id = @id;
    `,
    {
      id: userId,
      isAdmin: isAdmin ? 1 : 0
    }
  );

  return queryOne<User>(
    `
      SELECT
        id,
        lineUserId,
        internalUserNo,
        name,
        avatar,
        CAST(ISNULL(IsAdmin, 0) AS BIT) AS isAdmin
      FROM dbo.AR_LineUsers
      WHERE id = @id;
    `,
    { id: userId }
  );
};

export const deleteUserById = async (userId: number): Promise<boolean> => {
  const existing = await queryOne<{ id: number; lineUserId: string | null }>(
    `
      SELECT id, lineUserId
      FROM dbo.AR_LineUsers
      WHERE id = @id;
    `,
    { id: userId }
  );

  if (!existing) {
    return false;
  }

  await execute(
    `
      UPDATE dbo.AR_LineTaskComment
      SET UserId = NULL
      WHERE UserId = @userId;
    `,
    { userId }
  );

  await execute(
    `
      DELETE FROM dbo.AR_LineTaskNotification
      WHERE UserId = @userId OR TriggerByUserId = @userId;
    `,
    { userId }
  );

  await execute(
    `
      UPDATE dbo.AR_LineProjectAssignment
      SET AssignedByUserId = NULL
      WHERE AssignedByUserId = @userId;
    `,
    { userId }
  );

  await execute(
    `
      DELETE FROM dbo.AR_LineTaskAssignee
      WHERE UserId = @userId;
    `,
    { userId }
  );

  if (existing.lineUserId) {
    await execute(
      `
        UPDATE dbo.AR_LineProjectList
        SET
          AssigneeLineUserId = CASE WHEN AssigneeLineUserId = @lineUserId THEN NULL ELSE AssigneeLineUserId END
        WHERE AssigneeLineUserId = @lineUserId;
      `,
      { lineUserId: existing.lineUserId }
    );

    await execute(
      `
        UPDATE dbo.AR_LineProjectAssignment
        SET
          AssignedByLineUserId = CASE WHEN AssignedByLineUserId = @lineUserId THEN NULL ELSE AssignedByLineUserId END,
          AssignedToLineUserId = CASE WHEN AssignedToLineUserId = @lineUserId THEN NULL ELSE AssignedToLineUserId END
        WHERE AssignedByLineUserId = @lineUserId OR AssignedToLineUserId = @lineUserId;
      `,
      { lineUserId: existing.lineUserId }
    );

    await execute(
      `
        UPDATE dbo.AR_LineTaskComment
        SET LineUserId = NULL
        WHERE LineUserId = @lineUserId;
      `,
      { lineUserId: existing.lineUserId }
    );
  }

  const result = await execute(
    `
      DELETE FROM dbo.AR_LineUsers
      WHERE id = @id;
    `,
    { id: userId }
  );

  return (result.rowsAffected[0] ?? 0) > 0;
};

export const getGroups = async (): Promise<Group[]> => {
  const names = await getGroupNames();
  return names.map((name) => ({ id: toPseudoGroupId(name), name }));
};

export const createGroup = async (rawName: string): Promise<Group> => {
  const name = normalizeGroupName(rawName);
  if (!name || isLegacyPlaceholderGroup(name)) {
    throw new Error("invalid_group_name");
  }

  await execute(
    `
      IF NOT EXISTS (
        SELECT 1
        FROM dbo.AR_LineGroupList
        WHERE GroupName = @name
      )
      BEGIN
        INSERT INTO dbo.AR_LineGroupList (GroupName)
        VALUES (@name);
      END;
    `,
    { name }
  );

  return { id: toPseudoGroupId(name), name };
};

export const deleteGroupByPseudoId = async (groupId: number): Promise<boolean> => {
  const names = await getGroupNames();
  const targetName = names.find((name) => toPseudoGroupId(name) === groupId);
  if (!targetName) {
    return false;
  }

  await execute(
    `
      DELETE FROM dbo.AR_LineGroupList
      WHERE GroupName = @targetName;
    `,
    { targetName }
  );

  await execute(
    `
      DELETE FROM dbo.AR_LineTaskDepartment
      WHERE DepartmentName = @targetName;
    `,
    { targetName }
  );

  await execute(
    `
      UPDATE dbo.AR_LineProjectList
      SET LineGroupId = NULL
      WHERE LTRIM(RTRIM(ISNULL(LineGroupId, ''))) = @targetName;
    `,
    { targetName }
  );

  return true;
};
