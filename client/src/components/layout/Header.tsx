import { Dialog, Menu, Transition } from "@headlessui/react";
import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  Bars3Icon,
  BellIcon,
  CheckIcon,
  ChevronDownIcon,
  LinkIcon
} from "@heroicons/react/24/outline";
import clsx from "clsx";
import { Fragment, useState } from "react";
import type { AuthUser, NotificationItem } from "../../types";
import { formatDateTime } from "../../utils/date";
import { AvatarImage } from "../shared/AvatarImage";

interface HeaderProps {
  user: AuthUser;
  notifications: NotificationItem[];
  unreadCount: number;
  notificationsLoading: boolean;
  lineLinkUrl?: string | null;
  onMenuClick: () => void;
  onLogout: () => void;
  onOpenTaskFromNotification: (taskId: number) => void;
  onMarkNotificationRead: (notificationId: number) => void;
  onMarkAllNotificationsRead: () => void;
  onReloadNotifications: () => void;
  onLinkInternal?: (userNo: string, password: string) => Promise<void>;
}

const accountMenuItemClass = (active: boolean, tone: "default" | "danger" = "default") =>
  clsx(
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
    tone === "danger"
      ? active
        ? "bg-rose-50 text-rose-600"
        : "text-rose-600"
      : active
        ? "bg-brand-surface text-brand-deep"
        : "text-slate-700"
  );

