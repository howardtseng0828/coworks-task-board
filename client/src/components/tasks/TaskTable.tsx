import { Menu, Transition } from "@headlessui/react";
import { EllipsisHorizontalIcon, EyeIcon, TrashIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Fragment } from "react";
import type { AuthUser, Task } from "../../types";
import { formatDate, isOverdue } from "../../utils/date";
import { canManageTask } from "../../utils/permissions";
import { AvatarImage } from "../shared/AvatarImage";
import { AvatarStack } from "../shared/AvatarStack";
import { StatusBadge } from "../shared/StatusBadge";

interface TaskTableProps {
  tasks: Task[];
  loading: boolean;
  selectedTaskId: number | null;
  currentUser: AuthUser;
  onSelect: (taskId: number) => void;
  onToggle: (taskId: number, isDone: boolean) => void;
  onDelete: (taskId: number) => void;
}

const getProviderLabel = (provider?: string | null) => {
  if (provider === "internal") {
    return "HHT 指派";
  }
  if (provider === "line") {
    return "LINE 指派";
  }
  return "系統指派";
};

const TaskActionMenu = ({
  taskId,
  canManage,
  onSelect,
  onDelete
}: {
  taskId: number;
  canManage: boolean;
  onSelect: (taskId: number) => void;
  onDelete: (taskId: number) => void;
}) => (
  <Menu as="div" className="relative inline-block text-left">
    <Menu.Button
      onClick={(event) => event.stopPropagation()}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-border bg-white text-slate-500 transition-colors duration-200 hover:text-brand-deep cursor-pointer"
    >
      <EllipsisHorizontalIcon className="h-5 w-5" />
    </Menu.Button>

    <Transition
      as={Fragment}
      enter="transition duration-150"
      enterFrom="opacity-0 scale-95"
      enterTo="opacity-100 scale-100"
      leave="transition duration-100"
      leaveFrom="opacity-100 scale-100"
      leaveTo="opacity-0 scale-95"
    >
      <Menu.Items className="absolute right-0 z-20 mt-2 w-36 rounded-xl border border-brand-border bg-white p-1 shadow-lg focus:outline-none">
        <Menu.Item>
          {({ active }) => (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(taskId);
              }}
              className={clsx(
                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer",
                active ? "bg-brand-surface text-brand-deep" : "text-slate-700"
              )}
            >
              <EyeIcon className="h-4 w-4" />
              查看
            </button>
          )}
        </Menu.Item>

        {canManage ? (
          <Menu.Item>
            {({ active }) => (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(taskId);
                }}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer",
                  active ? "bg-rose-50 text-rose-600" : "text-rose-600"
                )}
              >
                <TrashIcon className="h-4 w-4" />
                刪除
              </button>
            )}
          </Menu.Item>
        ) : null}
      </Menu.Items>
    </Transition>
  </Menu>
);

