import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi } from '../../api/endpoints'
import api from '../../api/client'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Pagination from '../../components/ui/Pagination'
import usePagination from '../../hooks/usePagination'
import useAccessStore from '../../store/accessStore'

const QUARTER_LABELS = {
  1: 'Q1 (Apr–Jun)',
  2: 'Q2 (Jul–Sep)',
  3: 'Q3 (Oct–Dec)',
  4: 'Q4 (Jan–Mar)',
}

// Financial year: if current month >= April, FY starts this year, else last year
const getCurrentFY = () => {
  const now = new Date()
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1
}

const fmtFY = (year) => `FY ${year}–${String(year + 1).slice(2)}`

export default function BrsBudget() {
  const qc = useQueryClient()
  const { accessiblePages } = useAccessStore()
  const canAdd = accessiblePages.includes('budget_brs_add')
  const canEdit = accessiblePages.includes('budget_brs_edit')
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [auditModal, setAuditModal] = useState(null)
  const [form, setForm] = useState({ division_id: '', quarter: '', year: getCurrentFY(), allocated_budget: '' })

  const { data: divisions = [] } = useQuery({
    queryKey: ['master-divisions'],
    queryFn: () => masterApi.divisions().then(r => r.data),
  })

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['brs-budgets'],
    queryFn: () => api.get('/budget/brs').then(r => r.data),
  })

  const { data: auditTrail = [] } = useQuery({
    queryKey: ['brs-budget-audit', auditModal],
    queryFn: () => api.get(`/budget/brs/${auditModal}/audit-trail`).then(r => r.data),
    enabled: !!auditModal,
  })

  const { paginatedItems, page, pageSize, total, setPage, setPageSize } = usePagination(items, 20)

  const create = useMutation({
    mutationFn: () => api.post('/budget/brs', null, { params: form }),
    onSuccess: () => { qc.invalidateQueries(['brs-budgets']); setShowAdd(false); setForm({ division_id: '', quarter: '', year: getCurrentFY(), allocated_budget: '' }); toast.success('Budget created') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const update = useMutation({
    mutationFn: () => api.put(`/budget/brs/${editId}`, null, { params: { allocated_budget: form.allocated_budget } }),
    onSuccess: () => { qc.invalidateQueries(['brs-budgets']); setEditId(null); toast.success('Budget updated') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/budget/brs/${id}`),
    onSuccess: () => { qc.invalidateQueries(['brs-budgets']); toast.success('Deleted') },
  })

  const fmtCurrency = (v) => v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—'

  return (
    <div className="p-8">
      <PageHeader title="BRS Budget" subtitle="Division-wise, quarter-wise budget allocation for BRS (Financial Year)"
        actions={canAdd && <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2"><Plus size={16} />Add</button>}
      />

      {(showAdd || editId) && (
        <div className="bg-white rounded-lg border p-4 mb-4 flex items-end gap-3 flex-wrap">
          {!editId && (
            <>
              <div className="w-48">
                <label className="text-xs font-medium text-gray-600 block mb-1">Division</label>
                <select className="input w-full" value={form.division_id} onChange={e => setForm(f => ({ ...f, division_id: e.target.value }))}>
                  <option value="">Select...</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-gray-600 block mb-1">Quarter</label>
                <select className="input w-full" value={form.quarter} onChange={e => setForm(f => ({ ...f, quarter: e.target.value }))}>
                  <option value="">Select...</option>
                  <option value="1">Q1 (Apr–Jun)</option>
                  <option value="2">Q2 (Jul–Sep)</option>
                  <option value="3">Q3 (Oct–Dec)</option>
                  <option value="4">Q4 (Jan–Mar)</option>
                </select>
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-gray-600 block mb-1">Year</label>
                <input type="number" className="input w-full" placeholder="e.g. 2026" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
              </div>
            </>
          )}
          <div className="w-40">
            <label className="text-xs font-medium text-gray-600 block mb-1">Allocated Budget (₹)</label>
            <input type="number" className="input w-full" value={form.allocated_budget} onChange={e => setForm(f => ({ ...f, allocated_budget: e.target.value }))} />
          </div>
          <button className="btn-primary" onClick={() => editId ? update.mutate() : create.mutate()}>{editId ? 'Update' : 'Create'}</button>
          <button className="btn-secondary" onClick={() => { setShowAdd(false); setEditId(null) }}>Cancel</button>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Division</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Quarter</th>
                <th className="px-4 py-2 text-left font-medium text-gray-600">Year</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Allocated</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Utilized</th>
                <th className="px-4 py-2 text-right font-medium text-gray-600">Available</th>
                <th className="px-4 py-2 text-center font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => (
                <tr key={item.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium">{item.division_name}</td>
                  <td className="px-4 py-2">{QUARTER_LABELS[item.quarter] || `Q${item.quarter}`}</td>
                  <td className="px-4 py-2">{item.year}</td>
                  <td className="px-4 py-2 text-right font-mono">{fmtCurrency(item.allocated_budget)}</td>
                  <td className="px-4 py-2 text-right font-mono text-amber-600">{fmtCurrency(item.utilized_budget)}</td>
                  <td className="px-4 py-2 text-right font-mono text-emerald-600">{fmtCurrency(item.available_budget)}</td>
                  <td className="px-4 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setAuditModal(item.id)} className="p-1 text-gray-400 hover:text-gray-700" title="Audit Trail"><History size={14} /></button>
                      {canEdit && <button onClick={() => { setEditId(item.id); setForm({ ...form, allocated_budget: item.allocated_budget }); setShowAdd(false) }} className="p-1 text-blue-500 hover:text-blue-700"><Pencil size={14} /></button>}
                      {canEdit && <button onClick={() => { if (confirm('Delete?')) remove.mutate(item.id) }} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedItems.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No BRS budgets configured</td></tr>}
            </tbody>
          </table>
          {total > 0 && <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />}
        </div>
      )}

      {/* Audit Trail Modal */}
      {auditModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setAuditModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-800">BRS Budget Audit Trail</h3>
              <button className="text-gray-400 hover:text-gray-600 text-xl" onClick={() => setAuditModal(null)}>×</button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[60vh]">
              {auditTrail.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No audit trail entries</p>
              ) : (
                <div className="space-y-3">
                  {auditTrail.map(entry => (
                    <div key={entry.id} className="flex gap-3 items-start border-l-2 border-gray-200 pl-3 py-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            entry.action === 'Created' ? 'bg-emerald-100 text-emerald-700' :
                            entry.action === 'Updated' ? 'bg-blue-100 text-blue-700' :
                            entry.action === 'Deducted' ? 'bg-amber-100 text-amber-700' :
                            entry.action === 'Reversed' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {entry.action}
                          </span>
                          {entry.amount != null && (
                            <span className="text-xs font-medium text-gray-700">{fmtCurrency(entry.amount)}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{entry.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>{entry.performed_by}</span>
                          <span>{entry.created_at ? new Date(entry.created_at).toLocaleString('en-IN') : ''}</span>
                          {entry.brs_code && <span className="text-blue-500">{entry.brs_code}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
