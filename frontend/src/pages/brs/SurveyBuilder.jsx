import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  Plus, Trash2, GripVertical, Edit3, Save, X, ChevronDown,
  ChevronUp, List, CheckSquare, AlignLeft, ToggleLeft, ArrowLeft, FileText, Upload, Download, Search, BarChart3
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { brsApi, accessApi } from '../../api/endpoints'
import api from '../../api/client'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
import useAuthStore from '../../store/authStore'
import LoadingSpinner from '../../components/ui/LoadingSpinner'

const QUESTION_TYPES = [
  { value: 'free_text', label: 'Free Text', icon: AlignLeft },
  { value: 'single_select', label: 'Single Select', icon: ToggleLeft },
  { value: 'multi_select', label: 'Multi Select', icon: CheckSquare },
  { value: 'fill_in_blanks', label: 'Fill in the Blanks', icon: FileText },
]

function QuestionTypeIcon({ type, size = 14 }) {
  const t = QUESTION_TYPES.find(q => q.value === type)
  if (!t) return null
  const Icon = t.icon
  return <Icon size={size} />
}

function QuestionCard({ q, surveyId, onRefresh }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    question_text: q.question_text,
    question_type: q.question_type,
    is_required: q.is_required,
    min_duration_seconds: q.min_duration_seconds || 0,
    video_url: q.video_url || '',
    options_text: (q.options || []).join('\n'),
  })
  const qc = useQueryClient()

  const updateMut = useMutation({
    mutationFn: () => brsApi.updateQuestion(surveyId, q.id, {
      question_text: form.question_text,
      question_type: form.question_type,
      is_required: form.is_required,
      min_duration_seconds: 0,
      video_url: null,
      options: ['single_select', 'multi_select'].includes(form.question_type)
        ? form.options_text.split('\n').map(s => s.trim()).filter(Boolean)
        : [],
    }),
    onSuccess: () => { toast.success('Question updated'); setEditing(false); onRefresh() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Update failed'),
  })

  const deleteMut = useMutation({
    mutationFn: () => brsApi.deleteQuestion(surveyId, q.id),
    onSuccess: () => { toast.success('Question deleted'); onRefresh() },
    onError: (e) => toast.error(e.response?.data?.detail || 'Delete failed'),
  })

  const hasOptions = ['single_select', 'multi_select'].includes(form.question_type)

  return (
    <div className="border border-gray-200 rounded-lg bg-white">
      <div className="flex items-start gap-3 p-4">
        <GripVertical size={16} className="text-gray-300 mt-1 shrink-0 cursor-grab" />
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-3">
              <textarea
                className="input text-sm"
                rows={2}
                value={form.question_text}
                onChange={e => setForm(f => ({ ...f, question_text: e.target.value }))}
                placeholder="Question text…"
              />
              {form.question_type === 'fill_in_blanks' && (
                <p className="text-xs text-gray-500 bg-[var(--color-primary-50)] p-2 rounded">
                  Use ___ (three underscores) to mark blanks. Example: "I prescribe ___ mg of drug X for ___ days"
                </p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Question Type</label>
                  <select className="input text-sm" value={form.question_type}
                    onChange={e => setForm(f => ({ ...f, question_type: e.target.value }))}>
                    {QUESTION_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.is_required}
                      onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} />
                    Required
                  </label>
                </div>
              </div>
              {hasOptions && (
                <div>
                  <label className="label text-xs">Options (one per line)</label>
                  <textarea className="input text-sm font-mono" rows={4}
                    value={form.options_text}
                    onChange={e => setForm(f => ({ ...f, options_text: e.target.value }))}
                    placeholder="Option 1&#10;Option 2&#10;Option 3" />
                </div>
              )}
              <div className="flex gap-2">
                <button className="btn-primary py-1 px-3 text-xs flex items-center gap-1"
                  onClick={() => updateMut.mutate()} disabled={updateMut.isPending}>
                  <Save size={12} /> Save
                </button>
                <button className="btn-secondary py-1 px-3 text-xs flex items-center gap-1"
                  onClick={() => setEditing(false)}>
                  <X size={12} /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded flex items-center gap-1">
                  <QuestionTypeIcon type={q.question_type} />
                  {QUESTION_TYPES.find(t => t.value === q.question_type)?.label || q.question_type}
                </span>
                {q.is_required && <span className="text-xs text-red-500">Required</span>}
              </div>
              <p className="text-sm font-medium text-gray-800">{q.question_text}</p>
              {q.options?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {q.options.map((o, i) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{o}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {!editing && (
          <div className="flex gap-1 shrink-0">
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-[var(--color-primary)]"
              onClick={() => setEditing(true)}><Edit3 size={14} /></button>
            <button className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500"
              onClick={() => { if (confirm('Delete this question?')) deleteMut.mutate() }}>
              <Trash2 size={14} /></button>
          </div>
        )}
      </div>
    </div>
  )
}

function SurveyDoctorManager({ surveyId, mappedDoctors, onRefresh }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [allDoctors, setAllDoctors] = useState([])
  const [totalDoctors, setTotalDoctors] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState([])
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)

  const PAGE_SIZE = 20
  const mappedIds = new Set(mappedDoctors.map(d => d.hcp_doctor_id))

  // Fetch doctors with pagination
  const fetchDoctors = async (q, pg) => {
    setLoading(true)
    try {
      const res = await api.get('/master/hcp-doctors-all', { params: { q: q || undefined, skip: (pg - 1) * PAGE_SIZE, limit: PAGE_SIZE } })
      setAllDoctors(res.data.items || [])
      setTotalDoctors(res.data.total || 0)
    } catch (e) { setAllDoctors([]) }
    setLoading(false)
  }

  useEffect(() => { fetchDoctors('', 1) }, [])

  const handleSearch = (q) => {
    setSearch(q)
    setPage(1)
    fetchDoctors(q, 1)
  }

  const handlePageChange = (pg) => {
    setPage(pg)
    fetchDoctors(search, pg)
  }

  const toggleSelect = (doc) => {
    setSelected(prev => prev.find(d => d.id === doc.id) ? prev.filter(d => d.id !== doc.id) : [...prev, doc])
  }

  const selectAll = () => {
    const unMapped = allDoctors.filter(d => !mappedIds.has(d.id))
    setSelected(prev => {
      const existingIds = new Set(prev.map(d => d.id))
      const newOnes = unMapped.filter(d => !existingIds.has(d.id))
      return [...prev, ...newOnes]
    })
  }

  const addSelected = async () => {
    if (!selected.length) return
    try {
      await api.post(`/brs/surveys/${surveyId}/doctors`, selected.map(d => d.id))
      toast.success(`Added ${selected.length} doctor(s)`)
      setSelected([])
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.detail || 'Error') }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    try {
      let uids = []
      if (importFile.name.endsWith('.xlsx') || importFile.name.endsWith('.xls')) {
        // For Excel files, send to backend to parse
        const formData = new FormData()
        formData.append('file', importFile)
        formData.append('survey_id', surveyId)
        const res = await api.post(`/brs/bulk/survey-doctors-import`, formData, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success(`Added ${res.data.added} doctor(s).${res.data.not_found?.length ? ` Not found: ${res.data.not_found.length}` : ''}`)
        setImportFile(null)
        onRefresh()
        setImporting(false)
        return
      }
      // For CSV/TXT files, parse on frontend
      const text = await importFile.text()
      uids = text.split(/[\n,\r]/).map(s => s.trim()).filter(s => s && s.toLowerCase() !== 'doctor_uid')
      if (!uids.length) { toast.error('No UIDs found in file'); setImporting(false); return }
      const res = await api.post(`/brs/surveys/${surveyId}/doctors/import`, uids)
      toast.success(`Added ${res.data.added} doctor(s).${res.data.not_found?.length ? ` Not found: ${res.data.not_found.length}` : ''}`)
      setImportFile(null)
      onRefresh()
    } catch (e) { toast.error(e.response?.data?.detail || 'Import failed') }
    setImporting(false)
  }

  const totalPages = Math.ceil(totalDoctors / PAGE_SIZE)

  return (
    <div className="space-y-3 border-t pt-3">
      {/* Actions bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-2.5 top-2 text-gray-400" />
          <input
            className="input pl-8 text-sm"
            placeholder="Search by name, UID, city, speciality..."
            value={search}
            onChange={e => handleSearch(e.target.value)}
          />
        </div>
        {selected.length > 0 && (
          <button className="btn-primary text-xs py-1.5 px-3" onClick={addSelected}>
            Add {selected.length} Selected
          </button>
        )}
        <div className="flex items-center gap-2">
          <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1">
            <Upload size={12} /> Import UIDs
            <input type="file" className="hidden" accept=".csv,.txt,.xlsx" onChange={e => setImportFile(e.target.files[0])} />
          </label>
          {importFile && (
            <button className="btn-primary text-xs py-1 px-2" onClick={handleImport} disabled={importing}>
              {importing ? '...' : `Upload ${importFile.name}`}
            </button>
          )}
        </div>
      </div>

      {/* MCL Doctor list with checkboxes */}
      <div className="border rounded-lg overflow-auto max-h-72">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-2 py-2 w-8">
                <input type="checkbox" onChange={selectAll} title="Select all on page" />
              </th>
              <th className="px-2 py-2 text-left">UID</th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Speciality</th>
              <th className="px-2 py-2 text-left">City</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">Loading...</td></tr>
            ) : allDoctors.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No doctors found</td></tr>
            ) : allDoctors.map(doc => {
              const alreadyMapped = mappedIds.has(doc.id)
              const isSelected = selected.find(d => d.id === doc.id)
              return (
                <tr key={doc.id}
                  className={`${alreadyMapped ? 'bg-green-50' : 'hover:bg-[var(--color-primary-50)] cursor-pointer'}`}
                  onClick={() => !alreadyMapped && toggleSelect(doc)}
                >
                  <td className="px-2 py-1.5 text-center">
                    {alreadyMapped
                      ? <span className="text-green-500 text-sm">✓</span>
                      : <input type="checkbox" checked={!!isSelected} readOnly className="pointer-events-none" />
                    }
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[var(--color-primary)]">{doc.uid_number || '—'}</td>
                  <td className="px-2 py-1.5 font-medium">{doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim()}</td>
                  <td className="px-2 py-1.5 text-gray-500">{doc.speciality || doc.qualification || '—'}</td>
                  <td className="px-2 py-1.5 text-gray-500">{doc.city || '—'}</td>
                  <td className="px-2 py-1.5">
                    {alreadyMapped ? <span className="text-xs text-green-600 font-medium">Mapped</span> : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages} ({totalDoctors} doctors)
          </p>
          <div className="flex gap-1">
            <button className="btn-secondary text-xs py-1 px-2" disabled={page === 1} onClick={() => handlePageChange(page - 1)}>Prev</button>
            <button className="btn-secondary text-xs py-1 px-2" disabled={page >= totalPages} onClick={() => handlePageChange(page + 1)}>Next</button>
          </div>
        </div>
      )}

      {/* Currently mapped doctors */}
      {mappedDoctors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-600 mb-1">Currently Mapped ({mappedDoctors.length})</p>
          <div className="border rounded-lg overflow-auto max-h-48">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">UID</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Speciality</th>
                  <th className="px-3 py-2 text-left">City</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {mappedDoctors.map(d => (
                  <tr key={d.hcp_doctor_id}>
                    <td className="px-3 py-1.5 font-mono text-[var(--color-primary)]">{d.uid_number}</td>
                    <td className="px-3 py-1.5 font-medium">{d.full_name}</td>
                    <td className="px-3 py-1.5 text-gray-500">{d.speciality || '—'}</td>
                    <td className="px-3 py-1.5 text-gray-500">{d.city || '—'}</td>
                    <td className="px-3 py-1.5">
                      <button className="text-red-400 hover:text-red-600" onClick={async (e) => {
                        e.stopPropagation()
                        await api.delete(`/brs/surveys/${surveyId}/doctors/${d.hcp_doctor_id}`)
                        onRefresh()
                      }}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function SurveyEditor({ surveyId, onBack }) {
  const qc = useQueryClient()
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [showDoctorManager, setShowDoctorManager] = useState(false)
  const [newQ, setNewQ] = useState({
    question_text: '', question_type: 'free_text',
    is_required: true, min_duration_seconds: 0,
    video_url: '', options_text: ''
  })

  const { data: survey, isLoading } = useQuery({
    queryKey: ['brs-survey', surveyId],
    queryFn: () => brsApi.getSurvey(surveyId).then(r => r.data),
  })

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => accessApi.listDivisions().then(r => r.data),
  })

  const { data: mappedDoctors = [], refetch: refetchDoctors } = useQuery({
    queryKey: ['survey-doctors', surveyId],
    queryFn: () => api.get(`/brs/surveys/${surveyId}/doctors`).then(r => r.data),
  })

  const [editingMeta, setEditingMeta] = useState(false)
  const [meta, setMeta] = useState({ title: '', description: '', total_honorarium_amount: 0, division_id: '', agreement_template: '', payment_method: '' })

  const updateMeta = useMutation({
    mutationFn: () => brsApi.updateSurvey(surveyId, {
      ...meta,
      division_id: meta.division_id ? parseInt(meta.division_id) : undefined,
    }),
    onSuccess: () => { toast.success('Survey updated'); setEditingMeta(false); qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] }); qc.invalidateQueries({ queryKey: ['brs-surveys'] }) },
  })

  const addQMut = useMutation({
    mutationFn: () => brsApi.addQuestion(surveyId, {
      question_text: newQ.question_text,
      question_type: newQ.question_type,
      is_required: newQ.is_required,
      min_duration_seconds: 0,
      video_url: null,
      options: ['single_select', 'multi_select'].includes(newQ.question_type)
        ? newQ.options_text.split('\n').map(s => s.trim()).filter(Boolean)
        : [],
    }),
    onSuccess: () => {
      toast.success('Question added')
      setAddingQuestion(false)
      setNewQ({ question_text: '', question_type: 'free_text', is_required: true, min_duration_seconds: 0, video_url: '', options_text: '' })
      qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] })
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  if (isLoading) return <LoadingSpinner />

  const hasOptions = ['single_select', 'multi_select'].includes(newQ.question_type)

  return (
    <div>
      <button className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-4"
        onClick={onBack}><ArrowLeft size={16} /> Back to surveys</button>

      {/* Survey Meta */}
      <div className="card p-5 mb-5">
        {editingMeta ? (
          <div className="space-y-3">
            <input className="input" value={meta.title}
              onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
              placeholder="Survey Title" />
            <textarea className="input" rows={2} value={meta.description}
              onChange={e => setMeta(m => ({ ...m, description: e.target.value }))}
              placeholder="Description" />
            <div>
              <label className="label text-xs">Division</label>
              <select className="input" value={meta.division_id}
                onChange={e => setMeta(m => ({ ...m, division_id: e.target.value }))}>
                <option value="">No Division</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <input className="input" type="number" value={meta.total_honorarium_amount}
              onChange={e => setMeta(m => ({ ...m, total_honorarium_amount: parseFloat(e.target.value) || 0 }))}
              placeholder="Total Honorarium Amount (₹)" />
            <select className="input" value={meta.payment_method} onChange={e => setMeta(m => ({ ...m, payment_method: e.target.value }))}>
              <option value="">Payment Method...</option>
              <option value="Cheque">Cheque</option>
              <option value="NEFT">NEFT</option>
            </select>
            <div>
              <label className="label text-xs">Agreement Template</label>
              <textarea className="input font-mono text-xs" rows={8} value={meta.agreement_template}
                onChange={e => setMeta(m => ({ ...m, agreement_template: e.target.value }))}
                placeholder="Leave blank to use auto-generated agreement…" />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary text-sm" onClick={() => updateMeta.mutate()}>Save</button>
              <button className="btn-secondary text-sm" onClick={() => setEditingMeta(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-bold text-lg text-gray-900">{survey?.title}</h3>
              {survey?.description && <p className="text-sm text-gray-500 mt-1">{survey.description}</p>}
              {survey?.division_name && (
                <p className="text-sm text-gray-600 mt-1">Division: <span className="font-medium">{survey.division_name}</span></p>
              )}
              {survey?.total_honorarium_amount > 0 && (
                <p className="text-sm text-green-700 mt-1">Total Honorarium: ₹{survey.total_honorarium_amount.toLocaleString('en-IN')}</p>
              )}
              {survey?.payment_method && (
                <p className="text-sm text-gray-600 mt-1">Payment Method: <span className="font-medium">{survey.payment_method}</span></p>
              )}
              <p className="text-xs text-gray-400 mt-1">{survey?.questions?.length || 0} questions</p>
            </div>
            <button className="btn-secondary text-sm flex items-center gap-1"
              onClick={() => { setMeta({ title: survey.title, description: survey.description || '', total_honorarium_amount: survey.total_honorarium_amount || 0, division_id: survey.division_id || '', agreement_template: survey.agreement_template || '', payment_method: survey.payment_method || '' }); setEditingMeta(true) }}>
              <Edit3 size={14} /> Edit
            </button>
          </div>
        )}
      </div>

      {/* Approval Documents */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-sm text-gray-700">Approval Documents</h4>
            <p className="text-xs text-gray-400">
              {survey?.approval_status === 'Approved'
                ? <span className="text-emerald-600 font-medium">✓ Approved — all documents uploaded</span>
                : <span className="text-amber-600 font-medium">⚠ Pending — upload all three approval documents to proceed</span>
              }
            </p>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded ${survey?.approval_status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
            {survey?.approval_status || 'Pending Approval'}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Medical Team Approval <span className="text-red-500">*</span></p>
            {survey?.medical_approval_file ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-medium">✓ Uploaded</span>
                <a href={`/${survey.medical_approval_file.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-primary)] hover:underline">View</a>
                <button className="text-xs text-red-500 hover:underline" onClick={async () => {
                  try {
                    await brsApi.removeSurveyApproval(surveyId, 'medical_approval')
                    toast.success('Medical approval removed')
                    qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] })
                    qc.invalidateQueries({ queryKey: ['brs-surveys'] })
                  } catch (err) { toast.error('Failed to remove') }
                }}>Remove</button>
              </div>
            ) : (
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="text-xs"
                onChange={async (e) => {
                  const file = e.target.files[0]
                  if (!file) return
                  try {
                    await brsApi.uploadSurveyApproval(surveyId, 'medical_approval', file)
                    toast.success('Medical approval uploaded')
                    qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] })
                    qc.invalidateQueries({ queryKey: ['brs-surveys'] })
                  } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed') }
                }} />
            )}
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Ethics Committee Approval <span className="text-red-500">*</span></p>
            {survey?.ethical_approval_file ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-medium">✓ Uploaded</span>
                <a href={`/${survey.ethical_approval_file.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-primary)] hover:underline">View</a>
                <button className="text-xs text-red-500 hover:underline" onClick={async () => {
                  try {
                    await brsApi.removeSurveyApproval(surveyId, 'ethical_approval')
                    toast.success('Ethical approval removed')
                    qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] })
                    qc.invalidateQueries({ queryKey: ['brs-surveys'] })
                  } catch (err) { toast.error('Failed to remove') }
                }}>Remove</button>
              </div>
            ) : (
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="text-xs"
                onChange={async (e) => {
                  const file = e.target.files[0]
                  if (!file) return
                  try {
                    await brsApi.uploadSurveyApproval(surveyId, 'ethical_approval', file)
                    toast.success('Ethical approval uploaded')
                    qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] })
                    qc.invalidateQueries({ queryKey: ['brs-surveys'] })
                  } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed') }
                }} />
            )}
          </div>
          <div className="border rounded-lg p-4">
            <p className="text-xs font-medium text-gray-700 mb-2">Compliance Team Approval <span className="text-red-500">*</span></p>
            {survey?.compliance_approval_file ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-emerald-600 font-medium">✓ Uploaded</span>
                <a href={`/${survey.compliance_approval_file.replace(/\\/g, '/')}`} target="_blank" rel="noreferrer" className="text-xs text-[var(--color-primary)] hover:underline">View</a>
                <button className="text-xs text-red-500 hover:underline" onClick={async () => {
                  try {
                    await brsApi.removeSurveyApproval(surveyId, 'compliance_approval')
                    toast.success('Compliance approval removed')
                    qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] })
                    qc.invalidateQueries({ queryKey: ['brs-surveys'] })
                  } catch (err) { toast.error('Failed to remove') }
                }}>Remove</button>
              </div>
            ) : (
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="text-xs"
                onChange={async (e) => {
                  const file = e.target.files[0]
                  if (!file) return
                  try {
                    await brsApi.uploadSurveyApproval(surveyId, 'compliance_approval', file)
                    toast.success('Compliance approval uploaded')
                    qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] })
                    qc.invalidateQueries({ queryKey: ['brs-surveys'] })
                  } catch (err) { toast.error(err.response?.data?.detail || 'Upload failed') }
                }} />
            )}
          </div>
        </div>
      </div>

      {/* Mapped Doctors */}
      <div className="card p-5 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-semibold text-sm text-gray-700">Mapped Doctors</h4>
            <p className="text-xs text-gray-400">{mappedDoctors.length} doctor(s) mapped to this survey</p>
          </div>
          <button className="btn-secondary text-xs" onClick={() => setShowDoctorManager(!showDoctorManager)}
            disabled={survey?.approval_status !== 'Approved'}
            title={survey?.approval_status !== 'Approved' ? 'Upload all approval documents first' : ''}>
            {showDoctorManager ? 'Hide' : 'Manage Doctors'}
          </button>
        </div>
        {survey?.approval_status !== 'Approved' && (
          <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">Upload Medical, Ethics Committee, and Compliance Team approval documents to manage doctors.</p>
        )}
        {showDoctorManager && survey?.approval_status === 'Approved' && (
          <SurveyDoctorManager surveyId={surveyId} mappedDoctors={mappedDoctors} onRefresh={refetchDoctors} />
        )}
      </div>

      {/* Questions */}
      <div className="space-y-3 mb-4">
        {(survey?.questions || []).map(q => (
          <div key={q.id} className="flex items-start gap-2">
            <span className="mt-4 text-xs text-gray-400 w-6 text-center shrink-0">{q.order_no}</span>
            <div className="flex-1">
              <QuestionCard q={q} surveyId={surveyId}
                onRefresh={() => qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] })} />
            </div>
          </div>
        ))}
      </div>

      {/* Add Question */}
      {addingQuestion ? (
        <div className="card p-5 border-dashed border-blue-300">
          <h4 className="font-semibold text-sm text-gray-700 mb-3">New Question</h4>
          <div className="space-y-3">
            <textarea className="input" rows={2} value={newQ.question_text}
              onChange={e => setNewQ(q => ({ ...q, question_text: e.target.value }))}
              placeholder="Enter your question…" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label text-xs">Type</label>
                <select className="input text-sm" value={newQ.question_type}
                  onChange={e => setNewQ(q => ({ ...q, question_type: e.target.value }))}>
                  {QUESTION_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end pb-1">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={newQ.is_required}
                    onChange={e => setNewQ(q => ({ ...q, is_required: e.target.checked }))} />
                  Required
                </label>
              </div>
            </div>
            {hasOptions && (
              <div>
                <label className="label text-xs">Options (one per line)</label>
                <textarea className="input font-mono text-sm" rows={4}
                  value={newQ.options_text}
                  onChange={e => setNewQ(q => ({ ...q, options_text: e.target.value }))}
                  placeholder="Option 1&#10;Option 2&#10;Option 3" />
              </div>
            )}
            {newQ.question_type === 'fill_in_blanks' && (
              <p className="text-xs text-gray-500 bg-[var(--color-primary-50)] p-2 rounded">
                Use ___ (three underscores) to mark blanks. Example: "I prescribe ___ mg of drug X for ___ days"
              </p>
            )}
            <div className="flex gap-2">
              <button className="btn-primary text-sm" onClick={() => addQMut.mutate()}
                disabled={addQMut.isPending || !newQ.question_text.trim()}>
                Add Question
              </button>
              <button className="btn-secondary text-sm" onClick={() => setAddingQuestion(false)}>Cancel</button>
            </div>
          </div>
        </div>
      ) : (
        <button className="w-full border-2 border-dashed border-gray-300 rounded-lg py-4 text-sm text-gray-500 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] flex items-center justify-center gap-2 transition-colors"
          onClick={() => setAddingQuestion(true)}
          disabled={survey?.approval_status !== 'Approved'}
          title={survey?.approval_status !== 'Approved' ? 'Upload both approval documents first' : ''}>
          <Plus size={16} /> Add Question
        </button>
      )}
    </div>
  )
}

