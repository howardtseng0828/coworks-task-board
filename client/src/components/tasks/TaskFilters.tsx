import { MagnifyingGlassIcon, PlusIcon } from "@heroicons/react/24/outline";
import type { Group, ScopeFilter, TaskFilters as TaskFiltersType } from "../../types";

interface TaskFiltersProps {
  filters: TaskFiltersType;
  groups: Group[];
  creating: boolean;
  onChange: (patch: Partial<TaskFiltersType>) => void;
  onCreate: () => void;
}

const scopeOptions: Array<{ value: ScopeFilter; label: string }> = [
  { value: "related", label: "與我相關" },
  { value: "delegated", label: "我指派的" },
  { value: "todo", label: "我的待辦" },
  { value: "all", label: "全部" }
];

export const TaskFilters = ({ filters, groups, creating, onChange, onCreate }: TaskFiltersProps) => {
  return (
    <section className="glass-card p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <label className="relative">
          <span className="sr-only">搜尋任務</span>
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.query}
            onChange={(event) => onChange({ query: event.target.value })}
            placeholder="搜尋標題 / 內容 / 標籤 / 負責人 / 部門"
            className="input-base pl-10"
          />
        </label>

        <button
          type="button"
          onClick={onCreate}
          disabled={creating}
          className="btn-primary inline-flex h-10 w-full items-center justify-center gap-1.5 px-4 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
        >
          <PlusIcon className="h-4 w-4" />
          新增任務
        </button>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-sm">
          <span className="text-slate-500">開始日期</span>
          <input
            type="date"
            value={filters.startDate}
            onChange={(event) => onChange({ startDate: event.target.value })}
            className="input-base"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-slate-500">結束日期</span>
          <input
            type="date"
            value={filters.endDate}
            onChange={(event) => onChange({ endDate: event.target.value })}
            className="input-base"
          />
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-slate-500">狀態</span>
          <select
            value={filters.status}
            onChange={(event) => onChange({ status: event.target.value as TaskFiltersType["status"] })}
            className="input-base"
          >
            <option value="all">全部</option>
            <option value="todo">待處理</option>
            <option value="done">已完成</option>
          </select>
        </label>

        <label className="space-y-1 text-sm">
          <span className="text-slate-500">部門</span>
          <select
            value={filters.groupId}
            onChange={(event) => {
              const value = event.target.value;
              onChange({ groupId: value === "all" ? "all" : Number(value) });
            }}
            className="input-base"
          >
            <option value="all">全部部門</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {scopeOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange({ scope: option.value })}
            className={`inline-flex min-w-0 items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer ${
              filters.scope === option.value
                ? "border-brand-primary bg-brand-primary text-white"
                : "border-brand-border bg-white text-slate-600 hover:border-brand-primary hover:text-brand-deep"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
};
