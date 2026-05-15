import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Check, X, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi } from '../../../api/endpoints'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import useAuthStore from '../../../store/authStore'

export default function DivisionsTab() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Administrator' || user?.is_superuser
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    name: '', code: '', entity_id: '', profitcenter: '', costcenter: '', eventcodeprefix: ''
  })

  const { data: divisions = [], isLoading } = useQuery({
    queryKey: ['master-divisions'],
    queryFn: () => masterApi.divisions().then(r => r.data),
  })

  const { data: entities = [] } = useQuery({
    queryKey: ['master-entities'],
    queryFn: () => masterApi.entities().then(r => r.data),
  })

  const create = useMutation({
    mutationFn: () => masterApi.createDivision({
      name: form.name,
      code: form.code || undefined,
      entity_id: form.entity_id || undefined,
      profitcenter: form.profitcenter || undefined,
      costcenter: form.costcenter || undefined,
      eventcodeprefix: form.eventcodeprefix || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['master-divisions'])
      closeModal()
      toast.success('Division created')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error creating division'),
  })

  const update = useMutation({
    mutationFn: () => masterApi.updateDivision(editId, {
      name: form.name,
      code: form.code || undefined,
      entity_id: form.entity_id || '0',
      profitcenter: form.profitcenter || undefined,
      costcenter: form.costcenter || undefined,
      eventcodeprefix: form.eventcodeprefix || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['master-divisions'])
      closeModal()
      toast.success('Division updated')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error updating division'),
  })

  const remove = useMutation({
    mutationFn: (id) => masterApi.deleteDivision(id),
    onSuccess: () => {
      qc.invalidateQueries(['master-divisions'])
      toast.success('Division deleted')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Cannot delete division'),
  })

  const toggle = useMutation({
    mutationFn: (d) => masterApi.updateDivision(d.id, { is_active: !d.is_active }),
    onSuccess: () => qc.invalidateQueries(['master-divisions']),
  })

  const closeModal = () => {
    setShowModal(false)
    setEditId(null)
    setForm({ name: '', code: '', entity_id: '', profitcenter: '', costcenter: '', eventcodeprefix: '' })
  }

  const openAdd = () => {
    setEditId(null)
    setForm({ name: '', code: '', entity_id: '', profitcenter: '', costcenter: '', eventcodeprefix: '' })
    setShowModal(true)
  }

  const openEdit = (d) => {
    setEditId(d.id)
    setForm({
      name: d.name || '',
      code: d.code || '',
      entity_id: d.entity_id || '',
      profitcenter: d.profitcenter || '',
      costcenter: d.costcenter || '',
      eventcodeprefix: d.eventcodeprefix || '',
    })
    setShowModal(true)
  }

  const handleNameChange = (val) => {
    const newForm = { ...form, name: val }
    // Auto-fill prefix with first 3 uppercase chars if user hasn't manually set it
    if (!editId && val) {
      newForm.eventcodeprefix = val.replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase()
    }
    setForm(newForm)
  }

  const handlePrefixChange = (val) => {
    // Max 3 chars, uppercase only
    const cleaned = val.replace(/[^A-Z]/g, '').slice(0, 3)
    setForm({ ...form, eventcodeprefix: cleaned })
  }

  return (
    <div>
      <div className="flex gap-3 items-center mb-4">
        <p className="text-sm text-gray-500 flex-1">{divisions.length} divisions</p>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={openAdd}>
          <Plus size={14} /> Add Division
        </button>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Entity</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Profit Center</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Cost Center</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Prefix</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {divisions.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{d.name}</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.code || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.entity_name || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.profitcenter || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.costcenter || '—'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{d.eventcodeprefix || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${d.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {d.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right flex gap-2 justify-end">
                    <button className="text-xs text-blue-500 hover:text-blue-700" onClick={() => openEdit(d)}>
                      <Pencil size={14} />
                    </button>
                    <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => toggle.mutate(d)}>
                      {d.is_active ? 'Disable' : 'Enable'}
                    </button>
                    {isAdmin && <button className="text-xs text-red-400 hover:text-red-600" onClick={() => {
                      if (confirm('Delete this division?')) remove.mutate(d.id)
                    }}>
                      <Trash2 size={14} />
                    </button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h3 className="text-lg font-semibold mb-4">{editId ? 'Edit Division' : 'Add Division'}</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Name *</label>
                <input className="input w-full" value={form.name}
                  onChange={e => handleNameChange(e.target.value)} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Code</label>
                  <input className="input w-full" value={form.code}
                    onChange={e => setForm({ ...form, code: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Entity</label>
                  <select className="input w-full" value={form.entity_id}
                    onChange={e => setForm({ ...form, entity_id: e.target.value })}>
                    <option value="">— None —</option>
                    {entities.map(ent => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Profit Center</label>
                  <input className="input w-full" value={form.profitcenter}
                    onChange={e => setForm({ ...form, profitcenter: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Cost Center</label>
                  <input className="input w-full" value={form.costcenter}
                    onChange={e => setForm({ ...form, costcenter: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Event Code Prefix (max 3 chars, uppercase)</label>
                <input className="input w-32" value={form.eventcodeprefix}
                  onChange={e => handlePrefixChange(e.target.value.toUpperCase())}
                  maxLength={3} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button className="btn-primary" onClick={() => editId ? update.mutate() : create.mutate()}>
                {editId ? 'Save' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
