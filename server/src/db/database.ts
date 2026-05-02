import sql, { type ConnectionPool, type Transaction } from "mssql";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({
  path: path.resolve(__dirname, "../../../.env")
});

type SqlParams = Record<string, unknown>;

const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) {
    return fallback;
  }
  return value.toLowerCase() === "true";
};

const mssqlConfig: sql.config = {
  server: process.env.MSSQL_HOST ?? "localhost",
  port: Number(process.env.MSSQL_PORT ?? 1433),
  database: process.env.MSSQL_DATABASE ?? "CoworksTaskBoard",
  user: process.env.MSSQL_USER ?? "sa",
  password: process.env.MSSQL_PASSWORD ?? "YourStrong!Passw0rd",
  options: {
    encrypt: parseBoolean(process.env.MSSQL_ENCRYPT, false),
    trustServerCertificate: parseBoolean(process.env.MSSQL_TRUST_SERVER_CERTIFICATE, true)
  },
  pool: {
    min: 0,
    max: 10,
    idleTimeoutMillis: 30_000
  }
};

let poolPromise: Promise<ConnectionPool> | null = null;

const getPool = async () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(mssqlConfig).connect();
  }
  return poolPromise;
};

const bindParams = (
  request: sql.Request | sql.PreparedStatement,
  params: SqlParams
) => {
  Object.entries(params).forEach(([key, rawValue]) => {
    if (rawValue === undefined || rawValue === null) {
      request.input(key, sql.NVarChar(sql.MAX), null);
      return;
    }
    request.input(key, rawValue as never);
  });
};

export const queryAll = async <T>(queryText: string, params: SqlParams = {}, tx?: Transaction) => {
  const request = tx ? new sql.Request(tx) : (await getPool()).request();
  bindParams(request, params);
  const result = await request.query<T>(queryText);
  return Array.isArray(result.recordset) ? result.recordset : [];
};

export const queryOne = async <T>(queryText: string, params: SqlParams = {}, tx?: Transaction) => {
  const rows = await queryAll<T>(queryText, params, tx);
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }
  for (const row of rows) {
    return row ?? null;
  }
  return null;
};

export const execute = async (queryText: string, params: SqlParams = {}, tx?: Transaction) => {
  const request = tx ? new sql.Request(tx) : (await getPool()).request();
  bindParams(request, params);
  return request.query(queryText);
};

const enableSampleData = parseBoolean(process.env.ENABLE_SAMPLE_DATA, false);

const hasProjectListColumn = async (columnName: string) => {
  const row = await queryOne<{ columnExists: number }>(
    `
      SELECT CASE
        WHEN EXISTS (
          SELECT 1
          FROM sys.columns
          WHERE object_id = OBJECT_ID('dbo.AR_LineProjectList')
            AND name = @columnName
        ) THEN 1
        ELSE 0
      END AS columnExists;
    `,
    { columnName }
  );

  return Number(row?.columnExists ?? 0) === 1;
};

const migrateLegacyTableNames = async () => {
  await execute(`
    IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
      AND OBJECT_ID('dbo.AR_LineUsers', 'U') IS NULL
    BEGIN
      EXEC sp_rename 'dbo.users', 'AR_LineUsers';
    END;
  `);
};

