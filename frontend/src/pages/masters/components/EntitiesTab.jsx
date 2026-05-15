import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Check, X, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi } from '../../../api/endpoints'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import useAuthStore from '../../../store/authStore'

export default function EntitiesTab() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Administrator' || user?.is_superuser
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ entity_code: '', name: '' })

  const { data: entities = [], isLoading } = useQuery({
    queryKey: ['master-entities'],
    queryFn: () => masterApi.entities().then(r => r.data),
  })

  const create = useMutation({
    mutationFn: () => masterApi.createEntity({ entity_code: form.entity_code, name: form.name }),
    onSuccess: () => {
      qc.invalidateQueries(['master-entities'])
      setShowAdd(false)
      setForm({ entity_code: '', name: '' })
      toast.success('Entity created')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error creating entity'),
  })

  const update = useMutation({
    mutationFn: () => masterApi.updateEntity(editId, { entity_code: form.entity_code, name: form.name }),
    onSuccess: () => {
      qc.invalidateQueries(['master-entities'])
      setEditId(null)
      setForm({ entity_code: '', name: '' })
      toast.success('Entity updated')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error updating entity'),
  })

  const remove = useMutation({
    mutationFn: (id) => masterApi.deleteEntity(id),
    onSuccess: () => {
      qc.invalidateQueries(['master-entities'])
      toast.success('Entity deleted')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Cannot delete entity'),
  })

  const toggle = useMutation({
    mutationFn: (e) => masterApi.updateEntity(e.id, { is_active: !e.is_active }),
    onSuccess: () => qc.invalidateQueries(['master-entities']),
  })

  const startEdit = (e) => {
    setEditId(e.id)
    setForm({ entity_code: e.entity_code, name: e.name })
    setShowAdd(false)
  }

  const cancelEdit = () => {
    setEditId(null)
    setForm({ entity_code: '', name: '' })
  }

  return (
    <div>
      <div className="flex gap-3 items-center mb-4">
        <p className="text-sm text-gray-500 flex-1">{entities.length} entities</p>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => { setShowAdd(true); setEditId(null); setForm({ entity_code: '', name: '' }) }}>
          <Plus size={14} /> Add Entity
        </button>
      </div>

      {(showAdd || editId) && (
        <div className="flex gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
          <input className="input w-40" placeholder="Entity Code" value={form.entity_code}
            onChange={e => setForm({ ...form, entity_code: e.target.value })} autoFocus />
          <input className="input flex-1" placeholder="Entity Name" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })} />
          <button className="btn-primary px-3" onClick={() => editId ? update.mutate() : create.mutate()}>
            <Check size={16} />
          </button>
          <button className="btn-secondary px-3" onClick={() => { setShowAdd(false); cancelEdit() }}>
            <X size={16} />
          </button>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Entity Code</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {entities.map(e => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{e.entity_code}</td>
                  <td className="px-4 py-2.5">{e.name}</td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${e.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {e.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right flex gap-2 justify-end">
                    <button className="text-xs text-blue-500 hover:text-blue-700" onClick={() => startEdit(e)}>
                      <Pencil size={14} />
                    </button>
                    <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => toggle.mutate(e)}>
                      {e.is_active ? 'Disable' : 'Enable'}
                    </button>
                    {isAdmin && <button className="text-xs text-red-400 hover:text-red-600" onClick={() => {
                      if (confirm('Delete this entity?')) remove.mutate(e.id)
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
    </div>
  )
}