function SurveyAnalyticsPanel({ surveyId, onClose }) {
  const { data: analytics, isLoading } = useQuery({
    queryKey: ['survey-analytics', surveyId],
    queryFn: () => brsApi.surveyAnalytics(surveyId).then(r => r.data),
    enabled: !!surveyId,
  })

  const handleExport = async () => {
    try {
      const res = await brsApi.surveyAnalyticsExport(surveyId)
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `survey_analytics_${surveyId}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (e) {
      toast.error('Export failed')
    }
  }

  if (isLoading) return <LoadingSpinner />
  if (!analytics) return <p className="text-sm text-gray-500">No data available</p>

  const { survey_title, total_doctors_assigned, total_completed, completion_rate, questions } = analytics

  return (
    <div className="space-y-5">
      {/* Completion Stats */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm text-gray-700">Completion Stats</h4>
          <button className="btn-primary text-xs flex items-center gap-1" onClick={handleExport}>
            <Download size={12} /> Export to Excel
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-800">{total_doctors_assigned}</p>
            <p className="text-xs text-gray-500">Assigned</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{total_completed}</p>
            <p className="text-xs text-gray-500">Completed</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[var(--color-primary)]">{completion_rate}%</p>
            <p className="text-xs text-gray-500">Completion Rate</p>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all"
            style={{ width: `${completion_rate}%`, backgroundColor: 'var(--color-primary)' }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">{total_completed} of {total_doctors_assigned} doctors completed</p>
      </div>

      {/* Per-question breakdown */}
      {questions.map((q, idx) => (
        <div key={q.id} className="card p-5">
          <div className="flex items-start gap-2 mb-3">
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">Q{idx + 1}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">{q.question_text}</p>
              <p className="text-xs text-gray-400 mt-0.5">{q.question_type.replace('_', ' ')} • {q.total_responses} response(s)</p>
            </div>
          </div>

          {(q.question_type === 'single_select' || q.question_type === 'multi_select') && q.responses ? (
            <div className="space-y-2">
              {(q.options || Object.keys(q.responses)).map(opt => {
                const count = q.responses[opt] || 0
                const pct = q.total_responses > 0 ? Math.round((count / q.total_responses) * 100) : 0
                return (
                  <div key={opt}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-gray-700">{opt}</span>
                      <span className="text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: 'var(--color-primary)' }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : q.text_responses ? (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {q.text_responses.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No responses yet</p>
              ) : q.text_responses.map((resp, i) => (
                <div key={i} className="text-xs bg-gray-50 p-2 rounded border border-gray-100 text-gray-700">
                  {resp}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export default function SurveyBuilder() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Administrator'
  const [activeSurveyId, setActiveSurveyId] = useState(null)
  const [showNewSurvey, setShowNewSurvey] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [analyticsSurveyId, setAnalyticsSurveyId] = useState(null)
  const [newSurvey, setNewSurvey] = useState({ title: '', description: '', total_honorarium_amount: '', division_id: '', payment_method: '' })

  const { data: surveys = [], isLoading } = useQuery({
    queryKey: ['brs-surveys'],
    queryFn: () => brsApi.listSurveys().then(r => r.data),
  })

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => accessApi.listDivisions().then(r => r.data),
  })

  const createSurveyMut = useMutation({
    mutationFn: () => brsApi.createSurvey({
      title: newSurvey.title,
      description: newSurvey.description,
      total_honorarium_amount: parseFloat(newSurvey.total_honorarium_amount) || 0,
      division_id: newSurvey.division_id ? parseInt(newSurvey.division_id) : undefined,
      payment_method: newSurvey.payment_method || undefined,
    }),
    onSuccess: (res) => {
      toast.success('Survey created!')
      qc.invalidateQueries({ queryKey: ['brs-surveys'] })
      setShowNewSurvey(false)
      setActiveSurveyId(res.data.id)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed'),
  })

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, is_active }) => brsApi.updateSurvey(id, { is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['brs-surveys'] }),
  })

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/brs/bulk/survey-template', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'survey_import_template.xlsx')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      toast.error('Failed to download template')
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    try {
      const formData = new FormData()
      formData.append('file', importFile)
      const res = await api.post('/brs/bulk/survey-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(res.data)
      toast.success(res.data.message)
      qc.invalidateQueries({ queryKey: ['brs-surveys'] })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  if (activeSurveyId) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <SurveyEditor surveyId={activeSurveyId} onBack={() => setActiveSurveyId(null)} />
      </div>
    )
  }

  return (
    <div className="p-8">
      <PageHeader
        title="Survey Builder"
        subtitle="Create and manage BRS survey templates"
        actions={
          <div className="flex gap-2">
            <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/brs')}>
              <ArrowLeft size={16} /> Back to BRS
            </button>
            <button className="btn-secondary flex items-center gap-2" onClick={() => setShowImport(true)}>
              <Upload size={16} /> Import from Excel
            </button>
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowNewSurvey(true)}>
              <Plus size={16} /> New Survey
            </button>
          </div>
        }
      />

      {isLoading ? <LoadingSpinner /> : surveys.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 bg-[var(--color-primary-50)] rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-[var(--color-neutral-500)]" />
          </div>
          <h3 className="font-semibold text-gray-700 mb-2">No Survey Templates Yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-xs mx-auto">
            Create your first survey template to start sending Bona Fide Research Surveys to doctors.
          </p>
          <button className="btn-primary inline-flex items-center gap-2"
            onClick={() => setShowNewSurvey(true)}>
            <Plus size={16} /> Create First Survey
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {surveys.map(s => (
            <div key={s.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-gray-800 flex-1 pr-2">{s.title}</h4>
                <div className="flex gap-1.5 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded ${s.approval_status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                    {s.approval_status || 'Pending Approval'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              {s.description && <p className="text-xs text-gray-500 mb-3">{s.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                <span>{s.question_count} questions</span>
                <span>{s.doctor_count || 0} doctors</span>
                {s.division_name && <span className="font-medium text-gray-600">{s.division_name}</span>}
                {s.total_honorarium_amount > 0 && (
                  <span>Limit: ₹{s.total_honorarium_amount.toLocaleString('en-IN')}</span>
                )}
                {s.payment_method && <span>Payment: {s.payment_method}</span>}
                {!s.doctor_count && <span className="text-red-500 font-medium">⚠ No doctors mapped</span>}
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-xs flex-1 flex items-center justify-center gap-1"
                  onClick={() => setActiveSurveyId(s.id)}>
                  <Edit3 size={12} /> Edit Questions
                </button>
                <button className="btn-secondary text-xs flex items-center gap-1"
                  onClick={() => setAnalyticsSurveyId(s.id)}>
                  <BarChart3 size={12} /> Analytics
                </button>
                <button className="btn-secondary text-xs"
                  onClick={() => toggleActiveMut.mutate({ id: s.id, is_active: !s.is_active })}>
                  {s.is_active ? 'Deactivate' : 'Activate'}
                </button>
                {isAdmin && (
                  <button className="btn-secondary text-xs text-red-500 hover:bg-red-50"
                    onClick={async () => {
                      if (!confirm(`Delete survey "${s.title}"? This cannot be undone.`)) return
                      try { await api.delete(`/brs/surveys/${s.id}`); qc.invalidateQueries({ queryKey: ['brs-surveys'] }); toast.success('Survey deleted') } catch(e) { toast.error(e.response?.data?.detail || 'Error') }
                    }}>
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )
      }

      <Modal open={showNewSurvey} title="Create New Survey" onClose={() => setShowNewSurvey(false)}>
          <div className="p-5 space-y-4">
            <div>
              <label className="label">Survey Title <span className="text-red-500">*</span></label>
              <input className="input" value={newSurvey.title}
                onChange={e => setNewSurvey(s => ({ ...s, title: e.target.value }))} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea className="input" rows={2} value={newSurvey.description}
                onChange={e => setNewSurvey(s => ({ ...s, description: e.target.value }))} />
            </div>
            <div>
              <label className="label">Division <span className="text-red-500">*</span></label>
              <select className="input" value={newSurvey.division_id}
                onChange={e => setNewSurvey(s => ({ ...s, division_id: e.target.value }))}>
                <option value="">Select Division</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Total Honorarium Amount (₹)</label>
              <input className="input" type="number" value={newSurvey.total_honorarium_amount}
                onChange={e => setNewSurvey(s => ({ ...s, total_honorarium_amount: e.target.value }))} />
            </div>
            <div>
              <label className="label">Payment Method</label>
              <select className="input" value={newSurvey.payment_method} onChange={e => setNewSurvey(s => ({ ...s, payment_method: e.target.value }))}>
                <option value="">Select...</option>
                <option value="Cheque">Cheque</option>
                <option value="NEFT">NEFT</option>
              </select>
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowNewSurvey(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => createSurveyMut.mutate()}
                disabled={createSurveyMut.isPending || !newSurvey.title.trim()}>
                {createSurveyMut.isPending ? 'Creating…' : 'Create Survey'}
              </button>
            </div>
          </div>
      </Modal>

      {/* Import from Excel Modal */}
      <Modal open={showImport} title="Import Survey from Excel" onClose={() => { setShowImport(false); setImportResult(null); setImportFile(null) }}>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-600">
            Upload an Excel file to create a survey with all its questions. Each row = one question.
          </p>
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 text-sm text-green-700 hover:text-green-800 font-medium"
          >
            <Download size={14} /> Download Template
          </button>
          <div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { setImportFile(e.target.files[0]); setImportResult(null) }}
              className="text-sm"
            />
          </div>
          {importResult && (
            <div className="text-sm space-y-2">
              {importResult.created?.length > 0 && (
                <div className="bg-green-50 p-3 rounded border border-green-200">
                  <p className="font-medium text-green-800">Created {importResult.created.length} survey(s):</p>
                  {importResult.created.map(s => (
                    <p key={s.id} className="text-green-700">• {s.title} ({s.question_count} questions)</p>
                  ))}
                </div>
              )}
              {importResult.errors?.length > 0 && (
                <div className="bg-red-50 p-3 rounded border border-red-200 max-h-32 overflow-y-auto">
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-red-700 text-xs">Row {e.row}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3 justify-end">
            <button className="btn-secondary" onClick={() => { setShowImport(false); setImportResult(null); setImportFile(null) }}>Close</button>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={!importFile || importing}
            >
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Analytics Modal */}
      <Modal open={!!analyticsSurveyId} title="Survey Analytics" onClose={() => setAnalyticsSurveyId(null)} size="lg">
        <div className="p-5 max-h-[70vh] overflow-y-auto">
          {analyticsSurveyId && <SurveyAnalyticsPanel surveyId={analyticsSurveyId} onClose={() => setAnalyticsSurveyId(null)} />}
        </div>
      </Modal>
    </div>
  )
}
