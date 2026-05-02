import { useEffect, useMemo, useState } from "react";
import { AvatarImage } from "../components/shared/AvatarImage";
import { Pagination } from "../components/shared/Pagination";
import { useLookups } from "../hooks/useLookups";
import { taskService } from "../services/taskService";
import type { AuthUser, User } from "../types";

const PAGE_SIZE = 5;

interface MembersPageProps {
  currentUser: AuthUser;
}

const getLoginTypes = (user: User) =>
  [user.lineUserId ? "LINE" : null, user.internalUserNo ? "HHT" : null].filter(Boolean).join(" / ") || "未綁定";

const RoleBadge = ({ isAdmin }: { isAdmin?: boolean }) => (
  <span
    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
      isAdmin ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
    }`}
  >
    {isAdmin ? "管理員" : "一般使用者"}
  </span>
);

export const MembersPage = ({ currentUser }: MembersPageProps) => {
  const [actionError, setActionError] = useState<string | null>(null);
  const [workingUserId, setWorkingUserId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const { users, loading, error, reload } = useLookups();

  const combinedError = useMemo(() => actionError ?? error, [actionError, error]);
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const pagedUsers = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return users.slice(startIndex, startIndex + PAGE_SIZE);
  }, [page, users]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleToggleAdmin = async (user: User) => {
    if (!currentUser.isAdmin || user.id === currentUser.id) {
      return;
    }

    setActionError(null);
    setWorkingUserId(user.id);

    try {
      await taskService.updateUserAdminStatus(user.id, !(user.isAdmin ?? false));
      await reload();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "更新管理員權限失敗，請稍後再試。");
    } finally {
      setWorkingUserId(null);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (!currentUser.isAdmin || user.id === currentUser.id) {
      return;
    }

    const confirmed = window.confirm(`確定要刪除 ${user.name} 嗎？`);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setWorkingUserId(user.id);

    try {
      await taskService.deleteUser(user.id);
      await reload();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "刪除使用者失敗，請稍後再試。");
    } finally {
      setWorkingUserId(null);
    }
  };

  if (!currentUser.isAdmin) {
    return (
      <section className="glass-card px-4 py-5 sm:px-5">
        <h1 className="text-xl font-semibold text-slate-800">人員管理</h1>
        <p className="mt-2 text-sm text-slate-600">只有管理員可以檢視與調整人員權限。</p>
      </section>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">人員管理</h1>
        <p className="text-sm text-slate-500">可查看頭像、登入綁定狀態與管理員權限。</p>
      </div>

      {combinedError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
          {combinedError}
        </div>
      ) : null}

      <section className="glass-card overflow-hidden">
        <div className="border-b border-brand-border px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-slate-800">成員列表</h2>
          <p className="text-xs text-slate-500">每頁 5 筆，可切換頁面管理成員。</p>
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">載入人員資料中...</div>
        ) : users.length === 0 ? (
          <div className="px-4 py-6 text-sm text-slate-500">目前沒有可管理的成員。</div>
        ) : (
          <>
            <div className="space-y-3 p-3 lg:hidden">
              {pagedUsers.map((user) => {
                const isSelf = user.id === currentUser.id;
                const workingThisUser = workingUserId === user.id;

                return (
                  <article key={user.id} className="rounded-2xl border border-brand-border bg-white p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <AvatarImage src={user.avatar} name={user.name} className="h-12 w-12 rounded-full shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="break-words text-base font-semibold text-slate-800">{user.name}</p>
                          {isSelf ? <span className="text-xs text-slate-400">(你)</span> : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">{getLoginTypes(user)}</p>
                        <div className="mt-2">
                          <RoleBadge isAdmin={user.isAdmin} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-brand-surface/70 p-3 text-sm">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">綁定登入</p>
                        <p className="mt-1 text-slate-700">{getLoginTypes(user)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">權限</p>
                        <div className="mt-1">
                          <RoleBadge isAdmin={user.isAdmin} />
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isSelf || workingThisUser}
                        onClick={() => void handleToggleAdmin(user)}
                        className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {user.isAdmin ? "設為一般使用者" : "設為管理員"}
                      </button>
                      <button
                        type="button"
                        disabled={isSelf || workingThisUser}
                        onClick={() => void handleDeleteUser(user)}
                        className="btn-secondary text-xs text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        刪除
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">頭像</th>
                    <th className="px-4 py-2">名稱</th>
                    <th className="px-4 py-2">綁定登入</th>
                    <th className="px-4 py-2">權限</th>
                    <th className="px-4 py-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedUsers.map((user) => {
                    const isSelf = user.id === currentUser.id;
                    const workingThisUser = workingUserId === user.id;

                    return (
                      <tr key={user.id} className="border-t border-brand-border/60">
                        <td className="px-4 py-3">
                          <AvatarImage src={user.avatar} name={user.name} className="h-10 w-10 rounded-full" />
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">
                          {user.name}
                          {isSelf ? <span className="ml-2 text-xs text-slate-400">(你)</span> : null}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{getLoginTypes(user)}</td>
                        <td className="px-4 py-3">
                          <RoleBadge isAdmin={user.isAdmin} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={isSelf || workingThisUser}
                              onClick={() => void handleToggleAdmin(user)}
                              className="btn-secondary text-xs disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {user.isAdmin ? "設為一般使用者" : "設為管理員"}
                            </button>
                            <button
                              type="button"
                              disabled={isSelf || workingThisUser}
                              onClick={() => void handleDeleteUser(user)}
                              className="btn-secondary text-xs text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              刪除
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <Pagination page={page} pageSize={PAGE_SIZE} total={users.length} onChange={setPage} />
      </section>
    </div>
  );
};
