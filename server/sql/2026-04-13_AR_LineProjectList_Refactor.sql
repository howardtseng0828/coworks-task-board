/*
  AR_LineProjectList 欄位重構（拆分標題/摘要 + 補標準命名欄位）
  執行前建議先備份資料庫
*/

BEGIN TRY
  BEGIN TRAN;

  IF OBJECT_ID('dbo.AR_LineProjectList', 'U') IS NULL
  BEGIN
    RAISERROR('Table dbo.AR_LineProjectList does not exist.', 16, 1);
  END;

  IF COL_LENGTH('dbo.AR_LineProjectList', 'TaskTitle') IS NULL
    ALTER TABLE dbo.AR_LineProjectList ADD TaskTitle NVARCHAR(200) NULL;

  IF COL_LENGTH('dbo.AR_LineProjectList', 'TaskSummary') IS NULL
    ALTER TABLE dbo.AR_LineProjectList ADD TaskSummary NVARCHAR(MAX) NULL;

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
    ALTER TABLE dbo.AR_LineProjectList ADD CreatedAt DATETIME NULL;

  IF COL_LENGTH('dbo.AR_LineProjectList', 'UpdatedAt') IS NULL
    ALTER TABLE dbo.AR_LineProjectList ADD UpdatedAt DATETIME2 NULL;

  ;WITH normalized AS (
    SELECT
      SID,
      REPLACE(ISNULL(TaskContent, ''), CHAR(13) + CHAR(10), CHAR(10)) AS NormalizedContent
    FROM dbo.AR_LineProjectList
  )
  UPDATE p
  SET
    TaskTitle = COALESCE(
      NULLIF(LTRIM(RTRIM(p.TaskTitle)), ''),
      NULLIF(
        LEFT(
          CASE
            WHEN CHARINDEX(CHAR(10), n.NormalizedContent) > 0
              THEN LEFT(n.NormalizedContent, CHARINDEX(CHAR(10), n.NormalizedContent) - 1)
            ELSE n.NormalizedContent
          END,
          200
        ),
        ''
      ),
      N'未命名任務'
    ),
    TaskSummary = COALESCE(
      NULLIF(LTRIM(RTRIM(p.TaskSummary)), ''),
      NULLIF(
        CASE
          WHEN CHARINDEX(CHAR(10), n.NormalizedContent) > 0
            THEN LTRIM(RTRIM(SUBSTRING(n.NormalizedContent, CHARINDEX(CHAR(10), n.NormalizedContent) + 1, LEN(n.NormalizedContent))))
          ELSE LTRIM(RTRIM(n.NormalizedContent))
        END,
        ''
      ),
      N''
    ),
    TaskDescription = COALESCE(
      NULLIF(LTRIM(RTRIM(p.TaskDescription)), ''),
      NULLIF(LTRIM(RTRIM(p.TaskSummary)), ''),
      NULLIF(
        CASE
          WHEN CHARINDEX(CHAR(10), n.NormalizedContent) > 0
            THEN LTRIM(RTRIM(SUBSTRING(n.NormalizedContent, CHARINDEX(CHAR(10), n.NormalizedContent) + 1, LEN(n.NormalizedContent))))
          ELSE LTRIM(RTRIM(n.NormalizedContent))
        END,
        ''
      ),
      N''
    ),
    TaskStatus = COALESCE(
      NULLIF(LTRIM(RTRIM(p.TaskStatus)), ''),
      CASE WHEN ISNULL(p.Status, 0) = 1 THEN 'done' ELSE 'todo' END
    ),
    AssigneeDisplayName = COALESCE(NULLIF(LTRIM(RTRIM(p.AssigneeDisplayName)), ''), p.MemberName),
    AssigneeLineUserId = COALESCE(NULLIF(LTRIM(RTRIM(p.AssigneeLineUserId)), ''), p.LineUserID),
    DueDate = COALESCE(p.DueDate, p.Dday),
    CreatedAt = COALESCE(p.CreatedAt, p.CreDate),
    UpdatedAt = COALESCE(p.UpdatedAt, p.CreatedAt, p.CreDate)
  FROM dbo.AR_LineProjectList p
  INNER JOIN normalized n ON n.SID = p.SID;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_AR_LineProjectList_TaskStatus_DueDate'
      AND object_id = OBJECT_ID('dbo.AR_LineProjectList')
  )
  BEGIN
    CREATE INDEX IX_AR_LineProjectList_TaskStatus_DueDate
      ON dbo.AR_LineProjectList(TaskStatus, DueDate);
  END;

  IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_AR_LineProjectList_AssigneeLineUserId'
      AND object_id = OBJECT_ID('dbo.AR_LineProjectList')
  )
  BEGIN
    CREATE INDEX IX_AR_LineProjectList_AssigneeLineUserId
      ON dbo.AR_LineProjectList(AssigneeLineUserId);
  END;

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
