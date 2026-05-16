import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { vendorApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'

export default function VendorGLAccounts() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ gl_number: '' })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['vendor-gl-accounts'],
    queryFn: () => vendorApi.glAccounts().then(r => r.data),
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(items, 20)

  const create = useMutation({
    mutationFn: () => vendorApi.createGlAccount(form),
    onSuccess: () => { qc.invalidateQueries(['vendor-gl-accounts']); setShowAdd(false); setForm({ gl_number: '' }); toast.success('Created') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const remove = useMutation({
    mutationFn: (id) => vendorApi.deleteGlAccount(id),
    onSuccess: () => { qc.invalidateQueries(['vendor-gl-accounts']); toast.success('Deleted') },
  })

  return (
    <div className="p-8">
      <PageHeader title="GL Accounts" subtitle="Manage GL account numbers"
        actions={<button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus size={16} />Add</button>}
      />

      {showAdd && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">GL Number</label>
            <input className="input w-full" value={form.gl_number} onChange={e => setForm({ gl_number: e.target.value })} autoFocus />
          </div>
          <button className="btn-primary" onClick={() => create.mutate()}>Create</button>
          <button className="btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">GL Number</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-medium text-gray-800">{item.gl_number}</td>
                  <td className="px-4 py-2 text-center">
                    <button onClick={() => { if (confirm('Delete?')) remove.mutate(item.id) }} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">No GL accounts</td></tr>}
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
