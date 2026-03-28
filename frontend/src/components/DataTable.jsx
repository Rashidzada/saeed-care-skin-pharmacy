import { useState } from 'react'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'

export default function DataTable({
  columns,
  data = [],
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  onSearch,
  pagination,
  onPageChange,
  emptyMessage = 'No data found.',
  rowClassName,
}) {
  const [localSearch, setLocalSearch] = useState('')

  const handleSearch = (event) => {
    const value = event.target.value
    setLocalSearch(value)
    if (onSearch) onSearch(value)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {searchable && (
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={localSearch}
              onChange={handleSearch}
              placeholder={searchPlaceholder}
              className="input pl-9 text-sm"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${col.className || ''}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <tr key={index}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400 text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, index) => (
                <tr
                  key={row.id || index}
                  className={`hover:bg-gray-50 transition-colors ${rowClassName ? rowClassName(row) : ''}`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.cellClassName || ''}`}>
                      {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '-')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pagination && pagination.count > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Showing {((pagination.page - 1) * pagination.pageSize) + 1}-
            {Math.min(pagination.page * pagination.pageSize, pagination.count)} of {pagination.count}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs text-gray-600 px-2">
              {pagination.page} / {Math.ceil(pagination.count / pagination.pageSize)}
            </span>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= Math.ceil(pagination.count / pagination.pageSize)}
              className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
