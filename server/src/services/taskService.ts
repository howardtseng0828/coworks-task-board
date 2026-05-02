
import { execute, queryAll, queryOne } from "../db/database";
import type {
  Attachment,
  AuthUser,
  CreateTaskInput,
  Group,
  Task,
  TaskComment,
  TaskFilters,
  TaskStatus,
  UpdateTaskInput,
  User
} from "../models/types";
import { isLegacyPlaceholderGroup, toPseudoGroupId, toPseudoUserId } from "./lineTaskHelpers";

interface TaskRow {
  SID: number | string;
  TaskTitle: string | null;
  TaskDescription: string | null;
  TaskStatus: string | null;
  LineGroupId: string | null;
  AssigneeDisplayName: string | null;
  AssigneeLineUserId: string | null;
  DueDate: string | Date | null;
  CreatedAt: string | Date | null;
  UpdatedAt: string | Date | null;
}

interface UserRow {
  id: number;
  lineUserId: string | null;
  name: string;
  avatar: string;
}

interface AssigneeRow {
  TaskSID: number | string;
  id: number;
  lineUserId: string | null;
  name: string;
  avatar: string;
}

interface DepartmentRow {
  TaskSID: number | string;
  DepartmentName: string;
}

interface TagRow {
  TaskSID: number | string;
  Tag: string;
}

interface AttachmentRow {
  ID: number | string;
  TaskSID: number | string;
  FileName: string;
  StorageFileName: string | null;
  ContentType: string | null;
  FileSize: number | string;
  UploadedAt: string | Date | null;
}

interface AssignmentRow {
  TaskSID: number | string;
  AssignedByUserId: number | null;
  AssignedByLineUserId: string | null;
  AssignedByName: string | null;
  AssignedAt: string | Date | null;
}

interface CommentRow {
  ID: number | string;
  TaskSID: number | string;
  UserId: number | null;
  LineUserId: string | null;
  UserName: string | null;
  UserAvatar: string | null;
  Message: string;
  CreatedAt: string | Date | null;
  RefUserId: number | null;
  RefLineUserId: string | null;
  RefUserName: string | null;
  RefUserAvatar: string | null;
}

interface PermissionRow {
  SID: number | string;
  AssigneeDisplayName: string | null;
  AssigneeLineUserId: string | null;
  AssignedByUserId: number | null;
  IsAssignedToCurrent: number;
}

interface AddAttachmentInput {
  fileName: string;
  storageFileName: string;
  contentType: string | null;
  fileSize: number;
  uploadedByUserId: number;
}

export type DeleteCommentResult =
  | { status: "task_not_found" }
  | { status: "comment_not_found" }
  | { status: "forbidden" }
  | { status: "deleted"; task: Task };

export type DeleteAttachmentResult =
  | { status: "task_not_found" }
  | { status: "attachment_not_found" }
  | { status: "deleted"; task: Task; storageFileName: string | null };

export type TaskManagePermissionResult = "allowed" | "forbidden" | "task_not_found";

const uploadsPublicBase = (process.env.UPLOAD_PUBLIC_BASE ?? "/uploads").replace(/\/+$/, "");