export const TaskTable = ({
  tasks,
  loading,
  selectedTaskId,
  currentUser,
  onSelect,
  onToggle,
  onDelete
}: TaskTableProps) => {
  if (loading) {
    return <div className="flex h-52 items-center justify-center text-slate-500">載入中...</div>;
  }

  if (tasks.length === 0) {
    return <div className="flex h-52 items-center justify-center text-slate-500">目前沒有任務</div>;
  }

  return (
    <>
      <div className="space-y-3 p-3 lg:hidden">
        {tasks.map((task) => {
          const overdue = isOverdue(task.dueDate, task.status);
          const canManage = canManageTask(task, currentUser);
          const departmentLabel = task.departments.length
            ? task.departments.map((department) => department.name).join(", ")
            : "未指定部門";

          return (
            <article
              key={task.id}
              onClick={() => onSelect(task.id)}
              className={clsx(
                "rounded-2xl border border-brand-border bg-white p-4 shadow-sm transition-colors duration-200",
                selectedTaskId === task.id ? "bg-emerald-50 ring-1 ring-brand-primary/30" : "hover:bg-emerald-50/60"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <input
                    type="checkbox"
                    checked={task.status === "done"}
                    disabled={!canManage}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      event.stopPropagation();
                      onToggle(task.id, event.target.checked);
                    }}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-primary focus:ring-brand-primary disabled:cursor-not-allowed"
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={clsx(
                          "break-words text-sm font-semibold text-slate-800",
                          task.status === "done" && "text-slate-400 line-through"
                        )}
                      >
                        {task.title}
                      </p>
                      <StatusBadge status={task.status} />
                    </div>

                    <p className="mt-2 break-words text-sm text-slate-600">
                      {task.description || "尚未填寫內容"}
                    </p>
                  </div>
                </div>

                <div className="shrink-0">
                  <TaskActionMenu taskId={task.id} canManage={canManage} onSelect={onSelect} onDelete={onDelete} />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-brand-surface/70 p-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">到期日</p>
                  <p className="mt-1 font-medium text-slate-700">{formatDate(task.dueDate)}</p>
                  {overdue ? <p className="mt-1 text-xs font-semibold text-rose-600">已逾期</p> : null}
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">部門</p>
                  <p className="mt-1 break-words text-slate-700">{departmentLabel}</p>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">負責人</p>
                  <div className="mt-1">
                    <AvatarStack users={task.assignees} max={3} />
                  </div>
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">指派者</p>
                  {task.assignedBy ? (
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                      <AvatarImage
                        src={task.assignedBy.avatar}
                        name={task.assignedBy.name}
                        className="h-7 w-7 rounded-full"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">
                          {task.assignedBy.name}
                        </p>
                        <p className="truncate text-[11px] text-slate-500">
                          {getProviderLabel(task.assignedBy.authProvider)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 text-slate-400">尚未指派</p>
                  )}
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {task.tags.length === 0 ? (
                  <span className="text-xs text-slate-400">沒有標籤</span>
                ) : (
                  task.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                    >
                      {tag}
                    </span>
                  ))
                )}

                {task.tags.length > 3 ? (
                  <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    +{task.tags.length - 3}
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">完成</th>
              <th className="px-4 py-3">標題</th>
              <th className="px-4 py-3">內容</th>
              <th className="px-4 py-3">到期日</th>
              <th className="px-4 py-3">部門</th>
              <th className="px-4 py-3">負責人</th>
              <th className="px-4 py-3">標籤</th>
              <th className="px-4 py-3">指派者</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const overdue = isOverdue(task.dueDate, task.status);
              const canManage = canManageTask(task, currentUser);
              const departmentLabel = task.departments.length
                ? task.departments.map((department) => department.name).join(", ")
                : "未指定部門";

              return (
                <tr
                  key={task.id}
                  onClick={() => onSelect(task.id)}
                  className={clsx(
                    "cursor-pointer border-t border-brand-border/50 transition-colors duration-200 hover:bg-emerald-50/70",
                    selectedTaskId === task.id && "bg-emerald-100/70"
                  )}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={task.status === "done"}
                      disabled={!canManage}
                      onChange={(event) => {
                        event.stopPropagation();
                        onToggle(task.id, event.target.checked);
                      }}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-primary focus:ring-brand-primary disabled:cursor-not-allowed"
                    />
                  </td>

                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <p
                        className={clsx(
                          "font-semibold text-slate-800",
                          task.status === "done" && "text-slate-400 line-through"
                        )}
                      >
                        {task.title}
                      </p>
                      <StatusBadge status={task.status} />
                    </div>
                  </td>

                  <td className="max-w-xs px-4 py-3 text-slate-600">
                    <p className="truncate">{task.description || "尚未填寫內容"}</p>
                  </td>

                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{formatDate(task.dueDate)}</p>
                    {overdue ? <p className="text-xs font-semibold text-rose-600">已逾期</p> : null}
                  </td>

                  <td className="max-w-[180px] px-4 py-3 text-slate-700">
                    <p className="truncate" title={departmentLabel}>
                      {departmentLabel}
                    </p>
                  </td>

                  <td className="px-4 py-3">
                    <AvatarStack users={task.assignees} max={3} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex max-w-[180px] flex-wrap gap-1">
                      {task.tags.length === 0 ? (
                        <span className="text-xs text-slate-400">沒有標籤</span>
                      ) : (
                        task.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                          >
                            {tag}
                          </span>
                        ))
                      )}
                      {task.tags.length > 3 ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          +{task.tags.length - 3}
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-slate-700">
                    {task.assignedBy ? (
                      <div className="flex min-w-0 items-center gap-2">
                        <AvatarImage
                          src={task.assignedBy.avatar}
                          name={task.assignedBy.name}
                          className="h-7 w-7 rounded-full"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-700">
                            {task.assignedBy.name}
                          </p>
                          <p className="truncate text-[11px] text-slate-500">
                            {getProviderLabel(task.assignedBy.authProvider)}
                          </p>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">尚未指派</span>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <TaskActionMenu taskId={task.id} canManage={canManage} onSelect={onSelect} onDelete={onDelete} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};
