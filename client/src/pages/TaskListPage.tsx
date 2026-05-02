import { useEffect, useMemo, useState } from "react";
import { Pagination } from "../components/shared/Pagination";
import { TaskDrawer } from "../components/tasks/TaskDrawer";
import { TaskFilters } from "../components/tasks/TaskFilters";
import { TaskTable } from "../components/tasks/TaskTable";
import { useLookups } from "../hooks/useLookups";
import { useTasks } from "../hooks/useTasks";
import { useUiStore } from "../store/uiStore";
import { canManageTask } from "../utils/permissions";
import type { AuthUser, TaskFilters as TaskFiltersType } from "../types";

const PAGE_SIZE = 5;

const initialFilters: TaskFiltersType = {
  query: "",
  startDate: "",
  endDate: "",
  status: "all",
  groupId: "all",
  scope: "all"
};

interface TaskListPageProps {
  currentUser: AuthUser;
}

export const TaskListPage = ({ currentUser }: TaskListPageProps) => {
  const { selectedTaskId, selectTask } = useUiStore();
  const [filters, setFilters] = useState<TaskFiltersType>(initialFilters);
  const [page, setPage] = useState(1);

  const { users, groups, loading: lookupLoading, error: lookupError } = useLookups();
  const {
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
  } = useTasks(filters, selectedTaskId, currentUser.id);

  const combinedError = useMemo(() => error ?? lookupError, [error, lookupError]);
  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE));
  const pagedTasks = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return tasks.slice(startIndex, startIndex + PAGE_SIZE);
  }, [page, tasks]);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const patchFilters = (patch: Partial<TaskFiltersType>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleCreateTask = async () => {
    try {
      const created = await createTask();
      selectTask(created.id);
      setPage(1);
    } catch {
      // 錯誤由 hook 管理
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target || !canManageTask(target, currentUser)) {
      return;
    }

    const confirmed = window.confirm("確定要刪除這筆任務嗎？");
    if (!confirmed) {
      return;
    }

    try {
      await removeTask(taskId);
      if (selectedTaskId === taskId) {
        selectTask(null);
      }
    } catch {
      // 錯誤由 hook 管理
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">任務清單</h1>
          <p className="text-sm text-slate-500">追蹤狀態、留言、標籤、部門與被指派者。</p>
        </div>
      </div>

      <TaskFilters
        filters={filters}
        groups={groups}
        creating={working || lookupLoading}
        onChange={patchFilters}
        onCreate={() => void handleCreateTask()}
      />

      {combinedError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
          {combinedError}
        </div>
      ) : null}

      <section className="glass-card overflow-hidden">
        <TaskTable
          tasks={pagedTasks}
          loading={loadingTasks || lookupLoading}
          selectedTaskId={selectedTaskId}
          currentUser={currentUser}
          onSelect={selectTask}
          onToggle={(taskId, isDone) => void toggleTaskStatus(taskId, isDone)}
          onDelete={(taskId) => void handleDeleteTask(taskId)}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={tasks.length} onChange={setPage} />
      </section>

      <TaskDrawer
        open={Boolean(selectedTaskId)}
        task={selectedTask}
        currentUser={currentUser}
        groups={groups}
        users={users}
        loading={loadingDetail}
        busy={working}
        onClose={() => selectTask(null)}
        onSave={(taskId, payload) => saveTask(taskId, payload)}
        onDelete={(taskId) => removeTask(taskId)}
        onAddComment={(taskId, message) => addComment(taskId, message)}
        onDeleteComment={(taskId, commentId) => deleteComment(taskId, commentId)}
        onAddAttachment={(taskId, file) => addAttachment(taskId, file)}
        onDeleteAttachment={(taskId, attachmentId) => deleteAttachment(taskId, attachmentId)}
      />
    </div>
  );
};