const toId = (value: number | string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid id: ${String(value)}`);
  }
  return parsed;
};

const toStatus = (value: string | null | undefined): TaskStatus =>
  value?.trim().toLowerCase() === "done" ? "done" : "todo";

const toDateOnly = (value: string | Date | null | undefined) => {
  if (!value) {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().slice(0, 10);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
};

const toIso = (value: string | Date | null | undefined) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
};

const normalizeName = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

const dedupeNumbers = (values: number[] | undefined) => {
  if (!values) {
    return [] as number[];
  }
  const set = new Set<number>();
  values.forEach((value) => {
    if (Number.isInteger(value) && value > 0) {
      set.add(value);
    }
  });
  return [...set.values()];
};

const dedupeTags = (values: string[] | undefined) => {
  if (!values) {
    return [] as string[];
  }
  const map = new Map<string, string>();
  values.forEach((raw) => {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag) {
      return;
    }
    const key = tag.toLowerCase();
    if (!map.has(key)) {
      map.set(key, tag);
    }
  });
  return [...map.values()];
};

const ensureDepartmentNamesRegistered = async (departmentNames: string[]) => {
  const names = Array.from(new Set(departmentNames.map((name) => name.trim()).filter(Boolean)));
  for (const name of names) {
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
  }
};

const inList = (ids: number[]) => (ids.length ? ids.map((id) => String(id)).join(",") : "0");

const attachmentUrl = (storageFileName: string | null | undefined, fileName: string) => {
  const target = (storageFileName ?? "").trim() || fileName.trim();
  return `${uploadsPublicBase}/${encodeURIComponent(target)}`;
};

const getTaskRow = async (taskId: number) => {
  return queryOne<TaskRow>(
    `
      SELECT
        SID,
        TaskTitle,
        TaskDescription,
        TaskStatus,
        LineGroupId,
        AssigneeDisplayName,
        AssigneeLineUserId,
        DueDate,
        CreatedAt,
        UpdatedAt
      FROM dbo.AR_LineProjectList
      WHERE SID = @taskId;
    `,
    { taskId }
  );
};

const getCurrentUser = async (userId: number) => {
  return queryOne<UserRow>(
    `
      SELECT id, lineUserId, name, avatar
      FROM dbo.AR_LineUsers
      WHERE id = @id;
    `,
    { id: userId }
  );
};

const getUsersByIds = async (userIds: number[]) => {
  if (userIds.length === 0) {
    return [] as UserRow[];
  }

  return queryAll<UserRow>(
    `
      SELECT id, lineUserId, name, avatar
      FROM dbo.AR_LineUsers
      WHERE id IN (${inList(userIds)});
    `
  );
};

const getAllDepartmentNames = async () => {
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

  const set = new Set<string>();
  rows.forEach((row) => {
    const name = row.DepartmentName?.trim();
    if (!name || isLegacyPlaceholderGroup(name)) {
      return;
    }
    set.add(name);
  });

  return [...set.values()];
};

const resolveDepartmentNamesByIds = async (departmentIds: number[]) => {
  if (departmentIds.length === 0) {
    return [] as string[];
  }

  const names = await getAllDepartmentNames();
  const idSet = new Set(departmentIds);
  return names.filter((name) => idSet.has(toPseudoGroupId(name)));
};

const resolveDepartmentNamesFromPayload = async (payload: {
  groupId?: number | null;
  departmentIds?: number[];
}) => {
  const ids = dedupeNumbers(payload.departmentIds);
  if (ids.length > 0) {
    return resolveDepartmentNamesByIds(ids);
  }

  if (typeof payload.groupId === "number" && payload.groupId > 0) {
    return resolveDepartmentNamesByIds([payload.groupId]);
  }

  return [] as string[];
};

const getTaskAssigneeIds = async (taskId: number) => {
  const rows = await queryAll<{ UserId: number }>(
    `
      SELECT UserId
      FROM dbo.AR_LineTaskAssignee
      WHERE TaskSID = @taskId
      ORDER BY UserId;
    `,
    { taskId }
  );
  return dedupeNumbers(rows.map((row) => row.UserId));
};

const getTaskDepartmentNames = async (taskId: number) => {
  const rows = await queryAll<{ DepartmentName: string }>(
    `
      SELECT DepartmentName
      FROM dbo.AR_LineTaskDepartment
      WHERE TaskSID = @taskId
      ORDER BY DepartmentName;
    `,
    { taskId }
  );

  const names = rows.map((row) => row.DepartmentName.trim()).filter(Boolean);
  if (names.length > 0) {
    return names;
  }

  const legacy = await queryOne<{ DepartmentName: string | null }>(
    `
      SELECT LineGroupId AS DepartmentName
      FROM dbo.AR_LineProjectList
      WHERE SID = @taskId;
    `,
    { taskId }
  );
  const fallback = legacy?.DepartmentName?.trim();
  return fallback && !isLegacyPlaceholderGroup(fallback) ? [fallback] : [];
};

const getTaskTags = async (taskId: number) => {
  const rows = await queryAll<{ Tag: string }>(
    `
      SELECT Tag
      FROM dbo.AR_LineTaskTag
      WHERE TaskSID = @taskId
      ORDER BY Tag;
    `,
    { taskId }
  );
  return rows.map((row) => row.Tag.trim()).filter(Boolean);
};

const syncTaskAssignees = async (taskId: number, assigneeIds: number[]) => {
  await execute(
    `
      DELETE FROM dbo.AR_LineTaskAssignee
      WHERE TaskSID = @taskId;
    `,
    { taskId }
  );

  for (const userId of assigneeIds) {
    await execute(
      `
        INSERT INTO dbo.AR_LineTaskAssignee (TaskSID, UserId)
        VALUES (@taskId, @userId);
      `,
      { taskId, userId }
    );
  }
};

const syncTaskDepartments = async (taskId: number, departmentNames: string[]) => {
  await execute(
    `
      DELETE FROM dbo.AR_LineTaskDepartment
      WHERE TaskSID = @taskId;
    `,
    { taskId }
  );

  for (const departmentName of departmentNames) {
    await execute(
      `
        INSERT INTO dbo.AR_LineTaskDepartment (TaskSID, DepartmentName)
        VALUES (@taskId, @departmentName);
      `,
      { taskId, departmentName }
    );
  }
};

const syncTaskTags = async (taskId: number, tags: string[]) => {
  await execute(
    `
      DELETE FROM dbo.AR_LineTaskTag
      WHERE TaskSID = @taskId;
    `,
    { taskId }
  );

  for (const tag of tags) {
    await execute(
      `
        INSERT INTO dbo.AR_LineTaskTag (TaskSID, Tag)
        VALUES (@taskId, @tag);
      `,
      { taskId, tag }
    );
  }
};

const upsertAssignment = async (taskId: number, assignedBy: UserRow, assignedTo: UserRow | null) => {
  await execute(
    `
      MERGE dbo.AR_LineProjectAssignment AS target
      USING (SELECT @taskId AS TaskSID) AS source
      ON target.TaskSID = source.TaskSID
      WHEN MATCHED THEN
        UPDATE SET
          AssignedByUserId = @assignedByUserId,
          AssignedByLineUserId = @assignedByLineUserId,
          AssignedByName = @assignedByName,
          AssignedToLineUserId = @assignedToLineUserId,
          AssignedToName = @assignedToName,
          AssignedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (TaskSID, AssignedByUserId, AssignedByLineUserId, AssignedByName, AssignedToLineUserId, AssignedToName, AssignedAt)
        VALUES (@taskId, @assignedByUserId, @assignedByLineUserId, @assignedByName, @assignedToLineUserId, @assignedToName, SYSUTCDATETIME());
    `,
    {
      taskId,
      assignedByUserId: assignedBy.id,
      assignedByLineUserId: assignedBy.lineUserId,
      assignedByName: assignedBy.name,
      assignedToLineUserId: assignedTo?.lineUserId ?? null,
      assignedToName: assignedTo?.name ?? "未指派"
    }
  );
};

const buildWhere = async (currentUser: AuthUser, filters: TaskFilters) => {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filters.startDate) {
    clauses.push("p.DueDate >= @startDate");
    params.startDate = filters.startDate;
  }

  if (filters.endDate) {
    clauses.push("p.DueDate <= @endDate");
    params.endDate = filters.endDate;
  }

  if (filters.status && filters.status !== "all") {
    clauses.push("p.TaskStatus = @status");
    params.status = filters.status;
  }

  if (typeof filters.groupId === "number" && filters.groupId > 0) {
    const names = await resolveDepartmentNamesByIds([filters.groupId]);
    if (names.length > 0) {
      clauses.push(`
        EXISTS (
          SELECT 1
          FROM dbo.AR_LineTaskDepartment d
          WHERE d.TaskSID = p.SID AND d.DepartmentName = @departmentName
        )
      `);
      params.departmentName = names[0];
    }
  }

  if (filters.q?.trim()) {
    clauses.push(`
      (
        ISNULL(p.TaskTitle, '') LIKE @query
        OR ISNULL(p.TaskDescription, '') LIKE @query
        OR EXISTS (
          SELECT 1 FROM dbo.AR_LineTaskTag t
          WHERE t.TaskSID = p.SID AND t.Tag LIKE @query
        )
        OR EXISTS (
          SELECT 1
          FROM dbo.AR_LineTaskAssignee ta
          INNER JOIN dbo.AR_LineUsers u ON u.id = ta.UserId
          WHERE ta.TaskSID = p.SID AND (u.name LIKE @query OR ISNULL(u.lineUserId, '') LIKE @query)
        )
        OR EXISTS (
          SELECT 1 FROM dbo.AR_LineTaskDepartment d
          WHERE d.TaskSID = p.SID AND d.DepartmentName LIKE @query
        )
      )
    `);
    params.query = `%${filters.q.trim()}%`;
  }

  const scope = filters.scope ?? "all";
  if (scope === "related") {
    clauses.push(`
      (
        EXISTS (SELECT 1 FROM dbo.AR_LineTaskAssignee ta WHERE ta.TaskSID = p.SID AND ta.UserId = @currentUserId)
        OR EXISTS (SELECT 1 FROM dbo.AR_LineProjectAssignment pa WHERE pa.TaskSID = p.SID AND pa.AssignedByUserId = @currentUserId)
      )
    `);
    params.currentUserId = currentUser.id;
  }

  if (scope === "delegated") {
    clauses.push(`
      EXISTS (SELECT 1 FROM dbo.AR_LineProjectAssignment pa WHERE pa.TaskSID = p.SID AND pa.AssignedByUserId = @currentUserId)
    `);
    params.currentUserId = currentUser.id;
  }

  if (scope === "todo") {
    clauses.push(`
      p.TaskStatus = 'todo'
      AND EXISTS (SELECT 1 FROM dbo.AR_LineTaskAssignee ta WHERE ta.TaskSID = p.SID AND ta.UserId = @currentUserId)
    `);
    params.currentUserId = currentUser.id;
  }

  return {
    whereSql: clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "",
    params
  };
};

const mapTasks = async (rows: TaskRow[], includeComments: boolean): Promise<Task[]> => {
  if (rows.length === 0) {
    return [];
  }

  const taskIds = rows.map((row) => toId(row.SID));
  const idCsv = inList(taskIds);

  const assigneeRows = await queryAll<AssigneeRow>(
    `
      SELECT ta.TaskSID, u.id, u.lineUserId, u.name, u.avatar
      FROM dbo.AR_LineTaskAssignee ta
      INNER JOIN dbo.AR_LineUsers u ON u.id = ta.UserId
      WHERE ta.TaskSID IN (${idCsv})
      ORDER BY u.name ASC;
    `
  );

  const departmentRows = await queryAll<DepartmentRow>(
    `
      SELECT TaskSID, DepartmentName
      FROM dbo.AR_LineTaskDepartment
      WHERE TaskSID IN (${idCsv})
      ORDER BY DepartmentName ASC;
    `
  );

  const tagRows = await queryAll<TagRow>(
    `
      SELECT TaskSID, Tag
      FROM dbo.AR_LineTaskTag
      WHERE TaskSID IN (${idCsv})
      ORDER BY Tag ASC;
    `
  );

  const attachmentRows = await queryAll<AttachmentRow>(
    `
      SELECT ID, TaskSID, FileName, StorageFileName, ContentType, FileSize, UploadedAt
      FROM dbo.AR_LineTaskAttachment
      WHERE TaskSID IN (${idCsv})
      ORDER BY UploadedAt DESC, ID DESC;
    `
  );

  const assignmentRows = await queryAll<AssignmentRow>(
    `
      SELECT TaskSID, AssignedByUserId, AssignedByLineUserId, AssignedByName, AssignedAt
      FROM dbo.AR_LineProjectAssignment
      WHERE TaskSID IN (${idCsv});
    `
  );

  const commentRows = includeComments
    ? await queryAll<CommentRow>(
        `
          SELECT
            c.ID,
            c.TaskSID,
            c.UserId,
            c.LineUserId,
            c.UserName,
            c.UserAvatar,
            c.Message,
            c.CreatedAt,
            u.id AS RefUserId,
            u.lineUserId AS RefLineUserId,
            u.name AS RefUserName,
            u.avatar AS RefUserAvatar
          FROM dbo.AR_LineTaskComment c
          LEFT JOIN dbo.AR_LineUsers u ON u.id = c.UserId
          WHERE c.TaskSID IN (${idCsv})
          ORDER BY c.CreatedAt ASC, c.ID ASC;
        `
      )
    : [];

  const assigneesMap = new Map<number, User[]>();
  assigneeRows.forEach((row) => {
    const taskId = toId(row.TaskSID);
    const list = assigneesMap.get(taskId) ?? [];
    list.push({ id: row.id, lineUserId: row.lineUserId, name: row.name, avatar: row.avatar });
    assigneesMap.set(taskId, list);
  });

  const departmentsMap = new Map<number, Group[]>();
  departmentRows.forEach((row) => {
    const taskId = toId(row.TaskSID);
    const name = row.DepartmentName?.trim();
    if (!name || isLegacyPlaceholderGroup(name)) {
      return;
    }
    const list = departmentsMap.get(taskId) ?? [];
    list.push({ id: toPseudoGroupId(name), name });
    departmentsMap.set(taskId, list);
  });

  const tagsMap = new Map<number, string[]>();
  tagRows.forEach((row) => {
    const taskId = toId(row.TaskSID);
    const list = tagsMap.get(taskId) ?? [];
    list.push(row.Tag);
    tagsMap.set(taskId, list);
  });

  const attachmentsMap = new Map<number, Attachment[]>();
  attachmentRows.forEach((row) => {
    const taskId = toId(row.TaskSID);
    const list = attachmentsMap.get(taskId) ?? [];
    list.push({
      id: toId(row.ID),
      taskId,
      fileName: row.FileName,
      fileSize: Number(row.FileSize),
      contentType: row.ContentType,
      url: attachmentUrl(row.StorageFileName, row.FileName),
      uploadedAt: toIso(row.UploadedAt) ?? new Date().toISOString()
    });
    attachmentsMap.set(taskId, list);
  });

  const assignmentMap = new Map<number, AssignmentRow>();
  assignmentRows.forEach((row) => assignmentMap.set(toId(row.TaskSID), row));

  const commentsMap = new Map<number, TaskComment[]>();
  commentRows.forEach((row) => {
    const taskId = toId(row.TaskSID);
    const fallbackName = row.RefUserName?.trim() || row.UserName?.trim() || "未知使用者";
    const fallbackLineUserId = row.RefLineUserId ?? row.LineUserId ?? null;
    const fallbackAvatar =
      row.RefUserAvatar ??
      row.UserAvatar ??
      `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(fallbackName)}`;
    const userId = row.RefUserId ?? row.UserId ?? toPseudoUserId(fallbackLineUserId || fallbackName);

    const list = commentsMap.get(taskId) ?? [];
    list.push({
      id: toId(row.ID),
      taskId,
      userId,
      message: row.Message,
      createdAt: toIso(row.CreatedAt) ?? new Date().toISOString(),
      user: { id: userId, lineUserId: fallbackLineUserId, name: fallbackName, avatar: fallbackAvatar }
    });
    commentsMap.set(taskId, list);
  });

  return rows.map((row) => {
    const taskId = toId(row.SID);
    const assignees = assigneesMap.get(taskId) ?? [];
    const tags = tagsMap.get(taskId) ?? [];
    const attachments = attachmentsMap.get(taskId) ?? [];
    const comments = commentsMap.get(taskId) ?? [];

    const departments = departmentsMap.get(taskId) ?? [];
    if (departments.length === 0) {
      const fallback = row.LineGroupId?.trim();
      if (fallback && !isLegacyPlaceholderGroup(fallback)) {
        departments.push({ id: toPseudoGroupId(fallback), name: fallback });
      }
    }

    const primaryDepartment = departments[0] ?? null;
    const assignment = assignmentMap.get(taskId) ?? null;
    let assignedBy: User | null = null;
    if (assignment?.AssignedByName) {
      const name = assignment.AssignedByName.trim() || "未知使用者";
      assignedBy = {
        id: assignment.AssignedByUserId ?? toPseudoUserId(assignment.AssignedByLineUserId || name),
        lineUserId: assignment.AssignedByLineUserId ?? null,
        name,
        avatar: `https://api.dicebear.com/9.x/thumbs/svg?seed=${encodeURIComponent(name)}`
      };
    }

    return {
      id: taskId,
      title: row.TaskTitle?.trim() || "未命名任務",
      description: row.TaskDescription?.trim() || "",
      status: toStatus(row.TaskStatus),
      dueDate: toDateOnly(row.DueDate),
      groupId: primaryDepartment?.id ?? null,
      group: primaryDepartment,
      departmentIds: departments.map((department) => department.id),
      departments,
      createdBy: assignedBy?.id ?? assignees[0]?.id ?? toPseudoUserId(String(taskId)),
      assignees,
      assignedBy,
      assignedTo: assignees[0] ?? null,
      assignedAt: toIso(assignment?.AssignedAt ?? row.UpdatedAt ?? row.CreatedAt),
      tags,
      attachments,
      comments
    };
  });
};

