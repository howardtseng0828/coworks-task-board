import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { taskService } from "../services/taskService";
import type { Task, TaskFilters, UpdateTaskPayload } from "../types";

const parseError = (error: unknown) => (error instanceof Error ? error.message : "任務操作失敗。");

const dateWithOffset = (dayOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return date.toISOString().slice(0, 10);
};

export const useTasks = (filters: TaskFilters, selectedTaskId: number | null, currentUserId: number) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(true);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [working, setWorking] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const deferredQuery = useDeferredValue(filters.query);

  const effectiveFilters = useMemo(
    () => ({
      ...filters,
      query: deferredQuery
    }),
    [deferredQuery, filters.endDate, filters.groupId, filters.scope, filters.startDate, filters.status]
  );

  const filtersRef = useRef(effectiveFilters);
  const selectedTaskRef = useRef<number | null>(selectedTaskId);

  useEffect(() => {
    filtersRef.current = effectiveFilters;
  }, [effectiveFilters]);

  useEffect(() => {
    selectedTaskRef.current = selectedTaskId;
  }, [selectedTaskId]);

  const loadTasks = useCallback(async (nextFilters = filtersRef.current) => {
    setLoadingTasks(true);
    setError(null);
    try {
      const nextTasks = await taskService.getTasks(nextFilters);
      setTasks(nextTasks);
    } catch (requestError) {
      setError(parseError(requestError));
    } finally {
      setLoadingTasks(false);
    }
  }, []);

  const loadTaskDetail = useCallback(async (taskId: number) => {
    setLoadingDetail(true);
    setError(null);
    try {
      const task = await taskService.getTaskById(taskId);
      setSelectedTask(task);
    } catch (requestError) {
      setError(parseError(requestError));
      setSelectedTask(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const refreshTaskViews = useCallback(
    async (taskId?: number | null) => {
      await loadTasks(filtersRef.current);
      const nextTaskId = taskId ?? selectedTaskRef.current;
      if (nextTaskId) {
        await loadTaskDetail(nextTaskId);
      }
    },
    [loadTaskDetail, loadTasks]
  );

  useEffect(() => {
    void loadTasks(effectiveFilters);
  }, [effectiveFilters, loadTasks]);

  useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTask(null);
      return;
    }
    void loadTaskDetail(selectedTaskId);
  }, [loadTaskDetail, selectedTaskId]);

  const runMutation = useCallback(async <T>(executor: () => Promise<T>) => {
    setWorking(true);
    setError(null);
    try {
      return await executor();
    } catch (mutationError) {
      setError(parseError(mutationError));
      throw mutationError;
    } finally {
      setWorking(false);
    }
  }, []);

  const createTask = useCallback(
    async () =>
      runMutation(async () => {
        const created = await taskService.createTask({
          title: "新任務",
          description: "",
          status: "todo",
          dueDate: dateWithOffset(7),
          assigneeIds: [currentUserId],
          departmentIds: [],
          tags: []
        });
        await refreshTaskViews(created.id);
        return created;
      }),
    [currentUserId, refreshTaskViews, runMutation]
  );

  const saveTask = useCallback(
    async (taskId: number, payload: UpdateTaskPayload) =>
      runMutation(async () => {
        await taskService.updateTask(taskId, payload);
        await refreshTaskViews(taskId);
      }),
    [refreshTaskViews, runMutation]
  );

  const removeTask = useCallback(
    async (taskId: number) =>
      runMutation(async () => {
        await taskService.deleteTask(taskId);
        await loadTasks(filtersRef.current);
        if (selectedTaskRef.current === taskId) {
          setSelectedTask(null);
        }
      }),
    [loadTasks, runMutation]
  );

  const toggleTaskStatus = useCallback(
    async (taskId: number, isDone: boolean) =>
      runMutation(async () => {
        await taskService.updateTaskStatus(taskId, isDone ? "done" : "todo");
        await refreshTaskViews(taskId);
      }),
    [refreshTaskViews, runMutation]
  );

  const addComment = useCallback(
    async (taskId: number, message: string) =>
      runMutation(async () => {
        await taskService.addComment(taskId, message);
        await refreshTaskViews(taskId);
      }),
    [refreshTaskViews, runMutation]
  );

  const deleteComment = useCallback(
    async (taskId: number, commentId: number) =>
      runMutation(async () => {
        await taskService.deleteComment(taskId, commentId);
        await refreshTaskViews(taskId);
      }),
    [refreshTaskViews, runMutation]
  );

  const addAttachment = useCallback(
    async (taskId: number, file: File) =>
      runMutation(async () => {
        await taskService.addAttachment(taskId, file);
        await refreshTaskViews(taskId);
      }),
    [refreshTaskViews, runMutation]
  );

  const deleteAttachment = useCallback(
    async (taskId: number, attachmentId: number) =>
      runMutation(async () => {
        await taskService.deleteAttachment(taskId, attachmentId);
        await refreshTaskViews(taskId);
      }),
    [refreshTaskViews, runMutation]
  );

  return {
    tasks,
    selectedTask,
    loadingTasks,
    loadingDetail,
    working,
    error,
    createTask,
    saveTask,
    removeTask,
    toggleTaskStatus,
    addComment,
    deleteComment,
    addAttachment,
    deleteAttachment
  };
};
