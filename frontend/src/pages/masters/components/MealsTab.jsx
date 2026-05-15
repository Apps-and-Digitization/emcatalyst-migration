import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Check, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi } from '../../../api/endpoints'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import useAuthStore from '../../../store/authStore'

export default function MealsTab() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Administrator' || user?.is_superuser
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCost, setNewCost] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCost, setEditCost] = useState('')

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['master-meals'],
    queryFn: () => masterApi.meals().then(r => r.data),
  })

  const create = useMutation({
    mutationFn: () => masterApi.createMeal({ name: newName, max_cost: newCost || undefined }),
    onSuccess: () => { qc.invalidateQueries(['master-meals']); setShowAdd(false); setNewName(''); setNewCost(''); toast.success('Meal added') },
    onError: () => toast.error('Error'),
  })

  const update = useMutation({
    mutationFn: ({ id, data }) => masterApi.updateMeal(id, data),
    onSuccess: () => { qc.invalidateQueries(['master-meals']); setEditId(null); toast.success('Updated') },
  })

  const remove = useMutation({
    mutationFn: (id) => masterApi.deleteMeal(id),
    onSuccess: () => { qc.invalidateQueries(['master-meals']); toast.success('Deleted') },
  })

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{items.length} meals</p>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Meal
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-4 p-3 bg-gray-50 rounded-lg">
          <input className="input flex-1" placeholder="Meal Name (e.g. Lunch/Dinner)" value={newName} onChange={e => setNewName(e.target.value)} autoFocus />
          <input type="number" className="input w-40" placeholder="Max Cost (₹)" value={newCost} onChange={e => setNewCost(e.target.value)} />
          <button className="btn-primary px-3" onClick={() => create.mutate()}><Check size={16} /></button>
          <button className="btn-secondary px-3" onClick={() => setShowAdd(false)}><X size={16} /></button>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Meal Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Max Cost Per Attendee (₹)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">
                    {editId === item.id ? <input className="input py-1 text-sm" value={editName} onChange={e => setEditName(e.target.value)} /> : item.name}
                  </td>
                  <td className="px-4 py-2.5">
                    {editId === item.id ? <input type="number" className="input py-1 text-sm w-32" value={editCost} onChange={e => setEditCost(e.target.value)} /> : (item.max_cost ? `₹${Number(item.max_cost).toLocaleString('en-IN')}` : '—')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {editId === item.id ? (
                      <div className="flex gap-2 justify-end">
                        <button className="text-emerald-600" onClick={() => update.mutate({ id: item.id, data: { name: editName, max_cost: editCost || undefined } })}><Check size={14} /></button>
                        <button className="text-gray-400" onClick={() => setEditId(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-3 justify-end">
                        <button className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1" onClick={() => { setEditId(item.id); setEditName(item.name); setEditCost(item.max_cost || '') }}><Edit2 size={12} /> Edit</button>
                        {isAdmin && <button className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1" onClick={() => { if (confirm('Delete?')) remove.mutate(item.id) }}><Trash2 size={12} /> Delete</button>}
                      </div>
                    )}
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
