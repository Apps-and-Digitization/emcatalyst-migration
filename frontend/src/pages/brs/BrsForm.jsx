import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, Search, ChevronRight, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import { brsApi, accessApi, masterApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import DoctorSearchModal from '../../components/DoctorSearchModal'
import useAuthStore from '../../store/authStore'

export default function BrsForm() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEditMode = !!editId
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [step, setStep] = useState(0) // always start at step 0, even in edit mode
  const [brsId, setBrsId] = useState(editId ? parseInt(editId) : null)
  const [form, setForm] = useState({
    survey_id: '', title: '', therapeutic_area: '', brand: '',
    topic: '', start_date: '', end_date: '',
    rationale: '', agenda: '', cost_center: '', remarks: '', division_id: '',
  })
  const [doctors, setDoctors] = useState([])
  const [doctorSearchOpen, setDoctorSearchOpen] = useState(false)
  const [budgetError, setBudgetError] = useState('')
  const [budgetInfo, setBudgetInfo] = useState(null)
  const [territoryAssignments, setTerritoryAssignments] = useState([])
  const [savingAssignments, setSavingAssignments] = useState(false)
  const [perDoctorHonorarium, setPerDoctorHonorarium] = useState('')

  const { data: surveys = [] } = useQuery({ queryKey: ['brs-surveys-approved'], queryFn: () => brsApi.listSurveys({ approved_only: true }).then(r => r.data) })
  const { data: divisions = [] } = useQuery({ queryKey: ['my-divisions'], queryFn: () => accessApi.listMyDivisions().then(r => r.data) })
  const { data: therapeutics = [] } = useQuery({ queryKey: ['therapeutics'], queryFn: () => masterApi.therapeutics().then(r => r.data) })
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: () => masterApi.brands().then(r => r.data) })
  const { data: territoryManagers = [] } = useQuery({
    queryKey: ['field-execution-users'],
    queryFn: () => accessApi.allSubordinates().then(r => r.data || []),
  })

  // Load existing BRS in edit mode
  const { data: existingBrs } = useQuery({
    queryKey: ['brs', editId],
    queryFn: () => brsApi.get(editId).then(r => r.data),
    enabled: isEditMode,
  })

  // Load territory assignments when brsId is available
  const { data: fetchedAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ['territory-assignments', brsId, doctors.length],
    queryFn: () => brsApi.getTerritoryAssignments(brsId).then(r => r.data),
    enabled: !!brsId && step === 2 && doctors.length > 0,
  })

  useEffect(() => {
    setTerritoryAssignments(fetchedAssignments)
  }, [fetchedAssignments])

  useEffect(() => {
    if (existingBrs && isEditMode) {
      setDoctors(existingBrs.doctors || [])
      setForm({
        survey_id: existingBrs.survey_id ? String(existingBrs.survey_id) : '',
        title: existingBrs.title || '',
        therapeutic_area: existingBrs.therapeutic_area || '',
        brand: existingBrs.brand || '',
        topic: existingBrs.topic || '',
        start_date: existingBrs.start_date ? existingBrs.start_date.slice(0, 10) : '',
        end_date: existingBrs.end_date ? existingBrs.end_date.slice(0, 10) : '',
        rationale: existingBrs.rationale || '',
        agenda: existingBrs.agenda || '',
        cost_center: existingBrs.cost_center || '',
        remarks: existingBrs.remarks || '',
        division_id: existingBrs.division_id ? String(existingBrs.division_id) : '',
      })
    }
  }, [existingBrs, isEditMode])

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // Create BRS
  const createBrs = async () => {
    if (!form.survey_id) { toast.error('Select a survey'); return }
    if (!form.title) { toast.error('Title is required'); return }
    if (!form.brand) { toast.error('Brand is required'); return }
    if (!form.start_date) { toast.error('Start Date is required'); return }
    if (!form.rationale) { toast.error('Rationale is required'); return }
    if (!form.agenda) { toast.error('Agenda is required'); return }
    if (budgetError) { toast.error('Cannot proceed — BRS budget not configured for selected date'); return }
    try {
      const payload = { ...form, survey_id: parseInt(form.survey_id) }
      if (payload.division_id) payload.division_id = parseInt(payload.division_id)
      // Remove empty strings
      Object.keys(payload).forEach(k => { if (payload[k] === '') delete payload[k] })
      const res = await brsApi.create(payload)
      setBrsId(res.data.id)
      toast.success(`BRS ${res.data.brs_code} created`)
      setStep(2)
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error creating BRS')
    }
  }

  // Add doctor
  const addDoctorFromMcl = async (doc) => {
    if (!brsId) return
    try {
      const res = await brsApi.addDoctor(brsId, {
        hcp_doctor_id: doc.id,
        doctor_name: doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim(),
        email: doc.email || '',
        pan_number: doc.pan_number || '',
        mobile: doc.mobile_number || '',
        speciality: doc.qualification || '',
        honorarium_amount: perDoctorHonorarium ? parseFloat(perDoctorHonorarium) : undefined,
      })
      setDoctors(prev => [...prev, {
        id: res.data.id, ...res.data,
        doctor_name: doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim(),
        email: doc.email, pan_number: doc.pan_number,
        honorarium_amount: perDoctorHonorarium ? parseFloat(perDoctorHonorarium) : '',
      }])
      // Refetch territory assignments after adding doctor
      refetchAssignments()
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error adding doctor')
    }
    setDoctorSearchOpen(false)
  }

  const updateDoctorField = (doctorId, field, value) => {
    setDoctors(prev => prev.map(d => d.id === doctorId ? { ...d, [field]: value } : d))
    // Also update in territory assignments
    setTerritoryAssignments(prev => prev.map(ta => ({
      ...ta,
      doctors: (ta.doctors || []).map(d => d.id === doctorId ? { ...d, [field]: value } : d)
    })))
  }

  const removeDoctor = async (doctorId) => {
    try { await brsApi.removeDoctor(brsId, doctorId); setDoctors(prev => prev.filter(d => d.id !== doctorId)); toast.success('Removed') } catch (e) { toast.error('Error') }
  }

  // Submit
  const submitBrs = async () => {
    if (doctors.length === 0) { toast.error('Add at least one doctor'); return }

    // Check all territory groups have a user assigned
    const unassignedTerritories = territoryAssignments.filter(ta => !ta.assigned_user_id)
    if (unassignedTerritories.length > 0) {
      toast.error(`Assign a user to all territory groups: ${unassignedTerritories.map(ta => ta.territory_name).join(', ')}`)
      return
    }

    // Check all doctors have honorarium
    const missingHonorarium = doctors.filter(d => !d.honorarium_amount || parseFloat(d.honorarium_amount) <= 0)
    if (missingHonorarium.length > 0) {
      toast.error(`Honorarium amount is required for: ${missingHonorarium.map(d => d.doctor_name).join(', ')}`)
      return
    }

    // Frontend-side honorarium limit check (survey limit)
    const selectedSurvey = surveys.find(s => s.id === parseInt(form.survey_id))
    const surveyLimit = selectedSurvey?.total_honorarium_amount || (existingBrs?.total_honorarium_amount) || 0
    const totalHonorarium = doctors.reduce((sum, d) => sum + (parseFloat(d.honorarium_amount) || 0), 0)
    if (surveyLimit > 0 && totalHonorarium > surveyLimit) {
      toast.error(`Total honorarium (₹${totalHonorarium.toLocaleString('en-IN')}) exceeds survey limit of ₹${surveyLimit.toLocaleString('en-IN')}`)
      return
    }

    // Frontend-side BRS budget check
    if (budgetInfo && totalHonorarium > budgetInfo.available) {
      toast.error(`Total honorarium (₹${totalHonorarium.toLocaleString('en-IN')}) exceeds available BRS budget of ₹${Number(budgetInfo.available).toLocaleString('en-IN')}`)
      return
    }

    // Save doctor details
    for (const doc of doctors) {
      try {
        await brsApi.updateDoctor(brsId, doc.id, { name_as_per_pan: doc.name_as_per_pan, pan_number: doc.pan_number, email: doc.email, honorarium_amount: doc.honorarium_amount ? parseFloat(doc.honorarium_amount) : null })
      } catch (e) {
        const detail = e.response?.data?.detail || 'Error saving doctor details'
        toast.error(`${doc.doctor_name}: ${detail}`)
        return // Stop submission if any doctor update fails
      }
    }

    // Auto-save territory assignments before submitting
    const assignmentPayload = territoryAssignments
      .filter(ta => ta.assigned_user_id)
      .map(ta => ({ territory_id: ta.territory_id, assigned_user_id: ta.assigned_user_id }))
    if (assignmentPayload.length > 0) {
      try {
        await brsApi.saveTerritoryAssignments(brsId, assignmentPayload)
      } catch (e) {
        toast.error('Error saving territory assignments')
        return
      }
    }

    try {
      await brsApi.submit(brsId)
      qc.invalidateQueries(['brs-list'])
      toast.success('BRS submitted for Division Head approval')
      navigate('/brs')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error submitting')
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader title="New BRS" subtitle="Create a Bona Fide Research Survey" />

      {/* Stepper */}
      <div className="flex items-center mb-8">
        {['Basic Details', 'Event Info', 'Add Doctors'].map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 ${i < step ? 'bg-emerald-500 border-emerald-500 text-white' : i === step ? 'border-red-500 text-red-500' : 'border-gray-300 text-gray-400'}`}>{i < step ? '✓' : `0${i + 1}`}</div>
              <span className={`text-sm ${i === step ? 'font-semibold' : 'text-gray-400'}`}>{label}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-1 mx-3 rounded ${i < step ? 'bg-red-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Basic Details */}
      {step === 0 && (
        <div className="card space-y-5">
          <h3 className="text-lg font-bold">Basic Details</h3>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">Initiated By</p>
            <p className="text-sm font-medium">{user?.first_name} {user?.last_name} ({user?.employee_id || user?.email})</p>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="label">Initiated By</label>
              <input className="input bg-gray-50" value={`${user?.first_name || ''} ${user?.last_name || ''}`} disabled />
            </div>
            <div>
              <label className="label">Employee ID</label>
              <input className="input bg-gray-50" value={user?.employee_id || '—'} disabled />
            </div>
            <div>
              <label className="label">Division *</label>
              <select className="input" value={form.division_id || ''} onChange={e => {
                const divId = e.target.value
                updateField('division_id', divId)
                const selectedDiv = divisions.find(d => d.id == divId)
                updateField('cost_center', selectedDiv?.costcenter || '')
              }}>
                <option value="">Select</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cost Center</label>
              <input className="input bg-gray-50" value={form.cost_center} disabled />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Survey *</label>
              <select className="input" value={form.survey_id} onChange={e => updateField('survey_id', e.target.value)}>
                <option value="">Select survey</option>
                {surveys.filter(s => !form.division_id || s.division_id == form.division_id || !s.division_id).map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Title of Program *</label>
              <input className="input" value={form.title} onChange={e => updateField('title', e.target.value)} />
            </div>
            <div>
              <label className="label">Brand *</label>
              <select className="input" value={form.brand} onChange={e => updateField('brand', e.target.value)}>
                <option value="">Select</option>
                {brands.filter(b => form.division_id && b.divisions?.some(d => String(d.id) === String(form.division_id))).map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Therapeutic Area</label>
              <select className="input" value={form.therapeutic_area} onChange={e => updateField('therapeutic_area', e.target.value)}>
                <option value="">Select</option>
                {therapeutics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Topic</label>
              <input className="input" value={form.topic} onChange={e => updateField('topic', e.target.value)} />
            </div>
          </div>
          <div className="flex justify-between pt-2">
            <button className="btn-secondary" onClick={() => navigate('/brs')}>Cancel</button>
            <button className="btn-primary" onClick={() => {
              if (!form.division_id) { toast.error('Division is required'); return }
              if (!form.survey_id) { toast.error('Survey is required'); return }
              if (!form.title) { toast.error('Title of Program is required'); return }
              if (!form.brand) { toast.error('Brand is required'); return }
              setStep(1)
            }}>Next <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Step 2: Event Info */}
      {step === 1 && (
        <div className="card space-y-5">
          <h3 className="text-lg font-bold">Event Information</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start Date *</label>
              <input type="date" className="input" value={form.start_date} onChange={async e => {
                updateField('start_date', e.target.value)
                setBudgetError('')
                setBudgetInfo(null)
                // Auto-set end date to 60 days from start
                if (e.target.value) {
                  const start = new Date(e.target.value)
                  start.setDate(start.getDate() + 60)
                  updateField('end_date', start.toISOString().split('T')[0])
                  // Check BRS budget
                  if (form.division_id) {
                    try {
                      const res = await brsApi.checkBudget(form.division_id, e.target.value)
                      if (!res.data.has_budget) {
                        setBudgetError(res.data.error)
                      } else {
                        setBudgetInfo(res.data)
                      }
                    } catch (err) {
                      setBudgetError(err.response?.data?.detail || 'Budget check failed')
                    }
                  }
                }
              }} />
              {budgetError && <p className="text-xs text-red-500 mt-1">{budgetError}</p>}
              {budgetInfo && <p className="text-xs text-emerald-600 mt-1">Budget available: ₹{Number(budgetInfo.available).toLocaleString('en-IN')} (Q{budgetInfo.quarter} FY {budgetInfo.fy_year})</p>}
            </div>
            <div>
              <label className="label">End Date (Start + 60 days)</label>
              <input type="date" className="input bg-gray-50" value={form.end_date} disabled />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Rationale *</label>
              <textarea className="input h-20" value={form.rationale} onChange={e => updateField('rationale', e.target.value)} />
            </div>
            <div>
              <label className="label">Agenda *</label>
              <textarea className="input h-20" value={form.agenda} onChange={e => updateField('agenda', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Remarks</label>
            <textarea className="input h-16" value={form.remarks} onChange={e => updateField('remarks', e.target.value)} />
          </div>
          <div className="flex justify-between pt-2">
            <button className="btn-secondary" onClick={() => setStep(0)}><ChevronLeft size={16} /> Previous</button>
            <button className="btn-primary" onClick={isEditMode ? () => setStep(2) : createBrs}>
              {isEditMode ? 'Next' : 'Create & Add Doctors'} <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Doctors grouped by Territory */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Doctors & Territory Assignments</h3>
              <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => setDoctorSearchOpen(true)}>
                <Search size={14} /> Add Doctor from MCL
              </button>
            </div>

            {/* Per Doctor Honorarium & Total Survey Cost */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Per Doctor Honorarium (₹)</label>
                <input
                  type="number"
                  className="input"
                  placeholder="e.g. 5000"
                  value={perDoctorHonorarium}
                  onChange={e => {
                    const val = e.target.value
                    setPerDoctorHonorarium(val)
                    if (val) {
                      // Apply to all doctors
                      const amount = parseFloat(val)
                      setDoctors(prev => prev.map(d => ({ ...d, honorarium_amount: amount })))
                      setTerritoryAssignments(prev => prev.map(ta => ({
                        ...ta,
                        doctors: (ta.doctors || []).map(d => ({ ...d, honorarium_amount: amount }))
                      })))
                    }
                  }}
                />
                <p className="text-xs text-gray-400 mt-1">Applies to all doctors. Individual amounts can be edited below.</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Total Survey Cost (₹)</label>
                <input
                  type="text"
                  className="input bg-gray-50 font-semibold"
                  value={`₹${doctors.reduce((sum, d) => sum + (parseFloat(d.honorarium_amount) || 0), 0).toLocaleString('en-IN')}`}
                  disabled
                />
              </div>
            </div>

            {territoryAssignments.length > 0 ? (
              <div className="space-y-5">
                {territoryAssignments.map((ta, groupIdx) => (
                  <div key={ta.territory_id ?? 'none'} className="border rounded-xl overflow-hidden shadow-sm">
                    {/* Territory Header */}
                    <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'var(--color-primary-50)', borderBottom: '2px solid var(--color-primary-100)' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-primary)', color: '#fff' }}>
                          <span className="text-xs font-bold">{ta.doctor_count}</span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: 'var(--color-neutral-900)' }}>{ta.territory_name}</p>
                          <p className="text-xs" style={{ color: 'var(--color-neutral-500)' }}>{ta.doctor_count} doctor{ta.doctor_count !== 1 ? 's' : ''} in this territory</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium" style={{ color: 'var(--color-neutral-600)' }}>Assign to:</span>
                        <select
                          className="input w-56 text-sm py-1.5"
                          value={ta.assigned_user_id || ''}
                          onChange={e => {
                            const newAssignments = [...territoryAssignments]
                            newAssignments[groupIdx] = { ...newAssignments[groupIdx], assigned_user_id: e.target.value ? parseInt(e.target.value) : null }
                            setTerritoryAssignments(newAssignments)
                          }}
                        >
                          <option value="">Select User…</option>
                          {territoryManagers
                            .filter(tm => !ta.territory_id || tm.territory_id === ta.territory_id || !tm.territory_id)
                            .map(tm => (
                              <option key={tm.id} value={tm.id}>
                                {tm.name} {tm.employee_id ? `(${tm.employee_id})` : ''}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                    {/* Doctor rows */}
                    <div className="overflow-x-auto">
                      <table className="text-sm w-full" style={{ minWidth: '800px' }}>
                        <thead className="bg-white border-b">
                          <tr>
                            {['Doctor Name', 'Name As Per PAN', 'PAN Number', 'Email', 'Honorarium (₹)', ''].map(h => (
                              <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {(ta.doctors || []).map(d => (
                            <tr key={d.id} className="hover:bg-gray-50">
                              <td className="px-4 py-2.5 font-medium text-sm text-gray-800">{d.doctor_name}</td>
                              <td className="px-4 py-2.5"><input className="input py-1 text-sm" value={d.name_as_per_pan || ''} onChange={e => updateDoctorField(d.id, 'name_as_per_pan', e.target.value)} /></td>
                              <td className="px-4 py-2.5"><input className="input py-1 text-sm w-28" value={d.pan_number || ''} onChange={e => updateDoctorField(d.id, 'pan_number', e.target.value)} /></td>
                              <td className="px-4 py-2.5"><input className="input py-1 text-sm" value={d.email || ''} onChange={e => updateDoctorField(d.id, 'email', e.target.value)} /></td>
                              <td className="px-4 py-2.5"><input type="number" className="input py-1 text-sm w-24" value={d.honorarium_amount || ''} onChange={e => updateDoctorField(d.id, 'honorarium_amount', e.target.value)} /></td>
                              <td className="px-4 py-2.5"><button className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50" onClick={() => removeDoctor(d.id)}><Trash2 size={14} /></button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            ) : doctors.length > 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading territory groups...</p>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed rounded-lg">
                No doctors added. Click "Add Doctor from MCL" to get started.
              </div>
            )}
          </div>

          {/* Save & Submit */}
          {territoryAssignments.length > 0 && (
            <div className="flex justify-between items-center">
              <button className="btn-secondary" onClick={() => navigate('/brs')}>Cancel</button>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={savingAssignments}
                  onClick={async () => {
                    setSavingAssignments(true)
                    try {
                      const payload = territoryAssignments
                        .filter(ta => ta.assigned_user_id)
                        .map(ta => ({ territory_id: ta.territory_id, assigned_user_id: ta.assigned_user_id }))
                      await brsApi.saveTerritoryAssignments(brsId, payload)
                      toast.success('Assignments saved')
                      refetchAssignments()
                    } catch (e) {
                      toast.error(e.response?.data?.detail || 'Error')
                    }
                    setSavingAssignments(false)
                  }}
                >
                  {savingAssignments ? 'Saving...' : 'Save Assignments'}
                </button>
                <button className="btn-primary" onClick={submitBrs}>
                  ✓ Submit for Approval
                </button>
              </div>
            </div>
          )}

          {!territoryAssignments.length && doctors.length === 0 && (
            <div className="flex justify-between">
              <button className="btn-secondary" onClick={() => navigate('/brs')}>Cancel</button>
            </div>
          )}

          <DoctorSearchModal open={doctorSearchOpen} onClose={() => setDoctorSearchOpen(false)} onSelect={addDoctorFromMcl} surveyId={form.survey_id} />
        </div>
      )}
    </div>
  )
}
