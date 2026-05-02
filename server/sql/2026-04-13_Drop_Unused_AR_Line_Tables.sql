/*
  手動清理未使用資料表（請先確認已備份）
  目前系統實際使用：
  - dbo.AR_LineProjectList
  - dbo.AR_LineUsers
  - dbo.AR_LineProjectAssignment
  - dbo.AR_LineTaskComment
  - dbo.AR_LineTaskNotification
*/

BEGIN TRY
  BEGIN TRAN;

  IF OBJECT_ID('dbo.AR_Linetask_tags', 'U') IS NOT NULL DROP TABLE dbo.AR_Linetask_tags;
  IF OBJECT_ID('dbo.AR_LineTaskTags', 'U') IS NOT NULL DROP TABLE dbo.AR_LineTaskTags;
  IF OBJECT_ID('dbo.task_tags', 'U') IS NOT NULL DROP TABLE dbo.task_tags;

  IF OBJECT_ID('dbo.AR_Linetask_assignees', 'U') IS NOT NULL DROP TABLE dbo.AR_Linetask_assignees;
  IF OBJECT_ID('dbo.AR_LineTaskAssignees', 'U') IS NOT NULL DROP TABLE dbo.AR_LineTaskAssignees;
  IF OBJECT_ID('dbo.task_assignees', 'U') IS NOT NULL DROP TABLE dbo.task_assignees;

  IF OBJECT_ID('dbo.AR_Linechecklist_items', 'U') IS NOT NULL DROP TABLE dbo.AR_Linechecklist_items;
  IF OBJECT_ID('dbo.AR_LineChecklistItems', 'U') IS NOT NULL DROP TABLE dbo.AR_LineChecklistItems;
  IF OBJECT_ID('dbo.checklist_items', 'U') IS NOT NULL DROP TABLE dbo.checklist_items;

  IF OBJECT_ID('dbo.AR_Lineattachments', 'U') IS NOT NULL DROP TABLE dbo.AR_Lineattachments;
  IF OBJECT_ID('dbo.AR_LineAttachments', 'U') IS NOT NULL DROP TABLE dbo.AR_LineAttachments;
  IF OBJECT_ID('dbo.attachments', 'U') IS NOT NULL DROP TABLE dbo.attachments;

  IF OBJECT_ID('dbo.AR_Linecomments', 'U') IS NOT NULL DROP TABLE dbo.AR_Linecomments;
  IF OBJECT_ID('dbo.AR_LineComments', 'U') IS NOT NULL DROP TABLE dbo.AR_LineComments;
  IF OBJECT_ID('dbo.comments', 'U') IS NOT NULL DROP TABLE dbo.comments;

  IF OBJECT_ID('dbo.AR_Linetasks', 'U') IS NOT NULL DROP TABLE dbo.AR_Linetasks;
  IF OBJECT_ID('dbo.AR_LineTasks', 'U') IS NOT NULL DROP TABLE dbo.AR_LineTasks;
  IF OBJECT_ID('dbo.tasks', 'U') IS NOT NULL DROP TABLE dbo.tasks;

  IF OBJECT_ID('dbo.AR_Linetags', 'U') IS NOT NULL DROP TABLE dbo.AR_Linetags;
  IF OBJECT_ID('dbo.AR_LineTags', 'U') IS NOT NULL DROP TABLE dbo.AR_LineTags;
  IF OBJECT_ID('dbo.tags', 'U') IS NOT NULL DROP TABLE dbo.tags;

  IF OBJECT_ID('dbo.AR_Linegroups', 'U') IS NOT NULL DROP TABLE dbo.AR_Linegroups;
  IF OBJECT_ID('dbo.AR_LineGroups', 'U') IS NOT NULL DROP TABLE dbo.AR_LineGroups;
  IF OBJECT_ID('dbo.groups', 'U') IS NOT NULL DROP TABLE dbo.groups;

  COMMIT TRAN;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRAN;
  THROW;
END CATCH;
