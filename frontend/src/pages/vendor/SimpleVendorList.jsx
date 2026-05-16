import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'

export default function SimpleVendorList({ title, subtitle, queryKey, fetchFn, createFn, updateFn, deleteFn, fieldName = 'name', fieldLabel = 'Name' }) {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [value, setValue] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: () => fetchFn().then(r => r.data),
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(items, 20)

  const create = useMutation({
    mutationFn: () => createFn(value),
    onSuccess: () => { qc.invalidateQueries([queryKey]); setShowAdd(false); setValue(''); toast.success('Created') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const update = useMutation({
    mutationFn: () => updateFn(editId, { [fieldName]: value }),
    onSuccess: () => { qc.invalidateQueries([queryKey]); setEditId(null); setValue(''); toast.success('Updated') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const remove = useMutation({
    mutationFn: (id) => deleteFn(id),
    onSuccess: () => { qc.invalidateQueries([queryKey]); toast.success('Removed') },
  })

  return (
    <div className="p-8">
      <PageHeader title={title} subtitle={subtitle}
        actions={<button onClick={() => { setValue(''); setShowAdd(true) }} className="btn-primary flex items-center gap-2"><Plus size={16} />Add</button>}
      />

      {(showAdd || editId) && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">{fieldLabel}</label>
            <input className="input w-full" value={value} onChange={e => setValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { editId ? update.mutate() : create.mutate() } }} autoFocus />
          </div>
          <button className="btn-primary" onClick={() => editId ? update.mutate() : create.mutate()}>
            {editId ? 'Update' : 'Create'}
          </button>
          <button className="btn-secondary" onClick={() => { setShowAdd(false); setEditId(null); setValue('') }}>Cancel</button>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">#</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">{fieldLabel}</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item, i) => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400 text-xs">{(page - 1) * pageSize + i + 1}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{item[fieldName]}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditId(item.id); setValue(item[fieldName]); setShowAdd(false) }} className="p-1 text-blue-500 hover:text-blue-700"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm('Remove this item?')) remove.mutate(item.id) }} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No items found</td></tr>}
            </tbody>
          </table>
          {total > 0 && (
            <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          )}
        </div>
      )}
    </div>
  )
}
