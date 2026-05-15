import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, X, Check, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi } from '../../../api/endpoints'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import useAuthStore from '../../../store/authStore'

export default function TherapeuticsTab() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Administrator' || user?.is_superuser
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['master-therapeutics'],
    queryFn: () => masterApi.therapeutics().then(r => r.data),
  })

  const create = useMutation({
    mutationFn: (name) => masterApi.createTherapeutic(name),
    onSuccess: () => { qc.invalidateQueries(['master-therapeutics']); setShowAdd(false); setNewName(''); toast.success('Added') },
    onError: () => toast.error('Error'),
  })

  const update = useMutation({
    mutationFn: ({ id, data }) => masterApi.updateTherapeutic(id, data),
    onSuccess: () => { qc.invalidateQueries(['master-therapeutics']); setEditId(null); toast.success('Updated') },
  })

  const remove = useMutation({
    mutationFn: (id) => masterApi.deleteTherapeutic(id),
    onSuccess: () => { qc.invalidateQueries(['master-therapeutics']); toast.success('Deleted') },
    onError: () => toast.error('Error deleting'),
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{items.length} items</p>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Therapeutic Area
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-4">
          <input className="input flex-1" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create.mutate(newName)} autoFocus />
          <button className="btn-primary px-3" onClick={() => create.mutate(newName)}><Check size={16} /></button>
          <button className="btn-secondary px-3" onClick={() => setShowAdd(false)}><X size={16} /></button>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">
                    {editId === item.id ? (
                      <div className="flex gap-2">
                        <input className="input py-1 text-sm" value={editName} onChange={e => setEditName(e.target.value)} onKeyDown={e => e.key === 'Enter' && update.mutate({ id: editId, data: { name: editName } })} autoFocus />
                        <button className="text-emerald-600" onClick={() => update.mutate({ id: editId, data: { name: editName } })}><Check size={14} /></button>
                        <button className="text-gray-400" onClick={() => setEditId(null)}><X size={14} /></button>
                      </div>
                    ) : item.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex gap-3 justify-end">
                      <button className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1" onClick={() => { setEditId(item.id); setEditName(item.name) }}><Edit2 size={12} /> Edit</button>
                      <button className="text-xs text-gray-400 hover:text-gray-700" onClick={() => update.mutate({ id: item.id, data: { is_active: !item.is_active } })}>{item.is_active ? 'Disable' : 'Enable'}</button>
                      {isAdmin && <button className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1" onClick={() => { if (confirm('Delete?')) remove.mutate(item.id) }}><Trash2 size={12} /> Delete</button>}
                    </div>
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
