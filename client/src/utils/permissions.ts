import type { AuthUser, Task, TaskComment } from "../types";

const normalize = (value: string | null | undefined) => (value ?? "").trim().toLowerCase();

export const canManageTask = (task: Task, currentUser: AuthUser) => {
  if (currentUser.isAdmin) {
    return true;
  }

  if (task.assignedBy?.id === currentUser.id) {
    return true;
  }

  if (task.assignedTo?.id === currentUser.id) {
    return true;
  }

  if (task.assignees.some((assignee) => assignee.id === currentUser.id)) {
    return true;
  }

  if (
    currentUser.lineUserId &&
    task.assignees.some((assignee) => assignee.lineUserId === currentUser.lineUserId)
  ) {
    return true;
  }

  if (task.assignees.some((assignee) => normalize(assignee.name) === normalize(currentUser.name))) {
    return true;
  }

  return false;
};

export const canDeleteComment = (comment: TaskComment, currentUser: AuthUser) => {
  if (currentUser.isAdmin) {
    return true;
  }
  return comment.userId === currentUser.id;
};
