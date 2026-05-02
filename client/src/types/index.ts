export type TaskStatus = "todo" | "done";
export type AuthProvider = "line" | "internal";
export type ScopeFilter = "all" | "related" | "delegated" | "todo";
export type StatusFilter = "all" | TaskStatus;
export type GroupFilter = "all" | number;

export interface User {
  id: number;
  lineUserId: string | null;
  internalUserNo?: string | null;
  name: string;
  avatar: string;
  isAdmin?: boolean;
  authProvider?: AuthProvider;
}

export interface AuthUser {
  id: number;
  lineUserId: string | null;
  internalUserNo: string | null;
  name: string;
  avatar: string;
  isAdmin: boolean;
  authProvider: AuthProvider;
}

export interface Group {
  id: number;
  name: string;
}

export interface Attachment {
  id: number;
  taskId: number;
  fileName: string;
  fileSize: number;
  contentType: string | null;
  url: string;
  uploadedAt: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  userId: number;
  message: string;
  createdAt: string;
  user: User;
}

export interface NotificationItem {
  id: number;
  userId: number;
  taskId: number;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationSummary {
  items: NotificationItem[];
  unreadCount: number;
}

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string;
  groupId: number | null;
  group: Group | null;
  departmentIds: number[];
  departments: Group[];
  createdBy: number;
  assignees: User[];
  assignedBy: User | null;
  assignedTo: User | null;
  assignedAt: string | null;
  tags: string[];
  attachments: Attachment[];
  comments: TaskComment[];
}

export interface TaskFilters {
  query: string;
  startDate: string;
  endDate: string;
  status: StatusFilter;
  groupId: GroupFilter;
  scope: ScopeFilter;
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
  groupId?: number | null;
  departmentIds?: number[];
  assigneeIds?: number[];
  tags?: string[];
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  status?: TaskStatus;
  dueDate?: string;
  groupId?: number | null;
  departmentIds?: number[];
  assigneeIds?: number[];
  tags?: string[];
}