const normalizeActiveTableNameCase = async () => {
  await execute(`
    IF EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_Lineusers')
      AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_LineUsers')
    BEGIN
      EXEC sp_rename 'dbo.AR_Lineusers', 'AR_LineUsers_tmp_case';
      EXEC sp_rename 'dbo.AR_LineUsers_tmp_case', 'AR_LineUsers';
    END;

    IF EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_Lineprojectassignment')
      AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_LineProjectAssignment')
    BEGIN
      EXEC sp_rename 'dbo.AR_Lineprojectassignment', 'AR_LineProjectAssignment_tmp_case';
      EXEC sp_rename 'dbo.AR_LineProjectAssignment_tmp_case', 'AR_LineProjectAssignment';
    END;

    IF EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_Lineprojectlist')
      AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_LineProjectList')
    BEGIN
      EXEC sp_rename 'dbo.AR_Lineprojectlist', 'AR_LineProjectList_tmp_case';
      EXEC sp_rename 'dbo.AR_LineProjectList_tmp_case', 'AR_LineProjectList';
    END;

    IF EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_Linetaskcomment')
      AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_LineTaskComment')
    BEGIN
      EXEC sp_rename 'dbo.AR_Linetaskcomment', 'AR_LineTaskComment_tmp_case';
      EXEC sp_rename 'dbo.AR_LineTaskComment_tmp_case', 'AR_LineTaskComment';
    END;

    IF EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_Linetasknotification')
      AND NOT EXISTS (SELECT 1 FROM sys.tables WHERE name COLLATE Latin1_General_BIN = 'AR_LineTaskNotification')
    BEGIN
      EXEC sp_rename 'dbo.AR_Linetasknotification', 'AR_LineTaskNotification_tmp_case';
      EXEC sp_rename 'dbo.AR_LineTaskNotification_tmp_case', 'AR_LineTaskNotification';
    END;
  `);
};