export const getTaskManagePermission = async (
  taskId: number,
  currentUser: AuthUser
): Promise<TaskManagePermissionResult> => {
  const row = await queryOne<PermissionRow>(
    `
      SELECT
        p.SID,
        p.AssigneeDisplayName,
        p.AssigneeLineUserId,
        pa.AssignedByUserId,
        CASE WHEN EXISTS (
          SELECT 1 FROM dbo.AR_LineTaskAssignee ta
          WHERE ta.TaskSID = p.SID AND ta.UserId = @currentUserId
        ) THEN 1 ELSE 0 END AS IsAssignedToCurrent
      FROM dbo.AR_LineProjectList p
      LEFT JOIN dbo.AR_LineProjectAssignment pa ON pa.TaskSID = p.SID
      WHERE p.SID = @taskId;
    `,
    { taskId, currentUserId: currentUser.id }
  );

  if (!row) {
    return "task_not_found";
  }
  if (currentUser.isAdmin) {
    return "allowed";
  }
  if (row.AssignedByUserId && row.AssignedByUserId === currentUser.id) {
    return "allowed";
  }
  if (Number(row.IsAssignedToCurrent) === 1) {
    return "allowed";
  }

  const currentLine = currentUser.lineUserId?.trim() ?? "";
  const taskLine = row.AssigneeLineUserId?.trim() ?? "";
  if (currentLine && taskLine && currentLine === taskLine) {
    return "allowed";
  }

  if (normalizeName(row.AssigneeDisplayName) === normalizeName(currentUser.name)) {
    return "allowed";
  }

  return "forbidden";
};

