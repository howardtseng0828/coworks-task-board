import { Dialog, Transition } from "@headlessui/react";
import {
  ArrowUturnLeftIcon,
  EyeIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  XMarkIcon
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Fragment, useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import emptyCommentsImage from "../../assets/empty-comments.svg";
import type { AuthUser, Group, Task, UpdateTaskPayload, User } from "../../types";
import { bytesToLabel, formatDateTime } from "../../utils/date";
import { canDeleteComment, canManageTask } from "../../utils/permissions";
import { AvatarImage } from "../shared/AvatarImage";

const MAX_FILE_SIZE = 500 * 1024 * 1024;

interface EditableTaskState {
  title: string;
  description: string;
  status: "todo" | "done";
  dueDate: string;
  departmentIds: number[];
  assigneeIds: number[];
  tags: string[];
}

interface TaskDrawerProps {
  open: boolean;
  task: Task | null;
  currentUser: AuthUser;
  groups: Group[];
  users: User[];
  loading: boolean;
  busy: boolean;
  onClose: () => void;
  onSave: (taskId: number, payload: UpdateTaskPayload) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
  onAddComment: (taskId: number, message: string) => Promise<void>;
  onDeleteComment: (taskId: number, commentId: number) => Promise<void>;
  onAddAttachment: (taskId: number, file: File) => Promise<void>;
  onDeleteAttachment: (taskId: number, attachmentId: number) => Promise<void>;
}

export const TaskDrawer = ({
  open,
  task,
  currentUser,
  groups,
  users,
  loading,
  busy,
  onClose,
  onSave,
  onDelete,
  onAddComment,
  onDeleteComment,
  onAddAttachment,
  onDeleteAttachment
}: TaskDrawerProps) => {
  const [draft, setDraft] = useState<EditableTaskState | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Task["attachments"][number] | null>(null);

  useEffect(() => {
    if (!task) {
      setDraft(null);
      return;
    }

    setDraft({
      title: task.title,
      description: task.description,
      status: task.status,
      dueDate: task.dueDate,
      departmentIds: task.departmentIds,
      assigneeIds: task.assignees.map((assignee) => assignee.id),
      tags: [...task.tags]
    });
    setTagInput("");
    setCommentInput("");
    setAttachmentError(null);
    setPreviewAttachment(null);
  }, [task]);

  const canManage = task ? canManageTask(task, currentUser) : false;
  const disabled = busy || loading || !canManage;

  const selectedDepartments = useMemo(
    () => groups.filter((group) => draft?.departmentIds.includes(group.id)),
    [draft?.departmentIds, groups]
  );
  const selectedAssignees = useMemo(
    () => users.filter((user) => draft?.assigneeIds.includes(user.id)),
    [draft?.assigneeIds, users]
  );

  const updateDraft = (patch: Partial<EditableTaskState>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const toggleDepartment = (departmentId: number) => {
    if (!draft || disabled) {
      return;
    }

    const hasDepartment = draft.departmentIds.includes(departmentId);
    updateDraft({
      departmentIds: hasDepartment
        ? draft.departmentIds.filter((id) => id !== departmentId)
        : [...draft.departmentIds, departmentId]
    });
  };

  const toggleAssignee = (userId: number) => {
    if (!draft || disabled) {
      return;
    }

    const hasAssignee = draft.assigneeIds.includes(userId);
    updateDraft({
      assigneeIds: hasAssignee
        ? draft.assigneeIds.filter((id) => id !== userId)
        : [...draft.assigneeIds, userId]
    });
  };

  const addTag = () => {
    const normalized = tagInput.trim();
    if (!normalized || !draft || disabled) {
      return;
    }

    const exists = draft.tags.some((tag) => tag.toLowerCase() === normalized.toLowerCase());
    if (!exists) {
      updateDraft({ tags: [...draft.tags, normalized] });
    }
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    if (!draft || disabled) {
      return;
    }
    updateDraft({ tags: draft.tags.filter((tag) => tag !== tagToRemove) });
  };

  const saveChanges = async () => {
    if (!task || !draft || disabled) {
      return;
    }

    await onSave(task.id, {
      title: draft.title.trim() || "未命名任務",
      description: draft.description,
      status: draft.status,
      dueDate: draft.dueDate,
      departmentIds: draft.departmentIds,
      assigneeIds: draft.assigneeIds,
      tags: draft.tags
    });
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task || !commentInput.trim() || disabled) {
      return;
    }
    await onAddComment(task.id, commentInput.trim());
    setCommentInput("");
  };

  const handleDeleteComment = async (commentId: number) => {
    if (!task) {
      return;
    }

    const confirmed = window.confirm("確定要刪除這則留言嗎？");
    if (!confirmed) {
      return;
    }

    await onDeleteComment(task.id, commentId);
  };

  const handleDeleteTask = async () => {
    if (!task || !canManage) {
      return;
    }

    const confirmed = window.confirm("確定要刪除這個任務嗎？刪除後將無法復原。");
    if (!confirmed) {
      return;
    }

    await onDelete(task.id);
    onClose();
  };

  const handleAttachment = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!task || disabled) {
      return;
    }

    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setAttachmentError(null);
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        setAttachmentError(`檔案 ${file.name} 超過 500MB 限制`);
        continue;
      }
      await onAddAttachment(task.id, file);
    }

    event.target.value = "";
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!task || disabled) {
      return;
    }

    const confirmed = window.confirm("確定要刪除這個附件嗎？");
    if (!confirmed) {
      return;
    }

    await onDeleteAttachment(task.id, attachmentId);
  };

  const canPreviewAttachment = (contentType: string | null) => {
    const type = (contentType ?? "").toLowerCase();
    return (
      type.startsWith("image/") ||
      type === "application/pdf" ||
      type.startsWith("text/") ||
      type.startsWith("video/") ||
      type.startsWith("audio/")
    );
  };

  const uploadInputId = task ? `attachment-${task.id}` : "attachment-input";

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-40" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="transition-opacity duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="absolute inset-0 overflow-hidden">
            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-8 sm:pl-10 lg:pl-16 xl:pl-24">
              <Transition.Child
                as={Fragment}
                enter="transform transition duration-300 ease-out"
                enterFrom="translate-x-full"
                enterTo="translate-x-0"
                leave="transform transition duration-200 ease-in"
                leaveFrom="translate-x-0"
                leaveTo="translate-x-full"
              >
                <Dialog.Panel className="pointer-events-auto w-[calc(100vw-2rem)] sm:w-[calc(100vw-2.5rem)] lg:w-[min(68rem,calc(100vw-4rem))] xl:w-[min(64rem,calc(100vw-6rem))] 2xl:w-[min(68rem,calc(100vw-8rem))]">
                  <div className="flex h-full flex-col bg-slate-50">
                    <div className="flex items-center justify-between border-b border-brand-border bg-white px-4 py-3 sm:px-6">
                      <Dialog.Title className="text-base font-semibold text-slate-800">任務編輯</Dialog.Title>
                      <div className="flex items-center gap-2">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={handleDeleteTask}
                            className="btn-secondary text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
                          >
                            刪除任務
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void saveChanges()}
                          disabled={disabled}
                          className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          儲存
                        </button>
                        <button
                          type="button"
                          onClick={onClose}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-border text-slate-600 transition-colors duration-200 hover:bg-brand-surface cursor-pointer"
                          aria-label="關閉"
                        >
                          <XMarkIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </div>

                    {loading || !task || !draft ? (
                      <div className="flex flex-1 items-center justify-center text-slate-500">載入中...</div>
                    ) : (
                      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_360px]">
                        <section className="space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
                          {!canManage ? (
                            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                              目前是檢視模式，無法編輯這筆任務。
                            </div>
                          ) : null}

                          <div className="rounded-xl border border-brand-border bg-white px-4 py-3">
                            <p className="text-xs font-semibold text-slate-500">指派者</p>
                            <div className="mt-2 flex items-center gap-3">
                              {task.assignedBy ? (
                                <>
                                  <AvatarImage
                                    src={task.assignedBy.avatar}
                                    name={task.assignedBy.name}
                                    className="h-10 w-10 rounded-full"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-slate-800">
                                      {task.assignedBy.name}
                                    </p>
                                    <p className="truncate text-xs text-slate-500">
                                      {task.assignedBy.authProvider === "internal"
                                        ? "內部帳號"
                                        : task.assignedBy.authProvider === "line"
                                          ? "LINE 帳號"
                                          : "帳號"}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <p className="text-sm text-slate-500">尚未指派</p>
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              指派時間：{task.assignedAt ? formatDateTime(task.assignedAt) : "尚未記錄"}
                            </p>
                          </div>

                          <label className="space-y-2">
                            <span className="text-sm font-medium text-slate-600">標題</span>
                            <input
                              className="input-base text-base font-semibold"
                              value={draft.title}
                              disabled={disabled}
                              onChange={(event) => updateDraft({ title: event.target.value })}
                            />
                          </label>

                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <label className="flex items-center gap-2 rounded-xl border border-brand-border bg-white px-3 py-2">
                              <input
                                type="checkbox"
                                checked={draft.status === "done"}
                                disabled={disabled}
                                onChange={(event) =>
                                  updateDraft({ status: event.target.checked ? "done" : "todo" })
                                }
                                className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                              />
                              <span className="text-sm font-medium text-slate-700">
                                {draft.status === "done" ? "已完成" : "待辦"}
                              </span>
                            </label>

                            <label className="space-y-1 text-sm">
                              <span className="text-slate-500">到期日</span>
                              <input
                                type="date"
                                value={draft.dueDate}
                                disabled={disabled}
                                onChange={(event) => updateDraft({ dueDate: event.target.value })}
                                className="input-base"
                              />
                            </label>
                          </div>

                          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                            <div className="space-y-1 text-sm">
                              <span className="text-slate-500">部門（可複選）</span>
                              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-brand-border bg-white p-2">
                                {groups.length === 0 ? (
                                  <p className="px-2 py-1 text-xs text-slate-400">目前沒有部門</p>
                                ) : (
                                  groups.map((group) => (
                                    <label
                                      key={group.id}
                                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-brand-surface"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={draft.departmentIds.includes(group.id)}
                                        disabled={disabled}
                                        onChange={() => toggleDepartment(group.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                      />
                                      <AvatarImage
                                        src={null}
                                        name={group.name}
                                        className="h-7 w-7 rounded-full"
                                      />
                                      <span className="text-sm text-slate-700">{group.name}</span>
                                    </label>
                                  ))
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{selectedDepartments.length} 個已選部門</p>
                            </div>

                            <div className="space-y-1 text-sm">
                              <span className="text-slate-500">被指派者（可複選）</span>
                              <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-brand-border bg-white p-2">
                                {users.length === 0 ? (
                                  <p className="px-2 py-1 text-xs text-slate-400">目前沒有可指派人員</p>
                                ) : (
                                  users.map((user) => (
                                    <label
                                      key={user.id}
                                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-brand-surface"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={draft.assigneeIds.includes(user.id)}
                                        disabled={disabled}
                                        onChange={() => toggleAssignee(user.id)}
                                        className="h-4 w-4 rounded border-slate-300 text-brand-primary focus:ring-brand-primary"
                                      />
                                      <AvatarImage
                                        src={user.avatar}
                                        name={user.name}
                                        className="h-7 w-7 rounded-full"
                                      />
                                      <span className="text-sm text-slate-700">{user.name}</span>
                                    </label>
                                  ))
                                )}
                              </div>
                              <p className="text-xs text-slate-400">{selectedAssignees.length} 位被指派者</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-600">標籤</p>
                            <div className="rounded-xl border border-brand-border bg-white p-3">
                              <div className="mb-2 flex flex-wrap gap-2">
                                {draft.tags.map((tag) => (
                                  <span
                                    key={tag}
                                    className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700"
                                  >
                                    {tag}
                                    <button
                                      type="button"
                                      onClick={() => removeTag(tag)}
                                      disabled={disabled}
                                      className="cursor-pointer text-emerald-700 hover:text-emerald-900 disabled:cursor-not-allowed"
                                      aria-label={`刪除標籤 ${tag}`}
                                    >
                                      <XMarkIcon className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  value={tagInput}
                                  disabled={disabled}
                                  onChange={(event) => setTagInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      addTag();
                                    }
                                  }}
                                  placeholder="輸入標籤後按 Enter"
                                  className="input-base"
                                />
                                <button
                                  type="button"
                                  onClick={addTag}
                                  disabled={disabled}
                                  className="btn-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  新增
                                </button>
                              </div>
                            </div>
                          </div>

                          <label className="space-y-2">
                            <span className="text-sm font-medium text-slate-600">內容</span>
                            <textarea
                              value={draft.description}
                              disabled={disabled}
                              onChange={(event) => updateDraft({ description: event.target.value })}
                              rows={4}
                              placeholder="請輸入任務內容..."
                              className="input-base min-h-24 resize-y"
                            />
                          </label>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-slate-600">附件（檔案 / 圖片）</p>
                            <div className="rounded-xl border border-brand-border bg-white p-3">
                              <div className="mb-2 flex flex-wrap items-center gap-2">
                                <input
                                  id={uploadInputId}
                                  type="file"
                                  multiple
                                  disabled={disabled}
                                  onChange={(event) => void handleAttachment(event)}
                                  className="hidden"
                                />
                                <label
                                  htmlFor={uploadInputId}
                                  className={clsx(
                                    "btn-secondary inline-flex items-center gap-1.5",
                                    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                                  )}
                                >
                                  <PaperClipIcon className="h-4 w-4" />
                                  上傳附件
                                </label>
                                <span className="text-xs text-amber-700">單一檔案上限 500MB</span>
                              </div>

                              {attachmentError ? (
                                <p className="mb-2 text-xs font-medium text-rose-600">{attachmentError}</p>
                              ) : null}

                              <div className="space-y-2">
                                {task.attachments.length === 0 ? (
                                  <p className="text-sm text-slate-500">目前沒有附件</p>
                                ) : (
                                  task.attachments.map((attachment) => (
                                    <div
                                      key={attachment.id}
                                      className="rounded-lg bg-brand-surface px-3 py-2 text-sm"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <a
                                          href={attachment.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="truncate font-medium text-brand-deep underline-offset-2 hover:underline"
                                          title={attachment.fileName}
                                        >
                                          {attachment.fileName}
                                        </a>
                                        <div className="flex items-center gap-2">
                                          {canPreviewAttachment(attachment.contentType) ? (
                                            <button
                                              type="button"
                                              onClick={() => setPreviewAttachment(attachment)}
                                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200"
                                            >
                                              <EyeIcon className="h-3.5 w-3.5" />
                                              預覽
                                            </button>
                                          ) : null}
                                          <p className="shrink-0 text-xs text-slate-500">
                                            {bytesToLabel(attachment.fileSize)}
                                          </p>
                                        </div>
                                      </div>
                                      {canManage ? (
                                        <div className="mt-1">
                                          <button
                                            type="button"
                                            onClick={() => void handleDeleteAttachment(attachment.id)}
                                            disabled={disabled}
                                            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            <XMarkIcon className="h-3.5 w-3.5" />
                                            刪除附件
                                          </button>
                                        </div>
                                      ) : null}
                                      {attachment.contentType?.startsWith("image/") ? (
                                        <img
                                          src={attachment.url}
                                          alt={attachment.fileName}
                                          className="mt-2 max-h-36 rounded-md border border-slate-200 object-contain"
                                        />
                                      ) : null}
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </section>

                        <aside className="flex min-h-0 flex-col border-t border-brand-border bg-white xl:border-l xl:border-t-0">
                          <div className="border-b border-brand-border px-4 py-3">
                            <p className="text-sm font-semibold text-slate-700">留言</p>
                          </div>

                          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
                            {task.comments.length === 0 ? (
                              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                                <img src={emptyCommentsImage} alt="尚無留言" className="w-40" />
                                <p className="text-sm text-slate-500">目前沒有留言</p>
                              </div>
                            ) : (
                              task.comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded-xl border border-brand-border bg-slate-50 px-3 py-2"
                                >
                                  <div className="mb-1 flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <AvatarImage
                                        src={comment.user.avatar}
                                        name={comment.user.name}
                                        className="h-7 w-7 rounded-full"
                                      />
                                      <div>
                                        <p className="text-xs font-semibold text-slate-700">
                                          {comment.user.name}
                                        </p>
                                        <p className="text-[11px] text-slate-500">
                                          {formatDateTime(comment.createdAt)}
                                        </p>
                                      </div>
                                    </div>
                                    {canDeleteComment(comment, currentUser) ? (
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteComment(comment.id)}
                                        disabled={busy}
                                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        <ArrowUturnLeftIcon className="h-3.5 w-3.5" />
                                        刪除
                                      </button>
                                    ) : null}
                                  </div>
                                  <p className="text-sm text-slate-700">{comment.message}</p>
                                </div>
                              ))
                            )}
                          </div>

                          <form onSubmit={handleCommentSubmit} className="border-t border-brand-border p-3">
                            <label className="sr-only" htmlFor="new-comment">
                              新增留言
                            </label>
                            <div className="flex gap-2">
                              <input
                                id="new-comment"
                                value={commentInput}
                                disabled={disabled}
                                onChange={(event) => setCommentInput(event.target.value)}
                                placeholder={canManage ? "輸入留言..." : "目前無法留言"}
                                className="input-base"
                              />
                              <button
                                type="submit"
                                disabled={disabled}
                                className="btn-primary inline-flex shrink-0 items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <PaperAirplaneIcon className="h-4 w-4" />
                                送出
                              </button>
                            </div>
                          </form>
                        </aside>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </div>

        {previewAttachment ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
            <div className="flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <p className="truncate pr-4 text-sm font-semibold text-slate-800">{previewAttachment.fileName}</p>
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <XMarkIcon className="h-4 w-4" />
                  關閉
                </button>
              </div>

              <div className="min-h-0 flex-1 bg-slate-50 p-3">
                {previewAttachment.contentType?.startsWith("image/") ? (
                  <img
                    src={previewAttachment.url}
                    alt={previewAttachment.fileName}
                    className="h-full w-full rounded-lg border border-slate-200 object-contain bg-white"
                  />
                ) : (
                  <iframe
                    src={previewAttachment.url}
                    title={previewAttachment.fileName}
                    className="h-full w-full rounded-lg border border-slate-200 bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Dialog>
    </Transition>
  );
};