const ensureProjectListColumns = async () => {
  await execute(`
    IF OBJECT_ID('dbo.AR_LineProjectList', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineProjectList (
        SID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TaskTitle NVARCHAR(200) NULL,
        TaskDescription NVARCHAR(MAX) NULL,
        TaskStatus NVARCHAR(20) NULL,
        LineGroupId NVARCHAR(200) NULL,
        AssigneeDisplayName NVARCHAR(200) NULL,
        AssigneeLineUserId NVARCHAR(200) NULL,
        DueDate DATE NULL,
        CreatedAt DATETIME2 NULL,
        UpdatedAt DATETIME2 NULL
      );
    END;

    IF COL_LENGTH('dbo.AR_LineProjectList', 'TaskTitle') IS NULL
      ALTER TABLE dbo.AR_LineProjectList ADD TaskTitle NVARCHAR(200) NULL;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'TaskDescription') IS NULL
      ALTER TABLE dbo.AR_LineProjectList ADD TaskDescription NVARCHAR(MAX) NULL;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'TaskStatus') IS NULL
      ALTER TABLE dbo.AR_LineProjectList ADD TaskStatus NVARCHAR(20) NULL;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'AssigneeDisplayName') IS NULL
      ALTER TABLE dbo.AR_LineProjectList ADD AssigneeDisplayName NVARCHAR(200) NULL;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'AssigneeLineUserId') IS NULL
      ALTER TABLE dbo.AR_LineProjectList ADD AssigneeLineUserId NVARCHAR(200) NULL;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'DueDate') IS NULL
      ALTER TABLE dbo.AR_LineProjectList ADD DueDate DATE NULL;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'CreatedAt') IS NULL
      ALTER TABLE dbo.AR_LineProjectList ADD CreatedAt DATETIME2 NULL;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'UpdatedAt') IS NULL
      ALTER TABLE dbo.AR_LineProjectList ADD UpdatedAt DATETIME2 NULL;
  `);

  if (await hasProjectListColumn("TaskContent")) {
    await execute(`
      ;WITH normalized AS (
        SELECT
          SID,
          REPLACE(ISNULL(TaskContent, ''), CHAR(13) + CHAR(10), CHAR(10)) AS NormalizedContent
        FROM dbo.AR_LineProjectList
      )
      UPDATE p
      SET TaskTitle = COALESCE(
        NULLIF(LTRIM(RTRIM(p.TaskTitle)), ''),
        NULLIF(
          LEFT(
            CASE
              WHEN CHARINDEX(CHAR(10), n.NormalizedContent) > 0 THEN LEFT(n.NormalizedContent, CHARINDEX(CHAR(10), n.NormalizedContent) - 1)
              ELSE n.NormalizedContent
            END,
            200
          ),
          ''
        )
      )
      FROM dbo.AR_LineProjectList p
      INNER JOIN normalized n ON n.SID = p.SID
      WHERE NULLIF(LTRIM(RTRIM(p.TaskTitle)), '') IS NULL;

      ;WITH normalized AS (
        SELECT
          SID,
          REPLACE(ISNULL(TaskContent, ''), CHAR(13) + CHAR(10), CHAR(10)) AS NormalizedContent
        FROM dbo.AR_LineProjectList
      )
      UPDATE p
      SET TaskDescription = COALESCE(
        NULLIF(LTRIM(RTRIM(p.TaskDescription)), ''),
        NULLIF(
          CASE
            WHEN CHARINDEX(CHAR(10), n.NormalizedContent) > 0 THEN LTRIM(RTRIM(SUBSTRING(n.NormalizedContent, CHARINDEX(CHAR(10), n.NormalizedContent) + 1, LEN(n.NormalizedContent))))
            ELSE LTRIM(RTRIM(n.NormalizedContent))
          END,
          ''
        )
      )
      FROM dbo.AR_LineProjectList p
      INNER JOIN normalized n ON n.SID = p.SID
      WHERE NULLIF(LTRIM(RTRIM(p.TaskDescription)), '') IS NULL;
    `);
  }

  if (await hasProjectListColumn("TaskSummary")) {
    await execute(`
      UPDATE dbo.AR_LineProjectList
      SET TaskDescription = LTRIM(RTRIM(TaskSummary))
      WHERE NULLIF(LTRIM(RTRIM(TaskDescription)), '') IS NULL
        AND NULLIF(LTRIM(RTRIM(TaskSummary)), '') IS NOT NULL;
    `);
  }

  if (await hasProjectListColumn("Status")) {
    await execute(`
      UPDATE dbo.AR_LineProjectList
      SET TaskStatus = CASE WHEN ISNULL(Status, 0) = 1 THEN 'done' ELSE 'todo' END
      WHERE NULLIF(LTRIM(RTRIM(TaskStatus)), '') IS NULL;
    `);
  }

  if (await hasProjectListColumn("MemberName")) {
    await execute(`
      UPDATE dbo.AR_LineProjectList
      SET AssigneeDisplayName = LTRIM(RTRIM(MemberName))
      WHERE NULLIF(LTRIM(RTRIM(AssigneeDisplayName)), '') IS NULL
        AND NULLIF(LTRIM(RTRIM(MemberName)), '') IS NOT NULL;
    `);
  }

  if (await hasProjectListColumn("LineUserID")) {
    await execute(`
      UPDATE dbo.AR_LineProjectList
      SET AssigneeLineUserId = LTRIM(RTRIM(LineUserID))
      WHERE NULLIF(LTRIM(RTRIM(AssigneeLineUserId)), '') IS NULL
        AND NULLIF(LTRIM(RTRIM(LineUserID)), '') IS NOT NULL;
    `);
  }

  if (await hasProjectListColumn("Dday")) {
    await execute(`
      UPDATE dbo.AR_LineProjectList
      SET DueDate = Dday
      WHERE DueDate IS NULL AND Dday IS NOT NULL;
    `);
  }

  if (await hasProjectListColumn("CreDate")) {
    await execute(`
      UPDATE dbo.AR_LineProjectList
      SET CreatedAt = CAST(CreDate AS DATETIME2)
      WHERE CreatedAt IS NULL AND CreDate IS NOT NULL;
    `);
  }

  await execute(`
    UPDATE dbo.AR_LineProjectList
    SET
      TaskTitle = COALESCE(NULLIF(LTRIM(RTRIM(TaskTitle)), ''), '未命名任務'),
      TaskDescription = COALESCE(NULLIF(LTRIM(RTRIM(TaskDescription)), ''), ''),
      TaskStatus = CASE
        WHEN LTRIM(RTRIM(ISNULL(TaskStatus, ''))) = 'done' THEN 'done'
        ELSE 'todo'
      END,
      AssigneeDisplayName = COALESCE(NULLIF(LTRIM(RTRIM(AssigneeDisplayName)), ''), '未指派'),
      DueDate = COALESCE(DueDate, DATEADD(DAY, 7, CAST(GETDATE() AS DATE))),
      CreatedAt = COALESCE(CreatedAt, CAST(SYSUTCDATETIME() AS DATETIME2)),
      UpdatedAt = COALESCE(UpdatedAt, CreatedAt, CAST(SYSUTCDATETIME() AS DATETIME2));
  `);

  await execute(`
    DECLARE @constraintName SYSNAME;

    IF COL_LENGTH('dbo.AR_LineProjectList', 'Status') IS NOT NULL
    BEGIN
      SELECT @constraintName = dc.name
      FROM sys.default_constraints dc
      INNER JOIN sys.columns c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
      WHERE dc.parent_object_id = OBJECT_ID('dbo.AR_LineProjectList')
        AND c.name = 'Status';

      IF @constraintName IS NOT NULL
      BEGIN
        EXEC('ALTER TABLE dbo.AR_LineProjectList DROP CONSTRAINT [' + @constraintName + ']');
      END;
    END;

    IF COL_LENGTH('dbo.AR_LineProjectList', 'CreDate') IS NOT NULL
    BEGIN
      SELECT @constraintName = dc.name
      FROM sys.default_constraints dc
      INNER JOIN sys.columns c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
      WHERE dc.parent_object_id = OBJECT_ID('dbo.AR_LineProjectList')
        AND c.name = 'CreDate';

      IF @constraintName IS NOT NULL
      BEGIN
        EXEC('ALTER TABLE dbo.AR_LineProjectList DROP CONSTRAINT [' + @constraintName + ']');
      END;
    END;

    IF COL_LENGTH('dbo.AR_LineProjectList', 'MemberName') IS NOT NULL
      ALTER TABLE dbo.AR_LineProjectList DROP COLUMN MemberName;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'TaskContent') IS NOT NULL
      ALTER TABLE dbo.AR_LineProjectList DROP COLUMN TaskContent;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'Status') IS NOT NULL
      ALTER TABLE dbo.AR_LineProjectList DROP COLUMN Status;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'LineUserID') IS NOT NULL
      ALTER TABLE dbo.AR_LineProjectList DROP COLUMN LineUserID;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'Dday') IS NOT NULL
      ALTER TABLE dbo.AR_LineProjectList DROP COLUMN Dday;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'CreDate') IS NOT NULL
      ALTER TABLE dbo.AR_LineProjectList DROP COLUMN CreDate;
    IF COL_LENGTH('dbo.AR_LineProjectList', 'TaskSummary') IS NOT NULL
      ALTER TABLE dbo.AR_LineProjectList DROP COLUMN TaskSummary;
  `);

  await execute(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_AR_LineProjectList_TaskStatus_DueDate' AND object_id = OBJECT_ID('dbo.AR_LineProjectList')
    )
    BEGIN
      CREATE INDEX IX_AR_LineProjectList_TaskStatus_DueDate
      ON dbo.AR_LineProjectList(TaskStatus, DueDate);
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_AR_LineProjectList_AssigneeLineUserId' AND object_id = OBJECT_ID('dbo.AR_LineProjectList')
    )
    BEGIN
      CREATE INDEX IX_AR_LineProjectList_AssigneeLineUserId
      ON dbo.AR_LineProjectList(AssigneeLineUserId);
    END;
  `);
};

const createSchema = async () => {
  await execute(`
    IF OBJECT_ID('dbo.AR_LineUsers', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineUsers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        lineUserId NVARCHAR(80) NULL,
        internalUserNo NVARCHAR(80) NULL,
        name NVARCHAR(120) NOT NULL,
        avatar NVARCHAR(500) NOT NULL,
        IsAdmin BIT NOT NULL CONSTRAINT DF_AR_LineUsers_IsAdmin DEFAULT ((0))
      );
    END;
  `);

  await execute(`
    IF COL_LENGTH('dbo.AR_LineUsers', 'internalUserNo') IS NULL
      ALTER TABLE dbo.AR_LineUsers ADD internalUserNo NVARCHAR(80) NULL;

    IF COL_LENGTH('dbo.AR_LineUsers', 'IsAdmin') IS NULL
      ALTER TABLE dbo.AR_LineUsers
      ADD IsAdmin BIT NOT NULL CONSTRAINT DF_AR_LineUsers_IsAdmin DEFAULT ((0));
  `);

  await execute(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE object_id = OBJECT_ID('dbo.AR_LineUsers')
        AND name IN ('UX_users_lineUserId', 'UX_AR_LineUsers_lineUserId')
    )
    BEGIN
      CREATE UNIQUE INDEX UX_AR_LineUsers_lineUserId
      ON dbo.AR_LineUsers(lineUserId)
      WHERE lineUserId IS NOT NULL;
    END;
  `);

  await execute(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE object_id = OBJECT_ID('dbo.AR_LineUsers')
        AND name = 'UX_AR_LineUsers_internalUserNo'
    )
    BEGIN
      CREATE UNIQUE INDEX UX_AR_LineUsers_internalUserNo
      ON dbo.AR_LineUsers(internalUserNo)
      WHERE internalUserNo IS NOT NULL;
    END;
  `);

  await execute(`
    IF OBJECT_ID('dbo.AR_LineProjectAssignment', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineProjectAssignment (
        TaskSID BIGINT NOT NULL PRIMARY KEY,
        AssignedByUserId INT NULL,
        AssignedByLineUserId NVARCHAR(200) NULL,
        AssignedByName NVARCHAR(200) NOT NULL,
        AssignedToLineUserId NVARCHAR(200) NULL,
        AssignedToName NVARCHAR(200) NOT NULL,
        AssignedAt DATETIME2 NOT NULL CONSTRAINT DF_AR_LineProjectAssignment_AssignedAt DEFAULT SYSUTCDATETIME()
      );
    END;
  `);

  await execute(`
    IF OBJECT_ID('dbo.AR_LineTaskComment', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineTaskComment (
        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        TaskSID BIGINT NOT NULL,
        UserId INT NULL,
        LineUserId NVARCHAR(200) NULL,
        UserName NVARCHAR(200) NOT NULL,
        UserAvatar NVARCHAR(500) NULL,
        Message NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AR_LineTaskComment_CreatedAt DEFAULT SYSUTCDATETIME()
      );
    END;
  `);

  await execute(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_AR_LineTaskComment_TaskSID' AND object_id = OBJECT_ID('dbo.AR_LineTaskComment')
    )
    BEGIN
      CREATE INDEX IX_AR_LineTaskComment_TaskSID
      ON dbo.AR_LineTaskComment(TaskSID, CreatedAt);
    END;
  `);

  await execute(`
    IF OBJECT_ID('dbo.AR_LineTaskNotification', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineTaskNotification (
        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        UserId INT NOT NULL,
        TaskSID BIGINT NOT NULL,
        NotificationType NVARCHAR(50) NOT NULL,
        Message NVARCHAR(300) NOT NULL,
        IsRead BIT NOT NULL CONSTRAINT DF_AR_LineTaskNotification_IsRead DEFAULT 0,
        TriggerByUserId INT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AR_LineTaskNotification_CreatedAt DEFAULT SYSUTCDATETIME(),
        ReadAt DATETIME2 NULL
      );
    END;
  `);

  await execute(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_AR_LineTaskNotification_UserId_IsRead' AND object_id = OBJECT_ID('dbo.AR_LineTaskNotification')
    )
    BEGIN
      CREATE INDEX IX_AR_LineTaskNotification_UserId_IsRead
      ON dbo.AR_LineTaskNotification(UserId, IsRead, CreatedAt);
    END;
  `);

  await execute(`
    IF OBJECT_ID('dbo.AR_LineTaskAssignee', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineTaskAssignee (
        TaskSID BIGINT NOT NULL,
        UserId INT NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AR_LineTaskAssignee_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_AR_LineTaskAssignee PRIMARY KEY (TaskSID, UserId)
      );
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_AR_LineTaskAssignee_UserId' AND object_id = OBJECT_ID('dbo.AR_LineTaskAssignee')
    )
    BEGIN
      CREATE INDEX IX_AR_LineTaskAssignee_UserId
      ON dbo.AR_LineTaskAssignee(UserId, TaskSID);
    END;
  `);

  await execute(`
    IF OBJECT_ID('dbo.AR_LineTaskDepartment', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineTaskDepartment (
        TaskSID BIGINT NOT NULL,
        DepartmentName NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AR_LineTaskDepartment_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_AR_LineTaskDepartment PRIMARY KEY (TaskSID, DepartmentName)
      );
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_AR_LineTaskDepartment_DepartmentName' AND object_id = OBJECT_ID('dbo.AR_LineTaskDepartment')
    )
    BEGIN
      CREATE INDEX IX_AR_LineTaskDepartment_DepartmentName
      ON dbo.AR_LineTaskDepartment(DepartmentName, TaskSID);
    END;
  `);

  await execute(`
    IF OBJECT_ID('dbo.AR_LineGroupList', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineGroupList (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        GroupName NVARCHAR(200) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AR_LineGroupList_CreatedAt DEFAULT SYSUTCDATETIME()
      );
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'UX_AR_LineGroupList_GroupName' AND object_id = OBJECT_ID('dbo.AR_LineGroupList')
    )
    BEGIN
      CREATE UNIQUE INDEX UX_AR_LineGroupList_GroupName
      ON dbo.AR_LineGroupList(GroupName);
    END;
  `);

  await execute(`
    IF OBJECT_ID('dbo.AR_LineTaskTag', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineTaskTag (
        TaskSID BIGINT NOT NULL,
        Tag NVARCHAR(60) NOT NULL,
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_AR_LineTaskTag_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_AR_LineTaskTag PRIMARY KEY (TaskSID, Tag)
      );
    END;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_AR_LineTaskTag_Tag' AND object_id = OBJECT_ID('dbo.AR_LineTaskTag')
    )
    BEGIN
      CREATE INDEX IX_AR_LineTaskTag_Tag
      ON dbo.AR_LineTaskTag(Tag, TaskSID);
    END;
  `);

  await execute(`
    IF OBJECT_ID('dbo.AR_LineTaskAttachment', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.AR_LineTaskAttachment (
        ID BIGINT IDENTITY(1,1) PRIMARY KEY,
        TaskSID BIGINT NOT NULL,
        FileName NVARCHAR(260) NOT NULL,
        StorageFileName NVARCHAR(260) NOT NULL,
        ContentType NVARCHAR(120) NULL,
        FileSize BIGINT NOT NULL,
        UploadedByUserId INT NULL,
        UploadedAt DATETIME2 NOT NULL CONSTRAINT DF_AR_LineTaskAttachment_UploadedAt DEFAULT SYSUTCDATETIME()
      );
    END;

    IF COL_LENGTH('dbo.AR_LineTaskAttachment', 'ContentType') IS NULL
      ALTER TABLE dbo.AR_LineTaskAttachment ADD ContentType NVARCHAR(120) NULL;
    IF COL_LENGTH('dbo.AR_LineTaskAttachment', 'StorageFileName') IS NULL
      ALTER TABLE dbo.AR_LineTaskAttachment ADD StorageFileName NVARCHAR(260) NULL;
    IF COL_LENGTH('dbo.AR_LineTaskAttachment', 'UploadedByUserId') IS NULL
      ALTER TABLE dbo.AR_LineTaskAttachment ADD UploadedByUserId INT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'IX_AR_LineTaskAttachment_TaskSID' AND object_id = OBJECT_ID('dbo.AR_LineTaskAttachment')
    )
    BEGIN
      CREATE INDEX IX_AR_LineTaskAttachment_TaskSID
      ON dbo.AR_LineTaskAttachment(TaskSID, UploadedAt DESC);
    END;
  `);

  await execute(`
    INSERT INTO dbo.AR_LineTaskDepartment (TaskSID, DepartmentName)
    SELECT
      p.SID,
      LTRIM(RTRIM(p.LineGroupId)) AS DepartmentName
    FROM dbo.AR_LineProjectList p
    WHERE p.LineGroupId IS NOT NULL
      AND LTRIM(RTRIM(p.LineGroupId)) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.AR_LineTaskDepartment d
        WHERE d.TaskSID = p.SID
          AND d.DepartmentName = LTRIM(RTRIM(p.LineGroupId))
      );
  `);

  await execute(`
    ;WITH mapped AS (
      SELECT
        p.SID AS TaskSID,
        u.id AS UserId,
        ROW_NUMBER() OVER (PARTITION BY p.SID, u.id ORDER BY u.id) AS rn
      FROM dbo.AR_LineProjectList p
      INNER JOIN dbo.AR_LineUsers u
        ON (
          NULLIF(LTRIM(RTRIM(p.AssigneeLineUserId)), '') IS NOT NULL
          AND u.lineUserId = LTRIM(RTRIM(p.AssigneeLineUserId))
        )
        OR (
          NULLIF(LTRIM(RTRIM(p.AssigneeLineUserId)), '') IS NULL
          AND NULLIF(LTRIM(RTRIM(p.AssigneeDisplayName)), '') IS NOT NULL
          AND LTRIM(RTRIM(u.name)) = LTRIM(RTRIM(p.AssigneeDisplayName))
        )
    )
    INSERT INTO dbo.AR_LineTaskAssignee (TaskSID, UserId)
    SELECT TaskSID, UserId
    FROM mapped
    WHERE rn = 1
      AND NOT EXISTS (
        SELECT 1
        FROM dbo.AR_LineTaskAssignee a
        WHERE a.TaskSID = mapped.TaskSID
          AND a.UserId = mapped.UserId
      );
  `);

  await execute(`
    INSERT INTO dbo.AR_LineGroupList (GroupName)
    SELECT names.GroupName
    FROM (
      SELECT DISTINCT LTRIM(RTRIM(d.DepartmentName)) AS GroupName
      FROM dbo.AR_LineTaskDepartment d
      WHERE d.DepartmentName IS NOT NULL AND LTRIM(RTRIM(d.DepartmentName)) <> ''
      UNION
      SELECT DISTINCT LTRIM(RTRIM(p.LineGroupId)) AS GroupName
      FROM dbo.AR_LineProjectList p
      WHERE p.LineGroupId IS NOT NULL AND LTRIM(RTRIM(p.LineGroupId)) <> ''
    ) names
    WHERE NOT EXISTS (
      SELECT 1
      FROM dbo.AR_LineGroupList g
      WHERE g.GroupName = names.GroupName
    );
  `);
};

const seedMockData = async () => {
  if (!enableSampleData) {
    return;
  }

  const existingUser = await queryOne<{ count: number }>(
    "SELECT COUNT(*) AS count FROM dbo.AR_LineUsers;"
  );
  if ((existingUser?.count ?? 0) > 0) {
    return;
  }

  const demoUsers = [
    { name: "Howard", avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=Howard" },
    { name: "Erica", avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=Erica" },
    { name: "Kevin", avatar: "https://api.dicebear.com/9.x/thumbs/svg?seed=Kevin" }
  ];

  for (const user of demoUsers) {
    await execute(
      `
        INSERT INTO dbo.AR_LineUsers (lineUserId, name, avatar)
        VALUES (@lineUserId, @name, @avatar);
      `,
      { lineUserId: null, name: user.name, avatar: user.avatar }
    );
  }
};

export const initializeDatabase = async () => {
  await getPool();
  await migrateLegacyTableNames();
  await normalizeActiveTableNameCase();
  await ensureProjectListColumns();
  await createSchema();
  await seedMockData();
};

export const closeDatabase = async () => {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = null;
  }
};
