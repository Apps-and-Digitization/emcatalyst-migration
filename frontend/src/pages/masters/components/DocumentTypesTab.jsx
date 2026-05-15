import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Check, X, Edit2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi } from '../../../api/endpoints'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import useAuthStore from '../../../store/authStore'

const EVENT_TYPES = ['CME / RTM', 'Advisory Board', 'Corporate Sponsorship']

export default function DocumentTypesTab() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Administrator' || user?.is_superuser
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCode, setNewCode] = useState('')
  const [newEventType, setNewEventType] = useState('')
  const [newStage, setNewStage] = useState('pre')
  const [newMandatory, setNewMandatory] = useState(false)

  // Edit state
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['master-document-types-full'],
    queryFn: () => masterApi.documentTypesFull().then(r => r.data),
  })

  const create = useMutation({
    mutationFn: () => masterApi.createDocumentType({
      name: newName, code: newCode || undefined,
      event_type_code: newEventType || undefined,
      stage: newStage, is_mandatory: newMandatory
    }),
    onSuccess: () => {
      qc.invalidateQueries(['master-document-types-full'])
      setShowAdd(false)
      setNewName(''); setNewCode(''); setNewEventType(''); setNewStage('pre'); setNewMandatory(false)
      toast.success('Document type added')
    },
    onError: () => toast.error('Error adding document type'),
  })

  const update = useMutation({
    mutationFn: ({ id, data }) => masterApi.updateDocumentType(id, data),
    onSuccess: () => {
      qc.invalidateQueries(['master-document-types-full'])
      setEditId(null)
      toast.success('Updated')
    },
    onError: () => toast.error('Error updating'),
  })

  const remove = useMutation({
    mutationFn: (id) => masterApi.deleteDocumentType(id),
    onSuccess: () => { qc.invalidateQueries(['master-document-types-full']); toast.success('Deleted') },
    onError: () => toast.error('Error deleting'),
  })

  const startEdit = (item) => {
    setEditId(item.id)
    setEditForm({
      name: item.name || '',
      event_type_code: item.event_type_code || '',
      stage: item.stage || 'pre',
      is_mandatory: item.is_mandatory || false,
    })
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{items.length} document types</p>
        <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Document Type
        </button>
      </div>

      {showAdd && (
        <div className="flex gap-2 mb-4 p-3 bg-gray-50 rounded-lg flex-wrap">
          <input className="input w-36" placeholder="Code (e.g. CONSENT)" value={newCode}
            onChange={e => setNewCode(e.target.value)} autoFocus />
          <input className="input flex-1" placeholder="Name" value={newName}
            onChange={e => setNewName(e.target.value)} />
          <select className="input w-44" value={newEventType} onChange={e => setNewEventType(e.target.value)}>
            <option value="">All Event Types</option>
            {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="input w-28" value={newStage} onChange={e => setNewStage(e.target.value)}>
            <option value="pre">Pre-Event</option>
            <option value="post">Post-Event</option>
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={newMandatory} onChange={e => setNewMandatory(e.target.checked)} />
            Mandatory
          </label>
          <button className="btn-primary px-3" onClick={() => create.mutate()}><Check size={16} /></button>
          <button className="btn-secondary px-3" onClick={() => setShowAdd(false)}><X size={16} /></button>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Code</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Event Type</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Stage</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Mandatory</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-[var(--color-primary)]">{item.code || '—'}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {editId === item.id ? (
                      <input className="input py-1 text-sm w-full" value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
                    ) : item.name}
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {editId === item.id ? (
                      <select className="input py-1 text-xs" value={editForm.event_type_code} onChange={e => setEditForm(f => ({...f, event_type_code: e.target.value}))}>
                        <option value="">All</option>
                        {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    ) : (item.event_type_code || 'All')}
                  </td>
                  <td className="px-4 py-2.5">
                    {editId === item.id ? (
                      <select className="input py-1 text-xs" value={editForm.stage} onChange={e => setEditForm(f => ({...f, stage: e.target.value}))}>
                        <option value="pre">Pre-Event</option>
                        <option value="post">Post-Event</option>
                      </select>
                    ) : (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.stage === 'post' ? 'bg-purple-50 text-purple-700' : 'bg-[var(--color-primary-50)] text-[var(--color-primary)]'}`}>
                        {item.stage === 'post' ? 'Post-Event' : 'Pre-Event'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {editId === item.id ? (
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="checkbox" checked={editForm.is_mandatory} onChange={e => setEditForm(f => ({...f, is_mandatory: e.target.checked}))} />
                        <span className="text-xs">Required</span>
                      </label>
                    ) : (
                      item.is_mandatory ? <span className="text-xs text-red-600 font-medium">Required</span> : <span className="text-xs text-gray-400">Optional</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {editId === item.id ? (
                      <div className="flex gap-2 justify-end">
                        <button className="text-emerald-600 hover:text-emerald-800" onClick={() => {
                          const data = { ...editForm }
                          if (!data.event_type_code) data.event_type_code = ''
                          update.mutate({ id: item.id, data })
                        }}><Check size={14} /></button>
                        <button className="text-gray-400 hover:text-gray-600" onClick={() => setEditId(null)}><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-3 justify-end">
                        <button className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1" onClick={() => startEdit(item)}>
                          <Edit2 size={12} /> Edit
                        </button>
                        {isAdmin && <button className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1" onClick={() => { if (confirm('Delete this document type?')) remove.mutate(item.id) }}>
                          <Trash2 size={12} /> Delete
                        </button>}
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