export const getTaskById = async (taskId: number): Promise<Task | null> => {
  const row = await getTaskRow(taskId);
  if (!row) {
    return null;
  }
  const mapped = await mapTasks([row], true);
  return mapped[0] ?? null;
};

export const listTasks = async (currentUserId: number, filters: TaskFilters = {}): Promise<Task[]> => {
  const currentUser = await queryOne<AuthUser>(
    `
      SELECT id, lineUserId, internalUserNo, name, avatar,
        CAST(ISNULL(IsAdmin, 0) AS BIT) AS isAdmin,
        CASE WHEN internalUserNo IS NULL THEN 'line' ELSE 'internal' END AS authProvider
      FROM dbo.AR_LineUsers
      WHERE id = @id;
    `,
    { id: currentUserId }
  );

  if (!currentUser) {
    return [];
  }

  const { whereSql, params } = await buildWhere(currentUser, filters);
  const rows = await queryAll<TaskRow>(
    `
      SELECT
        p.SID,
        p.TaskTitle,
        p.TaskDescription,
        p.TaskStatus,
        p.LineGroupId,
        p.AssigneeDisplayName,
        p.AssigneeLineUserId,
        p.DueDate,
        p.CreatedAt,
        p.UpdatedAt
      FROM dbo.AR_LineProjectList p
      ${whereSql}
      ORDER BY
        CASE WHEN p.TaskStatus = 'todo' THEN 0 ELSE 1 END,
        p.DueDate ASC,
        COALESCE(p.UpdatedAt, p.CreatedAt) DESC,
        p.SID DESC;
    `,
    params
  );

  return mapTasks(rows, false);
};

