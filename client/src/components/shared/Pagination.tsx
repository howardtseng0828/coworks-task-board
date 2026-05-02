interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export const Pagination = ({ page, pageSize, total, onChange }: PaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) {
    return null;
  }

  const canPrev = page > 1;
  const canNext = page < totalPages;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-2 border-t border-brand-border bg-white px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-slate-500">
        顯示第 {start}-{end} 筆，共 {total} 筆
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={!canPrev}
          className="btn-secondary h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          上一頁
        </button>
        <span className="text-xs font-semibold text-slate-600">
          第 {page} / {totalPages} 頁
        </span>
        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={!canNext}
          className="btn-secondary h-8 px-3 text-xs disabled:cursor-not-allowed disabled:opacity-50"
        >
          下一頁
        </button>
      </div>
    </div>
  );
};
