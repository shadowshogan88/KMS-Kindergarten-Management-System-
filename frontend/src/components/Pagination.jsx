import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

const buildPages = (current, total) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, current, current - 1, current + 1]);
  return Array.from(pages)
    .filter(p => p >= 1 && p <= total)
    .sort((a, b) => a - b);
};

const Pagination = ({ page, totalPages, onPageChange }) => {
  if (!totalPages || totalPages <= 1) return null;

  const pages = buildPages(page, totalPages);

  return (
    <nav className="flex items-center gap-2" aria-label="Pagination">
      <button
        type="button"
        className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary hover:border-primary/10 flex items-center disabled:opacity-50 disabled:pointer-events-none"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        <LuChevronLeft className="size-4 me-1" /> Prev
      </button>

      {pages.map((p, idx) => {
        const prev = pages[idx - 1];
        const needsDots = idx > 0 && prev && p - prev > 1;
        return (
          <span key={p} className="flex items-center gap-2">
            {needsDots ? <span className="text-default-500 px-1">...</span> : null}
            <button
              type="button"
              onClick={() => onPageChange(p)}
              className={`btn size-7.5 ${
                p === page
                  ? 'bg-primary text-white'
                  : 'bg-transparent border border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary'
              }`}
            >
              {p}
            </button>
          </span>
        );
      })}

      <button
        type="button"
        className="btn btn-sm border bg-transparent border-default-200 text-default-600 hover:bg-primary/10 hover:text-primary hover:border-primary/10 flex items-center disabled:opacity-50 disabled:pointer-events-none"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        Next <LuChevronRight className="size-4 ms-1" />
      </button>
    </nav>
  );
};

export default Pagination;
