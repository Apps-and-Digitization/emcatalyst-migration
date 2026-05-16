import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { vendorApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'

export default function VendorHsnSacCodes() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ code: '', description: '' })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['vendor-hsn-sac-codes'],
    queryFn: () => vendorApi.hsnSacCodes().then(r => r.data),
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(items, 20)

  const create = useMutation({
    mutationFn: () => vendorApi.createHsnSacCode(form),
    onSuccess: () => { qc.invalidateQueries(['vendor-hsn-sac-codes']); setShowForm(false); setForm({ code: '', description: '' }); toast.success('Created') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const update = useMutation({
    mutationFn: () => vendorApi.updateHsnSacCode(editId, form),
    onSuccess: () => { qc.invalidateQueries(['vendor-hsn-sac-codes']); setShowForm(false); setEditId(null); setForm({ code: '', description: '' }); toast.success('Updated') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const remove = useMutation({
    mutationFn: (id) => vendorApi.deleteHsnSacCode(id),
    onSuccess: () => { qc.invalidateQueries(['vendor-hsn-sac-codes']); toast.success('Removed') },
  })

  return (
    <div className="p-8">
      <PageHeader title="HSN/SAC Codes" subtitle="Manage HSN or SAC codes"
        actions={<button onClick={() => { setForm({ code: '', description: '' }); setEditId(null); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={16} />Add</button>}
      />

      {showForm && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">Code *</label>
            <input className="input w-full" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} autoFocus />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
            <input className="input w-full" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={() => editId ? update.mutate() : create.mutate()}>{editId ? 'Update' : 'Create'}</button>
          <button className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</button>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Code</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Description</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-medium text-gray-800">{item.code}</td>
                  <td className="px-4 py-2 text-gray-600">{item.description || '-'}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setForm({ code: item.code, description: item.description || '' }); setEditId(item.id); setShowForm(true) }} className="p-1 text-blue-500 hover:text-blue-700"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm('Remove?')) remove.mutate(item.id) }} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No codes found</td></tr>}
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