export const createTask = async (currentUserId: number, payload: CreateTaskInput): Promise<Task> => {
  const creator = await getCurrentUser(currentUserId);
  if (!creator) {
    throw new Error("找不到目前使用者。");
  }

  const assigneeIds = dedupeNumbers(payload.assigneeIds);
  const assigneeUsers = await getUsersByIds(assigneeIds);
  const departmentNames = await resolveDepartmentNamesFromPayload(payload);
  const tags = dedupeTags(payload.tags);
  await ensureDepartmentNamesRegistered(departmentNames);

  const primaryAssignee = assigneeUsers[0] ?? null;
  const primaryDepartment = departmentNames[0] ?? null;
  const now = new Date().toISOString();

  const inserted = await queryOne<{ SID: number | string }>(
    `
      INSERT INTO dbo.AR_LineProjectList (
        TaskTitle,
        TaskDescription,
        TaskStatus,
        LineGroupId,
        AssigneeDisplayName,
        AssigneeLineUserId,
        DueDate,
        CreatedAt,
        UpdatedAt
      )
      OUTPUT INSERTED.SID
      VALUES (
        @title,
        @description,
        @status,
        @lineGroupId,
        @assigneeDisplayName,
        @assigneeLineUserId,
        @dueDate,
        @createdAt,
        @updatedAt
      );
    `,
    {
      title: payload.title.trim() || "未命名任務",
      description: payload.description?.trim() ?? "",
      status: payload.status === "done" ? "done" : "todo",
      lineGroupId: primaryDepartment,
      assigneeDisplayName: primaryAssignee?.name ?? "未指派",
      assigneeLineUserId: primaryAssignee?.lineUserId ?? null,
      dueDate: payload.dueDate ?? toDateOnly(null),
      createdAt: now,
      updatedAt: now
    }
  );

  if (!inserted) {
    throw new Error("Failed to create task.");
  }

  const taskId = toId(inserted.SID);
  await syncTaskAssignees(taskId, assigneeUsers.map((user) => user.id));
  await syncTaskDepartments(taskId, departmentNames);
  await syncTaskTags(taskId, tags);
  await upsertAssignment(taskId, creator, primaryAssignee);

  const task = await getTaskById(taskId);
  if (!task) {
    throw new Error("Failed to load created task.");
  }
  return task;
};

