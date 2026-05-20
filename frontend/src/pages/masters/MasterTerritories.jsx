import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'
import useAccessStore from '../../store/accessStore'

export default function MasterTerritories() {
  const qc = useQueryClient()
  const { accessiblePages } = useAccessStore()
  const canAdd = accessiblePages.includes('masters_territories_add')
  const canEdit = accessiblePages.includes('masters_territories_edit')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', division_id: '', code: '' })

  const { data: divisions = [] } = useQuery({
    queryKey: ['master-divisions'],
    queryFn: () => masterApi.divisions().then(r => r.data),
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['master-territories'],
    queryFn: () => masterApi.territories().then(r => r.data),
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(items, 20)

  const create = useMutation({
    mutationFn: () => masterApi.createTerritory(form),
    onSuccess: () => { qc.invalidateQueries(['master-territories']); setShowAdd(false); setForm({ name: '', division_id: '', code: '' }); toast.success('Created') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const update = useMutation({
    mutationFn: () => masterApi.updateTerritory(editId, form),
    onSuccess: () => { qc.invalidateQueries(['master-territories']); setEditId(null); setForm({ name: '', division_id: '', code: '' }); toast.success('Updated') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const remove = useMutation({
    mutationFn: (id) => masterApi.deleteTerritory(id),
    onSuccess: () => { qc.invalidateQueries(['master-territories']); toast.success('Deactivated') },
  })

  return (
    <div className="p-8">
      <PageHeader title="Territories" subtitle="Manage territories mapped to divisions"
        actions={canAdd && <button onClick={() => { setForm({ name: '', division_id: '', code: '' }); setShowAdd(true) }} className="btn-primary flex items-center gap-2"><Plus size={16} />Add</button>}
      />

      {(showAdd || editId) && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex items-end gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-gray-600 block mb-1">Territory Name *</label>
            <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div className="w-48">
            <label className="text-xs font-medium text-gray-600 block mb-1">Division *</label>
            <select className="input w-full" value={form.division_id} onChange={e => setForm(f => ({ ...f, division_id: e.target.value }))}>
              <option value="">Select...</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="w-32">
            <label className="text-xs font-medium text-gray-600 block mb-1">Code</label>
            <input className="input w-full" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={() => editId ? update.mutate() : create.mutate()}>{editId ? 'Update' : 'Create'}</button>
          <button className="btn-secondary" onClick={() => { setShowAdd(false); setEditId(null) }}>Cancel</button>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Territory Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Code</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Division</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono text-xs">{item.code || '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{item.division_name || '—'}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {canEdit && <button onClick={() => { setEditId(item.id); setForm({ name: item.name, division_id: item.division_id || '', code: item.code || '' }); setShowAdd(false) }} className="p-1 text-blue-500 hover:text-blue-700"><Pencil size={14} /></button>}
                      {canEdit && <button onClick={() => { if (confirm('Deactivate?')) remove.mutate(item.id) }} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No territories</td></tr>}
            </tbody>
          </table>
          {total > 0 && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />}
        </div>
      )}
    </div>
  )
}