export const Header = ({
  user,
  notifications,
  unreadCount,
  notificationsLoading,
  lineLinkUrl,
  onMenuClick,
  onLogout,
  onOpenTaskFromNotification,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onReloadNotifications,
  onLinkInternal
}: HeaderProps) => {
  const [internalLinkOpen, setInternalLinkOpen] = useState(false);
  const [internalUserNo, setInternalUserNo] = useState("");
  const [internalPassword, setInternalPassword] = useState("");
  const [internalLinking, setInternalLinking] = useState(false);
  const [internalLinkError, setInternalLinkError] = useState<string | null>(null);

  const canBindLine = Boolean(user.internalUserNo && !user.lineUserId && lineLinkUrl);
  const canBindInternal = Boolean(user.lineUserId && !user.internalUserNo && onLinkInternal);
  const hasFullyBound = Boolean(user.internalUserNo && user.lineUserId);
  const providerLabel = user.authProvider.toUpperCase();
  const roleLabel = user.isAdmin ? "管理員" : "一般成員";
  const bindingStatus = hasFullyBound
    ? "LINE / 內部帳號 已綁定"
    : canBindLine
      ? "可綁定 LINE"
      : canBindInternal
        ? "可綁定內部帳號"
        : "尚未完成綁定";

  const closeInternalDialog = () => {
    setInternalLinkOpen(false);
    setInternalUserNo("");
    setInternalPassword("");
    setInternalLinkError(null);
    setInternalLinking(false);
  };

  const handleLinkInternal = async () => {
    if (!onLinkInternal || !internalUserNo.trim() || !internalPassword) {
      return;
    }

    setInternalLinkError(null);
    setInternalLinking(true);
    try {
      await onLinkInternal(internalUserNo.trim(), internalPassword);
      closeInternalDialog();
    } catch (error) {
      setInternalLinkError(error instanceof Error ? error.message : "綁定失敗，請稍後再試。");
    } finally {
      setInternalLinking(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/70 bg-white/70 backdrop-blur-lg">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-border bg-white text-slate-700 transition-colors duration-200 hover:bg-brand-surface cursor-pointer"
            aria-label="開啟選單"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-brand-border bg-white text-slate-700 transition-colors duration-200 hover:bg-brand-surface cursor-pointer"
                aria-label="通知"
              >
                <BellIcon className="h-5 w-5" />
                {unreadCount > 0 ? (
                  <span className="absolute right-2 top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}
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
                <Menu.Items className="fixed inset-x-3 top-[4.5rem] z-30 origin-top rounded-xl border border-brand-border bg-white shadow-lg focus:outline-none sm:absolute sm:right-0 sm:left-auto sm:top-auto sm:mt-2 sm:w-[340px] sm:origin-top-right">
                  <div className="flex items-center justify-between border-b border-brand-border px-3 py-2">
                    <p className="text-sm font-semibold text-slate-700">通知</p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={onReloadNotifications}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                        title="重新整理通知"
                      >
                        <ArrowPathIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={onMarkAllNotificationsRead}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors duration-200 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                        title="全部標示已讀"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-[min(70vh,32rem)] overflow-y-auto p-1 sm:max-h-80">
                    {notificationsLoading ? (
                      <div className="px-3 py-4 text-center text-sm text-slate-500">通知載入中...</div>
                    ) : notifications.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-slate-500">目前沒有通知</div>
                    ) : (
                      notifications.map((notification) => (
                        <Menu.Item key={notification.id}>
                          {({ active }) => (
                            <button
                              type="button"
                              onClick={() => {
                                if (!notification.isRead) {
                                  onMarkNotificationRead(notification.id);
                                }
                                onOpenTaskFromNotification(notification.taskId);
                              }}
                              className={clsx(
                                "w-full rounded-lg px-3 py-2 text-left transition-colors duration-150 cursor-pointer",
                                active ? "bg-brand-surface" : "bg-white",
                                !notification.isRead && "bg-emerald-50/60"
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p
                                  className={clsx(
                                    "text-sm break-words",
                                    notification.isRead ? "text-slate-600" : "font-semibold text-slate-800"
                                  )}
                                >
                                  {notification.message}
                                </p>
                                {!notification.isRead ? (
                                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" />
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {formatDateTime(notification.createdAt)}
                              </p>
                            </button>
                          )}
                        </Menu.Item>
                      ))
                    )}
                  </div>
                </Menu.Items>
              </Transition>
            </Menu>

            <Menu as="div" className="relative inline-block text-left">
              <Menu.Button className="flex min-w-0 items-center gap-2 rounded-xl border border-brand-border bg-white px-2 py-1.5 shadow-sm transition-colors duration-200 hover:bg-brand-surface">
                <AvatarImage src={user.avatar} name={user.name} className="h-8 w-8 rounded-full" />

                <div className="hidden min-w-0 pr-1 sm:block">
                  <p className="truncate text-sm font-semibold text-slate-700">{user.name}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {roleLabel} / {providerLabel}
                  </p>
                </div>

                <ChevronDownIcon className="hidden h-4 w-4 text-slate-400 sm:block" />
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
                <Menu.Items className="absolute right-0 z-30 mt-2 w-[min(320px,calc(100vw-1.5rem))] rounded-xl border border-brand-border bg-white p-1 shadow-lg focus:outline-none">
                  <div className="border-b border-brand-border px-3 py-3">
                    <div className="flex items-center gap-3">
                      <AvatarImage src={user.avatar} name={user.name} className="h-10 w-10 rounded-full" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {roleLabel} / {providerLabel}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">帳號綁定</p>
                      <p className="mt-1 text-sm text-slate-700">{bindingStatus}</p>
                    </div>
                  </div>

                  {canBindLine ? (
                    <Menu.Item>
                      {({ active }) => (
                        <a href={lineLinkUrl!} className={accountMenuItemClass(active)}>
                          <LinkIcon className="h-4 w-4" />
                          綁定 LINE
                        </a>
                      )}
                    </Menu.Item>
                  ) : null}

                  {canBindInternal ? (
                    <Menu.Item>
                      {({ active, close }) => (
                        <button
                          type="button"
                          onClick={() => {
                            close();
                            setInternalLinkOpen(true);
                          }}
                          className={accountMenuItemClass(active)}
                        >
                          <LinkIcon className="h-4 w-4" />
                          綁定 HHT
                        </button>
                      )}
                    </Menu.Item>
                  ) : null}

                  {hasFullyBound ? (
                    <div className="px-3 py-2 text-sm text-emerald-700">LINE / 內部帳號 已完成綁定</div>
                  ) : null}

                  <Menu.Item>
                    {({ active }) => (
                      <button type="button" onClick={onLogout} className={accountMenuItemClass(active, "danger")}>
                        <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
                        登出
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </div>
      </header>

      <Transition show={internalLinkOpen} as={Fragment}>
        <Dialog as="div" className="relative z-30" onClose={closeInternalDialog}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-slate-900/40" />
          </Transition.Child>

          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="transition duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="transition duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md rounded-2xl border border-brand-border bg-white p-5 shadow-xl">
                <Dialog.Title className="text-lg font-semibold text-slate-800">綁定內部帳號</Dialog.Title>
                <p className="mt-1 text-sm text-slate-500">
                  輸入 內部帳號與密碼後，即可把目前的 LINE 登入綁定到內部帳號身分。
                </p>

                {internalLinkError ? (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                    {internalLinkError}
                  </div>
                ) : null}

                <div className="mt-4 space-y-3">
                  <label className="block space-y-1 text-sm">
                    <span className="text-slate-600">內部帳號</span>
                    <input
                      value={internalUserNo}
                      onChange={(event) => setInternalUserNo(event.target.value)}
                      className="input-base"
                      autoComplete="username"
                      placeholder="請輸入 內部帳號"
                    />
                  </label>
                  <label className="block space-y-1 text-sm">
                    <span className="text-slate-600">內部密碼</span>
                    <input
                      type="password"
                      value={internalPassword}
                      onChange={(event) => setInternalPassword(event.target.value)}
                      className="input-base"
                      autoComplete="current-password"
                      placeholder="請輸入 內部密碼"
                    />
                  </label>
                </div>

                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={closeInternalDialog} className="btn-secondary">
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleLinkInternal()}
                    disabled={internalLinking || !internalUserNo.trim() || !internalPassword}
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {internalLinking ? "綁定中..." : "開始綁定"}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition>
    </>
  );
};