export const updateTask = async (
  currentUserId: number,
  taskId: number,
  payload: UpdateTaskInput
): Promise<Task | null> => {
  const existing = await getTaskRow(taskId);
  if (!existing) {
    return null;
  }

  const operator = await getCurrentUser(currentUserId);
  if (!operator) {
    throw new Error("找不到目前使用者。");
  }

  const assigneeIds =
    payload.assigneeIds !== undefined
      ? dedupeNumbers(payload.assigneeIds)
      : await getTaskAssigneeIds(taskId);
  const assigneeUsers = await getUsersByIds(assigneeIds);
  const primaryAssignee = assigneeUsers[0] ?? null;

  const departmentNames =
    payload.departmentIds !== undefined || payload.groupId !== undefined
      ? await resolveDepartmentNamesFromPayload(payload)
      : await getTaskDepartmentNames(taskId);

  const tags = payload.tags !== undefined ? dedupeTags(payload.tags) : await getTaskTags(taskId);
  await ensureDepartmentNamesRegistered(departmentNames);

  await execute(
    `
      UPDATE dbo.AR_LineProjectList
      SET
        TaskTitle = @title,
        TaskDescription = @description,
        TaskStatus = @status,
        LineGroupId = @lineGroupId,
        AssigneeDisplayName = @assigneeDisplayName,
        AssigneeLineUserId = @assigneeLineUserId,
        DueDate = @dueDate,
        UpdatedAt = @updatedAt
      WHERE SID = @taskId;
    `,
    {
      taskId,
      title: payload.title?.trim() || existing.TaskTitle?.trim() || "未命名任務",
      description: payload.description?.trim() ?? existing.TaskDescription?.trim() ?? "",
      status: payload.status ? toStatus(payload.status) : toStatus(existing.TaskStatus),
      lineGroupId: departmentNames[0] ?? null,
      assigneeDisplayName: primaryAssignee?.name ?? "未指派",
      assigneeLineUserId: primaryAssignee?.lineUserId ?? null,
      dueDate: payload.dueDate ?? toDateOnly(existing.DueDate),
      updatedAt: new Date().toISOString()
    }
  );

  await syncTaskAssignees(taskId, assigneeIds);
  await syncTaskDepartments(taskId, departmentNames);
  await syncTaskTags(taskId, tags);

  if (payload.assigneeIds !== undefined) {
    await upsertAssignment(taskId, operator, primaryAssignee);
  }

  return getTaskById(taskId);
};

