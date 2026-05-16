import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { vendorApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'

export default function VendorWithholdingTax() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ tax_code: '', name: '', section: '', rate: '', with_t: '' })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['vendor-withholding-taxes'],
    queryFn: () => vendorApi.withholdingTaxes().then(r => r.data),
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(items, 20)

  const create = useMutation({
    mutationFn: () => vendorApi.createWithholdingTax(form),
    onSuccess: () => { qc.invalidateQueries(['vendor-withholding-taxes']); setShowForm(false); resetForm(); toast.success('Created') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const update = useMutation({
    mutationFn: () => vendorApi.updateWithholdingTax(editId, form),
    onSuccess: () => { qc.invalidateQueries(['vendor-withholding-taxes']); setShowForm(false); setEditId(null); resetForm(); toast.success('Updated') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const remove = useMutation({
    mutationFn: (id) => vendorApi.deleteWithholdingTax(id),
    onSuccess: () => { qc.invalidateQueries(['vendor-withholding-taxes']); toast.success('Deleted') },
  })

  const resetForm = () => setForm({ tax_code: '', name: '', section: '', rate: '', with_t: '' })

  return (
    <div className="p-8">
      <PageHeader title="Withholding Tax" subtitle="Manage withholding tax master entries"
        actions={<button onClick={() => { resetForm(); setEditId(null); setShowForm(true) }} className="btn-primary flex items-center gap-2"><Plus size={16} />Add</button>}
      />

      {showForm && (
        <div className="bg-white rounded-lg border p-4 mb-4">
          <div className="grid grid-cols-5 gap-3">
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Tax Code *</label>
              <input className="input w-full" value={form.tax_code} onChange={e => setForm(f => ({ ...f, tax_code: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Name *</label>
              <input className="input w-full" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Section</label>
              <input className="input w-full" value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">Rate</label>
              <input className="input w-full" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} /></div>
            <div><label className="text-xs font-medium text-gray-600 block mb-1">WithT</label>
              <input className="input w-full" value={form.with_t} onChange={e => setForm(f => ({ ...f, with_t: e.target.value }))} /></div>
          </div>
          <div className="flex gap-3 justify-end mt-3">
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</button>
            <button className="btn-primary" onClick={() => editId ? update.mutate() : create.mutate()}>{editId ? 'Update' : 'Create'}</button>
          </div>
        </div>
      )}

      {isLoading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Tax Code</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Section</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Rate</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">WithT</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-gray-800">{item.tax_code}</td>
                  <td className="px-4 py-2 font-medium text-gray-800">{item.name}</td>
                  <td className="px-4 py-2 text-gray-600">{item.section}</td>
                  <td className="px-4 py-2 text-gray-600">{item.rate}</td>
                  <td className="px-4 py-2 text-gray-600">{item.with_t}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => { setForm({ tax_code: item.tax_code, name: item.name, section: item.section || '', rate: item.rate || '', with_t: item.with_t || '' }); setEditId(item.id); setShowForm(true) }} className="p-1 text-blue-500 hover:text-blue-700"><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm('Delete?')) remove.mutate(item.id) }} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No entries</td></tr>}
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
