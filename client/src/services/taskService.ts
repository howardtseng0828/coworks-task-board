import type {
  CreateTaskPayload,
  Group,
  GroupFilter,
  ScopeFilter,
  StatusFilter,
  Task,
  UpdateTaskPayload,
  User
} from "../types";
import { apiRequest } from "./api";

interface TaskListFilters {
  query: string;
  startDate: string;
  endDate: string;
  status: StatusFilter;
  groupId: GroupFilter;
  scope: ScopeFilter;
}

const buildFilterQuery = (filters: TaskListFilters) => {
  const params = new URLSearchParams();

  if (filters.query.trim()) {
    params.set("q", filters.query.trim());
  }
  if (filters.startDate) {
    params.set("startDate", filters.startDate);
  }
  if (filters.endDate) {
    params.set("endDate", filters.endDate);
  }
  if (filters.status !== "all") {
    params.set("status", filters.status);
  }
  if (filters.groupId !== "all") {
    params.set("groupId", String(filters.groupId));
  }
  if (filters.scope !== "all") {
    params.set("scope", filters.scope);
  }

  return params.toString();
};

export const taskService = {
  getTasks: (filters: TaskListFilters) => {
    const query = buildFilterQuery(filters);
    return apiRequest<Task[]>(`/tasks${query ? `?${query}` : ""}`);
  },

  getTaskById: (taskId: number) => apiRequest<Task>(`/tasks/${taskId}`),

  createTask: (payload: CreateTaskPayload) =>
    apiRequest<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  updateTask: (taskId: number, payload: UpdateTaskPayload) =>
    apiRequest<Task>(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    }),

  updateTaskStatus: (taskId: number, status: "todo" | "done") =>
    apiRequest<Task>(`/tasks/${taskId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    }),

  deleteTask: (taskId: number) =>
    apiRequest<void>(`/tasks/${taskId}`, {
      method: "DELETE"
    }),

  addComment: (taskId: number, message: string) =>
    apiRequest<Task>(`/tasks/${taskId}/comments`, {
      method: "POST",
      body: JSON.stringify({ message })
    }),

  deleteComment: (taskId: number, commentId: number) =>
    apiRequest<Task>(`/tasks/${taskId}/comments/${commentId}`, {
      method: "DELETE"
    }),

  addAttachment: (taskId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    return apiRequest<Task>(`/tasks/${taskId}/attachments`, {
      method: "POST",
      body: formData
    });
  },

  deleteAttachment: (taskId: number, attachmentId: number) =>
    apiRequest<Task>(`/tasks/${taskId}/attachments/${attachmentId}`, {
      method: "DELETE"
    }),

  getUsers: () => apiRequest<User[]>("/lookups/users"),

  getGroups: () => apiRequest<Group[]>("/lookups/groups"),

  createGroup: (name: string) =>
    apiRequest<Group>("/lookups/groups", {
      method: "POST",
      body: JSON.stringify({ name })
    }),

  deleteGroup: (groupId: number) =>
    apiRequest<void>(`/lookups/groups/${groupId}`, {
      method: "DELETE"
    }),

  updateUserAdminStatus: (userId: number, isAdmin: boolean) =>
    apiRequest<User>(`/lookups/users/${userId}/admin`, {
      method: "PATCH",
      body: JSON.stringify({ isAdmin })
    }),

  deleteUser: (userId: number) =>
    apiRequest<void>(`/lookups/users/${userId}`, {
      method: "DELETE"
    })
};