export const deleteTask = async (taskId: number): Promise<boolean> => {
  await execute(
    `
      DELETE FROM dbo.AR_LineTaskAssignee WHERE TaskSID = @taskId;
      DELETE FROM dbo.AR_LineTaskDepartment WHERE TaskSID = @taskId;
      DELETE FROM dbo.AR_LineTaskTag WHERE TaskSID = @taskId;
      DELETE FROM dbo.AR_LineTaskAttachment WHERE TaskSID = @taskId;
      DELETE FROM dbo.AR_LineProjectAssignment WHERE TaskSID = @taskId;
      DELETE FROM dbo.AR_LineTaskComment WHERE TaskSID = @taskId;
      DELETE FROM dbo.AR_LineTaskNotification WHERE TaskSID = @taskId;
    `,
    { taskId }
  );

  const result = await execute(
    `
      DELETE FROM dbo.AR_LineProjectList
      WHERE SID = @taskId;
    `,
    { taskId }
  );

  return (result.rowsAffected[result.rowsAffected.length - 1] ?? 0) > 0;
};

export const setTaskStatus = async (taskId: number, status: TaskStatus): Promise<Task | null> => {
  const result = await execute(
    `
      UPDATE dbo.AR_LineProjectList
      SET TaskStatus = @status, UpdatedAt = @updatedAt
      WHERE SID = @taskId;
    `,
    { taskId, status, updatedAt: new Date().toISOString() }
  );

  if ((result.rowsAffected[0] ?? 0) === 0) {
    return null;
  }
  return getTaskById(taskId);
};

const collectRecipients = async (taskId: number, actorUserId: number) => {
  const ids = new Set<number>();

  const assignment = await queryOne<{ AssignedByUserId: number | null }>(
    `
      SELECT AssignedByUserId
      FROM dbo.AR_LineProjectAssignment
      WHERE TaskSID = @taskId;
    `,
    { taskId }
  );
  if (assignment?.AssignedByUserId) {
    ids.add(assignment.AssignedByUserId);
  }

  const assignees = await queryAll<{ UserId: number }>(
    `
      SELECT UserId
      FROM dbo.AR_LineTaskAssignee
      WHERE TaskSID = @taskId;
    `,
    { taskId }
  );
  assignees.forEach((row) => ids.add(row.UserId));

  const participants = await queryAll<{ UserId: number | null }>(
    `
      SELECT DISTINCT UserId
      FROM dbo.AR_LineTaskComment
      WHERE TaskSID = @taskId AND UserId IS NOT NULL;
    `,
    { taskId }
  );
  participants.forEach((row) => {
    if (row.UserId) {
      ids.add(row.UserId);
    }
  });

  ids.delete(actorUserId);
  if (ids.size === 0) {
    ids.add(actorUserId);
  }

  return [...ids.values()];
};

const createCommentNotifications = async (
  taskId: number,
  actor: UserRow,
  taskTitle: string,
  message: string
) => {
  const recipients = await collectRecipients(taskId, actor.id);
  const normalizedTitle = taskTitle.trim() || "未命名任務";
  const preview = message.trim().replace(/\s+/g, " ").slice(0, 90);
  const notificationMessage = `${actor.name} 在「${normalizedTitle}」留言：${preview}`.slice(0, 290);

  for (const recipientId of recipients) {
    await execute(
      `
        INSERT INTO dbo.AR_LineTaskNotification (
          UserId,
          TaskSID,
          NotificationType,
          Message,
          IsRead,
          TriggerByUserId,
          CreatedAt
        )
        VALUES (
          @recipientId,
          @taskId,
          'comment',
          @message,
          0,
          @triggerByUserId,
          SYSUTCDATETIME()
        );
      `,
      {
        recipientId,
        taskId,
        message: notificationMessage,
        triggerByUserId: actor.id
      }
    );
  }
};

