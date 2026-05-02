import { useEffect, useMemo, useState } from "react";
import { AvatarImage } from "../components/shared/AvatarImage";
import { Pagination } from "../components/shared/Pagination";
import { useLookups } from "../hooks/useLookups";
import { taskService } from "../services/taskService";
import type { AuthUser } from "../types";

const PAGE_SIZE = 5;

interface GroupListPageProps {
  currentUser: AuthUser;
}

export const GroupListPage = ({ currentUser }: GroupListPageProps) => {
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingGroupId, setDeletingGroupId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const { groups, loading, error, reload } = useLookups();

  const canManage = currentUser.isAdmin;
  const combinedError = useMemo(() => actionError ?? error, [actionError, error]);
  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pagedGroups = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return groups.slice(startIndex, startIndex + PAGE_SIZE);
  }, [groups, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleCreateGroup = async () => {
    if (!canManage) {
      return;
    }

    const name = newGroupName.trim();
    if (!name) {
      return;
    }

    setActionError(null);
    setCreating(true);
    try {
      await taskService.createGroup(name);
      setNewGroupName("");
      await reload();
      setPage(1);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "新增群組失敗，請稍後再試。");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: number, groupName: string) => {
    if (!canManage) {
      return;
    }

    const confirmed = window.confirm(`確定要刪除群組「${groupName}」嗎？`);
    if (!confirmed) {
      return;
    }

    setActionError(null);
    setDeletingGroupId(groupId);
    try {
      await taskService.deleteGroup(groupId);
      await reload();
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "刪除群組失敗，請稍後再試。");
    } finally {
      setDeletingGroupId(null);
    }
  };

  return (
    <div className="space-y-4 pb-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">群組清單</h1>
        <p className="text-sm text-slate-500">管理任務指派使用的部門/群組名稱。</p>
      </div>

      {canManage ? (
        <section className="glass-card px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newGroupName}
              onChange={(event) => setNewGroupName(event.target.value)}
              className="input-base"
              placeholder="輸入新群組名稱"
            />
            <button
              type="button"
              onClick={() => void handleCreateGroup()}
              disabled={creating || !newGroupName.trim()}
              className="btn-primary shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creating ? "新增中..." : "新增群組"}
            </button>
          </div>
        </section>
      ) : (
        <section className="glass-card px-4 py-4 sm:px-5 text-sm text-slate-600">僅管理員可新增或刪除群組。</section>
      )}

      {combinedError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">
          {combinedError}
        </div>
      ) : null}

      <section className="glass-card overflow-hidden">
        <div className="border-b border-brand-border px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-slate-800">群組列表</h2>
          <p className="text-xs text-slate-500">每頁 5 筆，支援管理員刪除群組。</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">頭像</th>
                <th className="px-4 py-2">群組名稱</th>
                <th className="px-4 py-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={3}>
                    載入群組中...
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-slate-500" colSpan={3}>
                    目前沒有群組資料。
                  </td>
                </tr>
              ) : (
                pagedGroups.map((group) => (
                  <tr key={group.id} className="border-t border-brand-border/60">
                    <td className="px-4 py-2">
                      <AvatarImage src={null} name={group.name} className="h-10 w-10 rounded-full" />
                    </td>
                    <td className="px-4 py-2 font-medium text-slate-700">{group.name}</td>
                    <td className="px-4 py-2">
                      {canManage ? (
                        <button
                          type="button"
                          disabled={deletingGroupId === group.id}
                          onClick={() => void handleDeleteGroup(group.id, group.name)}
                          className="btn-secondary text-xs text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          刪除
                        </button>
                      ) : (
                        <span className="text-slate-400">無權限</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageSize={PAGE_SIZE} total={groups.length} onChange={setPage} />
      </section>
    </div>
  );
};
