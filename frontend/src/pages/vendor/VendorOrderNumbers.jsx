import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { vendorApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'

export default function VendorOrderNumbers() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ name: '', type_of_service_id: '' })

  const { data: services = [] } = useQuery({
    queryKey: ['vendor-type-of-services'],
    queryFn: () => vendorApi.typeOfServices().then(r => r.data),
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['vendor-order-numbers'],
    queryFn: () => vendorApi.orderNumbers().then(r => r.data),
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(items, 20)

  const create = useMutation({
    mutationFn: () => vendorApi.createOrderNumber(form),
    onSuccess: () => { qc.invalidateQueries(['vendor-order-numbers']); setShowAdd(false); setForm({ name: '', type_of_service_id: '' }); toast.success('Created') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const update = useMutation({
    mutationFn: () => vendorApi.updateOrderNumber(editId, { name: form.name, type_of_service_id: form.type_of_service_id }),
    onSuccess: () => { qc.invalidateQueries(['vendor-order-numbers']); setEditId(null); setForm({ name: '', type_of_service_id: '' }); toast.success('Updated') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const remove = useMutation({
    mutationFn: (id) => vendorApi.deleteOrderNumber(id),
    onSuccess: () => { qc.invalidateQueries(['vendor-order-numbers']); toast.success('Removed') },
  })

  return (
    <div className="p-8">
      <PageHeader title="Order Numbers" subtitle="Manage order numbers linked to type of services"
        actions={<button onClick={() => { setForm({ name: '', type_of_service_id: '' }); setShowAdd(true) }} className="btn-primary flex items-center gap-2"><Plus size={16} />Add</button>}
      />

      {(showAdd || editId) && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">Order Number</label>
            <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-gray-600 block mb-1">Type of Service</label>
            <select className="input w-full" value={form.type_of_service_id} onChange={e => setForm(f => ({ ...f, type_of_service_id: e.target.value }))}>
              <option value="">Select...</option>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <button className="btn-primary" onClick={() => editId ? update.mutate() : create.mutate()}>{editId ? 'Update' : 'Create'}</button>
          <button className="btn-secondary" onClick={() => { setShowAdd(false); setEditId(null) }}>Cancel</button>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Order Number</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Type of Service</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-2 text-gray-600">{services.find(s => s.id === item.type_of_service_id)?.name || '-'}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setEditId(item.id); setForm({ name: item.name, type_of_service_id: item.type_of_service_id }); setShowAdd(false) }} className="p-1 text-blue-500 hover:text-blue-700"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm('Remove?')) remove.mutate(item.id) }} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No order numbers</td></tr>}
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