export const addComment = async (taskId: number, message: string, userId: number): Promise<Task | null> => {
  const task = await queryOne<{ TaskTitle: string | null }>(
    `
      SELECT TaskTitle
      FROM dbo.AR_LineProjectList
      WHERE SID = @taskId;
    `,
    { taskId }
  );
  if (!task) {
    return null;
  }

  const actor = await getCurrentUser(userId);
  if (!actor) {
    throw new Error("找不到目前使用者。");
  }

  await execute(
    `
      INSERT INTO dbo.AR_LineTaskComment (
        TaskSID,
        UserId,
        LineUserId,
        UserName,
        UserAvatar,
        Message,
        CreatedAt
      )
      VALUES (
        @taskId,
        @userId,
        @lineUserId,
        @userName,
        @userAvatar,
        @message,
        SYSUTCDATETIME()
      );
    `,
    {
      taskId,
      userId: actor.id,
      lineUserId: actor.lineUserId,
      userName: actor.name,
      userAvatar: actor.avatar,
      message: message.trim()
    }
  );

  await createCommentNotifications(taskId, actor, task.TaskTitle ?? "", message);
  return getTaskById(taskId);
};

export const deleteComment = async (
  taskId: number,
  commentId: number,
  userId: number,
  isAdmin = false
): Promise<DeleteCommentResult> => {
  const taskExists = await queryOne<{ SID: number | string }>(
    `
      SELECT SID
      FROM dbo.AR_LineProjectList
      WHERE SID = @taskId;
    `,
    { taskId }
  );
  if (!taskExists) {
    return { status: "task_not_found" };
  }

  const comment = await queryOne<{ ID: number | string; UserId: number | null }>(
    `
      SELECT ID, UserId
      FROM dbo.AR_LineTaskComment
      WHERE TaskSID = @taskId AND ID = @commentId;
    `,
    { taskId, commentId }
  );
  if (!comment) {
    return { status: "comment_not_found" };
  }

  if (!isAdmin && (!comment.UserId || comment.UserId !== userId)) {
    return { status: "forbidden" };
  }

  const result = isAdmin
    ? await execute(
        `
          DELETE FROM dbo.AR_LineTaskComment
          WHERE TaskSID = @taskId AND ID = @commentId;
        `,
        { taskId, commentId }
      )
    : await execute(
        `
          DELETE FROM dbo.AR_LineTaskComment
          WHERE TaskSID = @taskId AND ID = @commentId AND UserId = @userId;
        `,
        { taskId, commentId, userId }
      );

  if ((result.rowsAffected[0] ?? 0) === 0) {
    return { status: "comment_not_found" };
  }

  const task = await getTaskById(taskId);
  if (!task) {
    return { status: "task_not_found" };
  }
  return { status: "deleted", task };
};

export const addAttachment = async (
  taskId: number,
  payload: AddAttachmentInput
): Promise<Task | null> => {
  const existing = await getTaskRow(taskId);
  if (!existing) {
    return null;
  }

  await execute(
    `
      INSERT INTO dbo.AR_LineTaskAttachment (
        TaskSID,
        FileName,
        StorageFileName,
        ContentType,
        FileSize,
        UploadedByUserId,
        UploadedAt
      )
      VALUES (
        @taskId,
        @fileName,
        @storageFileName,
        @contentType,
        @fileSize,
        @uploadedByUserId,
        SYSUTCDATETIME()
      );
    `,
    {
      taskId,
      fileName: payload.fileName,
      storageFileName: payload.storageFileName,
      contentType: payload.contentType,
      fileSize: payload.fileSize,
      uploadedByUserId: payload.uploadedByUserId
    }
  );

  return getTaskById(taskId);
};

export const deleteAttachment = async (
  taskId: number,
  attachmentId: number
): Promise<DeleteAttachmentResult> => {
  const existingTask = await getTaskRow(taskId);
  if (!existingTask) {
    return { status: "task_not_found" };
  }

  const attachment = await queryOne<{ ID: number | string; StorageFileName: string | null }>(
    `
      SELECT ID, StorageFileName
      FROM dbo.AR_LineTaskAttachment
      WHERE TaskSID = @taskId AND ID = @attachmentId;
    `,
    { taskId, attachmentId }
  );
  if (!attachment) {
    return { status: "attachment_not_found" };
  }

  const result = await execute(
    `
      DELETE FROM dbo.AR_LineTaskAttachment
      WHERE TaskSID = @taskId AND ID = @attachmentId;
    `,
    { taskId, attachmentId }
  );
  if ((result.rowsAffected[0] ?? 0) === 0) {
    return { status: "attachment_not_found" };
  }

  const task = await getTaskById(taskId);
  if (!task) {
    return { status: "task_not_found" };
  }

  return {
    status: "deleted",
    task,
    storageFileName: attachment.StorageFileName ?? null
  };
};
