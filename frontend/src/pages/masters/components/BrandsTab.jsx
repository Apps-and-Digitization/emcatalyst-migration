import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Check, X, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi } from '../../../api/endpoints'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'

export default function BrandsTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState(null)
  const [formName, setFormName] = useState('')
  const [formDivisions, setFormDivisions] = useState([])

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['master-brands', search],
    queryFn: () => masterApi.brands(search || undefined).then(r => r.data),
  })

  const { data: divisions = [] } = useQuery({
    queryKey: ['master-divisions'],
    queryFn: () => masterApi.divisions().then(r => r.data),
  })

  const create = useMutation({
    mutationFn: () => masterApi.createBrand({
      name: formName,
      division_ids: formDivisions.join(',') || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries(['master-brands']); closeForm(); toast.success('Brand added') },
    onError: () => toast.error('Error adding brand'),
  })

  const update = useMutation({
    mutationFn: () => masterApi.updateBrand(editId, {
      name: formName,
      division_ids: formDivisions.join(',') || '',
    }),
    onSuccess: () => { qc.invalidateQueries(['master-brands']); closeForm(); toast.success('Brand updated') },
    onError: () => toast.error('Error updating brand'),
  })

  const toggle = useMutation({
    mutationFn: (b) => masterApi.updateBrand(b.id, { is_active: !b.is_active }),
    onSuccess: () => qc.invalidateQueries(['master-brands']),
  })

  const closeForm = () => {
    setShowForm(false)
    setEditId(null)
    setFormName('')
    setFormDivisions([])
  }

  const openAdd = () => {
    setEditId(null)
    setFormName('')
    setFormDivisions([])
    setShowForm(true)
  }

  const openEdit = (b) => {
    setEditId(b.id)
    setFormName(b.name)
    setFormDivisions(b.divisions ? b.divisions.map(d => d.id) : [])
    setShowForm(true)
  }

  const handleDivisionToggle = (divId) => {
    setFormDivisions(prev =>
      prev.includes(divId) ? prev.filter(id => id !== divId) : [...prev, divId]
    )
  }

  return (
    <div>
      <div className="flex gap-3 items-center mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input className="input pl-9" placeholder="Search brands…" value={search}
            onChange={e => setSearch(e.target.value)} />
        </div>
        <p className="text-sm text-gray-500">{brands.length} brands</p>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={openAdd}>
          <Plus size={14} /> Add Brand
        </button>
      </div>

      {showForm && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
          <div className="flex gap-2">
            <input className="input flex-1" placeholder="Brand name" value={formName}
              onChange={e => setFormName(e.target.value)} autoFocus />
            <button className="btn-primary px-3" onClick={() => editId ? update.mutate() : create.mutate()} disabled={!formName.trim()}>
              <Check size={16} />
            </button>
            <button className="btn-secondary px-3" onClick={closeForm}>
              <X size={16} />
            </button>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Divisions</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {divisions.map(d => (
                <label key={d.id} className="flex items-center gap-1.5 text-sm cursor-pointer bg-white border rounded px-2 py-1 hover:bg-blue-50">
                  <input type="checkbox" className="rounded border-gray-300"
                    checked={formDivisions.includes(d.id)}
                    onChange={() => handleDivisionToggle(d.id)} />
                  {d.name}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Brand Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Divisions</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {brands.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium">{b.name}</td>
                  <td className="px-4 py-2.5">
                    {b.divisions && b.divisions.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {b.divisions.map(d => (
                          <span key={d.id} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {d.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {b.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right flex gap-2 justify-end">
                    <button className="text-xs text-blue-500 hover:text-blue-700" onClick={() => openEdit(b)}>
                      <Pencil size={14} />
                    </button>
                    <button className="text-xs text-gray-400 hover:text-gray-700"
                      onClick={() => toggle.mutate(b)}>
                      {b.is_active ? 'Disable' : 'Enable'}
                    </button>
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
