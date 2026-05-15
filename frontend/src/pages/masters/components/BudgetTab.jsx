import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, X, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi } from '../../../api/endpoints'
import useAuthStore from '../../../store/authStore'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

const BUDGET_TYPES = ['Sponsorship/Event Cost', 'Speaker Cost']

function fmtMonth(val) {
  if (!val) return '—'
  const [y, m] = val.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m) - 1]} ${y}`
}

function fmtDateTime(val) {
  if (!val) return '—'
  const d = new Date(val)
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const ACTION_COLORS = {
  Created: 'bg-emerald-100 text-emerald-700',
  Updated: 'bg-blue-100 text-blue-700',
  Deducted: 'bg-amber-100 text-amber-700',
  Reversed: 'bg-purple-100 text-purple-700',
}

export default function BudgetTab() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Administrator' || user?.is_superuser

  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState({ division_id: '', budget_type: '', budget_month: '', allocated_budget: '' })
  const [auditBudgetId, setAuditBudgetId] = useState(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['master-budgets'],
    queryFn: () => masterApi.budgets().then(r => r.data),
  })

  const { data: divisions = [] } = useQuery({
    queryKey: ['master-divisions'],
    queryFn: () => masterApi.divisions().then(r => r.data),
  })

  const { data: auditTrail = [], isLoading: auditLoading } = useQuery({
    queryKey: ['budget-audit-trail', auditBudgetId],
    queryFn: () => masterApi.budgetAuditTrail(auditBudgetId).then(r => r.data),
    enabled: !!auditBudgetId,
  })

  const create = useMutation({
    mutationFn: () => masterApi.createBudget({
      division_id: parseInt(form.division_id),
      budget_type: form.budget_type,
      budget_month: form.budget_month,
      allocated_budget: parseFloat(form.allocated_budget),
    }),
    onSuccess: () => { qc.invalidateQueries(['master-budgets']); closeForm(); toast.success('Budget added') },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Error creating budget'),
  })

  const update = useMutation({
    mutationFn: () => masterApi.updateBudget(editItem.id, {
      division_id: parseInt(form.division_id),
      budget_type: form.budget_type,
      budget_month: form.budget_month,
      allocated_budget: parseFloat(form.allocated_budget),
    }),
    onSuccess: () => { qc.invalidateQueries(['master-budgets']); closeForm(); toast.success('Budget updated') },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Error updating budget'),
  })

  const remove = useMutation({
    mutationFn: (id) => masterApi.deleteBudget(id),
    onSuccess: () => { qc.invalidateQueries(['master-budgets']); toast.success('Budget deleted') },
    onError: (e) => toast.error(e?.response?.data?.detail || 'Error deleting budget'),
  })

  const toggleActive = useMutation({
    mutationFn: (item) => masterApi.updateBudget(item.id, { is_active: !item.is_active }),
    onSuccess: () => qc.invalidateQueries(['master-budgets']),
  })

  function openAdd() {
    setEditItem(null)
    setForm({ division_id: '', budget_type: '', budget_month: '', allocated_budget: '' })
    setShowForm(true)
  }

  function openEdit(item) {
    setEditItem(item)
    setForm({
      division_id: String(item.division_id),
      budget_type: item.budget_type,
      budget_month: item.budget_month || '',
      allocated_budget: String(item.allocated_budget),
    })
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditItem(null)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{items.length} budget entries</p>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={openAdd}>
          <Plus size={14} /> Add Budget
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium text-sm">{editItem ? 'Edit Budget' : 'Add Budget'}</h3>
            <button type="button" className="text-gray-400 hover:text-gray-600" onClick={closeForm}><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Division *</label>
              <select className="input w-full" value={form.division_id} onChange={e => setForm({ ...form, division_id: e.target.value })} required>
                <option value="">Select Division</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Budget Type *</label>
              <select className="input w-full" value={form.budget_type} onChange={e => setForm({ ...form, budget_type: e.target.value })} required>
                <option value="">Select Type</option>
                {BUDGET_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Month & Year *</label>
              <input type="month" className="input w-full" value={form.budget_month} onChange={e => setForm({ ...form, budget_month: e.target.value })} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Allocated Budget (₹) *</label>
              <input type="number" className="input w-full" value={form.allocated_budget} onChange={e => setForm({ ...form, allocated_budget: e.target.value })} required min={0} step="0.01" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button className="btn-primary text-sm" onClick={() => editItem ? update.mutate() : create.mutate()}
              disabled={!form.division_id || !form.budget_type || !form.budget_month || !form.allocated_budget}>
              {editItem ? 'Update' : 'Add'}
            </button>
            <button className="btn-secondary text-sm" onClick={closeForm}>Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Division</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Budget Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Month/Year</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Allocated (₹)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Utilized (₹)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Remaining (₹)</th>
                <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{item.division_name || '—'}</td>
                  <td className="px-4 py-2.5">{item.budget_type}</td>
                  <td className="px-4 py-2.5">{fmtMonth(item.budget_month)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">₹{Number(item.allocated_budget).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right text-amber-600">₹{Number(item.utilized_budget || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-emerald-600">₹{Number(item.remaining_budget || 0).toLocaleString('en-IN')}</td>
                  <td className="px-4 py-2.5 text-center">
                    <button onClick={() => toggleActive.mutate(item)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${item.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-2 justify-end">
                      <button className="text-gray-500 hover:text-gray-700" title="View History" onClick={() => setAuditBudgetId(item.id)}><History size={14} /></button>
                      <button className="text-blue-500 hover:text-blue-700" onClick={() => openEdit(item)}><Edit2 size={14} /></button>
                      {isAdmin && <button className="text-red-400 hover:text-red-600" onClick={() => { if (confirm('Delete this budget?')) remove.mutate(item.id) }}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No budget entries found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Audit Trail Modal */}
      {auditBudgetId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setAuditBudgetId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-5 py-4 border-b">
              <h3 className="font-semibold text-gray-800">Budget Audit Trail</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setAuditBudgetId(null)}><X size={18} /></button>
            </div>
            <div className="px-5 py-4 overflow-y-auto max-h-[60vh]">
              {auditLoading ? <LoadingSpinner /> : auditTrail.length === 0 ? (
                <p className="text-center text-gray-400 py-8">No audit trail entries</p>
              ) : (
                <div className="space-y-3">
                  {auditTrail.map(entry => (
                    <div key={entry.id} className="flex gap-3 items-start border-l-2 border-gray-200 pl-3 py-1">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[entry.action] || 'bg-gray-100 text-gray-600'}`}>
                            {entry.action}
                          </span>
                          {entry.amount != null && (
                            <span className="text-xs font-medium text-gray-700">₹{Number(entry.amount).toLocaleString('en-IN')}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{entry.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span>{entry.performed_by}</span>
                          <span>{fmtDateTime(entry.created_at)}</span>
                          {entry.event_code && <span className="text-blue-500">{entry.event_code}</span>}
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
