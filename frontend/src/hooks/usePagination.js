import { useState, useMemo } from 'react'

/**
 * Client-side pagination hook.
 * Use when data is already fully loaded (master lists, reports, etc.)
 *
 * Usage:
 *   const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(items, 20)
 *
 * Then render:
 *   <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s) }} />
 */
export default function usePagination(items = [], defaultPageSize = 20) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)

  const total = items.length

  const paginatedItems = useMemo(() => {
    const start = (page - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, page, pageSize])

  // Reset to page 1 if items change and current page is out of bounds
  const totalPages = Math.ceil(total / pageSize) || 1
  if (page > totalPages && totalPages > 0) {
    setPage(1)
  }

  const handleSetPageSize = (newSize) => {
    setPageSize(newSize)
    setPage(1)
  }

  return {
    paginatedItems,
    page,
    pageSize,
    total,
    setPage,
    setPageSize: handleSetPageSize,
  }
}
