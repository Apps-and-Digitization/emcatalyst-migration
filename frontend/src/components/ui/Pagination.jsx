import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Reusable pagination component.
 * Props:
 *  - page: current page (1-indexed)
 *  - pageSize: items per page
 *  - total: total number of items
 *  - onPageChange: (newPage) => void
 *  - onPageSizeChange: (newSize) => void (optional)
 *  - pageSizeOptions: array of sizes (default [20, 50, 100])
 */
export default function Pagination({ page, pageSize, total, onPageChange, onPageSizeChange, pageSizeOptions = [20, 50, 100] }) {
  const totalPages = Math.ceil(total / pageSize) || 1
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500">
          Showing <span className="font-medium text-gray-700">{from}</span> to <span className="font-medium text-gray-700">{to}</span> of <span className="font-medium text-gray-700">{total.toLocaleString()}</span>
        </span>
        {onPageSizeChange && (
          <select
            className="text-xs border rounded px-2 py-1 text-gray-600"
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map(s => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={14} />
        </button>
        {/* Page numbers */}
        {_getPageNumbers(page, totalPages).map((p, i) => (
          p === '...' ? (
            <span key={`dots-${i}`} className="px-2 text-xs text-gray-400">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                p === page
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        ))}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded border text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  )
}

function _getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = []
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total)
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total)
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total)
  }
  return pages
}
