import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  Plus, Trash2, GripVertical, Edit3, Save, X, ChevronDown,
  ChevronUp, List, CheckSquare, AlignLeft, ToggleLeft, ArrowLeft, FileText, Upload, Download
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { brsApi, accessApi } from '../../api/endpoints'
import api from '../../api/client'
import PageHeader from '../../components/ui/PageHeader'
import Modal from '../../components/ui/Modal'
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
                <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
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
            <button className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
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

function SurveyEditor({ surveyId, onBack }) {
  const qc = useQueryClient()
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [newQ, setNewQ] = useState({
    question_text: '', question_type: 'free_text',
    is_required: true, min_duration_seconds: 0,
    video_url: '', options_text: ''
  })

  const { data: survey, isLoading } = useQuery({
    queryKey: ['brs-survey', surveyId],
    queryFn: () => brsApi.getSurvey(surveyId).then(r => r.data),
  })

  const [editingMeta, setEditingMeta] = useState(false)
  const [meta, setMeta] = useState({ title: '', description: '', total_honorarium_amount: 0, agreement_template: '' })

  const updateMeta = useMutation({
    mutationFn: () => brsApi.updateSurvey(surveyId, meta),
    onSuccess: () => { toast.success('Survey updated'); setEditingMeta(false); qc.invalidateQueries({ queryKey: ['brs-survey', surveyId] }) },
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
            <input className="input" type="number" value={meta.total_honorarium_amount}
              onChange={e => setMeta(m => ({ ...m, total_honorarium_amount: parseFloat(e.target.value) || 0 }))}
              placeholder="Total Honorarium Amount (₹)" />
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
              {survey?.total_honorarium_amount > 0 && (
                <p className="text-sm text-green-700 mt-1">Total Honorarium: ₹{survey.total_honorarium_amount.toLocaleString('en-IN')}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">{survey?.questions?.length || 0} questions</p>
            </div>
            <button className="btn-secondary text-sm flex items-center gap-1"
              onClick={() => { setMeta({ title: survey.title, description: survey.description || '', total_honorarium_amount: survey.total_honorarium_amount || 0, agreement_template: survey.agreement_template || '' }); setEditingMeta(true) }}>
              <Edit3 size={14} /> Edit
            </button>
          </div>
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
              <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
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
        <button className="w-full border-2 border-dashed border-gray-300 rounded-lg py-4 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 flex items-center justify-center gap-2 transition-colors"
          onClick={() => setAddingQuestion(true)}>
          <Plus size={16} /> Add Question
        </button>
      )}
    </div>
  )
}

export default function SurveyBuilder() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeSurveyId, setActiveSurveyId] = useState(null)
  const [showNewSurvey, setShowNewSurvey] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [newSurvey, setNewSurvey] = useState({ title: '', description: '', total_honorarium_amount: '', division_id: '' })

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
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-blue-400" />
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
                <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              {s.description && <p className="text-xs text-gray-500 mb-3">{s.description}</p>}
              <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
                <span>{s.question_count} questions</span>
                {s.total_honorarium_amount > 0 && (
                  <span>Limit: ₹{s.total_honorarium_amount.toLocaleString('en-IN')}</span>
                )}
              </div>
              <div className="flex gap-2">
                <button className="btn-primary text-xs flex-1 flex items-center justify-center gap-1"
                  onClick={() => setActiveSurveyId(s.id)}>
                  <Edit3 size={12} /> Edit Questions
                </button>
                <button className="btn-secondary text-xs"
                  onClick={() => toggleActiveMut.mutate({ id: s.id, is_active: !s.is_active })}>
                  {s.is_active ? 'Deactivate' : 'Activate'}
                </button>
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
    </div>
  )
}
