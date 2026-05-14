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
  const [step, setStep] = useState(isEditMode ? 2 : 0) // edit mode goes straight to doctors
  const [brsId, setBrsId] = useState(editId ? parseInt(editId) : null)
  const [form, setForm] = useState({
    survey_id: '', title: '', therapeutic_area: '', brand: '',
    topic: '', on_field_execution_by: '', start_date: '', end_date: '',
    rationale: '', agenda: '', cost_center: '', remarks: '', division_id: '',
  })
  const [doctors, setDoctors] = useState([])
  const [doctorSearchOpen, setDoctorSearchOpen] = useState(false)

  const { data: surveys = [] } = useQuery({ queryKey: ['brs-surveys'], queryFn: () => brsApi.listSurveys().then(r => r.data) })
  const { data: divisions = [] } = useQuery({ queryKey: ['my-divisions'], queryFn: () => accessApi.listMyDivisions().then(r => r.data) })
  const { data: therapeutics = [] } = useQuery({ queryKey: ['therapeutics'], queryFn: () => masterApi.therapeutics().then(r => r.data) })
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: () => masterApi.brands().then(r => r.data) })
  const { data: territoryManagers = [] } = useQuery({
    queryKey: ['territory-managers'],
    queryFn: () => accessApi.subordinatesByRole('Territory Manager').then(r => r.data),
  })

  // Load existing BRS in edit mode
  const { data: existingBrs } = useQuery({
    queryKey: ['brs', editId],
    queryFn: () => brsApi.get(editId).then(r => r.data),
    enabled: isEditMode,
  })

  useEffect(() => {
    if (existingBrs && isEditMode) {
      setDoctors(existingBrs.doctors || [])
    }
  }, [existingBrs, isEditMode])

  const updateField = (field, value) => setForm(f => ({ ...f, [field]: value }))

  // Create BRS
  const createBrs = async () => {
    if (!form.survey_id) { toast.error('Select a survey'); return }
    if (!form.title) { toast.error('Title is required'); return }
    if (!form.brand) { toast.error('Brand is required'); return }
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
      })
      setDoctors(prev => [...prev, { id: res.data.id, ...res.data, doctor_name: doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim(), email: doc.email, pan_number: doc.pan_number }])
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error adding doctor')
    }
    setDoctorSearchOpen(false)
  }

  const updateDoctorField = (doctorId, field, value) => setDoctors(prev => prev.map(d => d.id === doctorId ? { ...d, [field]: value } : d))

  const removeDoctor = async (doctorId) => {
    try { await brsApi.removeDoctor(brsId, doctorId); setDoctors(prev => prev.filter(d => d.id !== doctorId)); toast.success('Removed') } catch (e) { toast.error('Error') }
  }

  // Submit
  const submitBrs = async () => {
    if (doctors.length === 0) { toast.error('Add at least one doctor'); return }
    // Save doctor details
    for (const doc of doctors) {
      try {
        await brsApi.updateDoctor(brsId, doc.id, { name_as_per_pan: doc.name_as_per_pan, pan_number: doc.pan_number, email: doc.email, honorarium_amount: doc.honorarium_amount ? parseFloat(doc.honorarium_amount) : null })
      } catch (e) {}
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
      <PageHeader title="New BRS" subtitle="Create a Budget Request" />

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
              <select className="input" value={form.division_id || ''} onChange={e => updateField('division_id', e.target.value)}>
                <option value="">Select</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cost Center</label>
              <input className="input" value={form.cost_center} onChange={e => updateField('cost_center', e.target.value)} />
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
                {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
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
            <button className="btn-primary bg-red-600 hover:bg-red-700" onClick={() => setStep(1)}>Next <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Step 2: Event Info */}
      {step === 1 && (
        <div className="card space-y-5">
          <h3 className="text-lg font-bold">Event Information</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">On Field Execution By *</label>
              <select className="input" value={form.on_field_execution_by} onChange={e => updateField('on_field_execution_by', e.target.value)}>
                <option value="">Select Territory Manager</option>
                {territoryManagers.map(tm => (
                  <option key={tm.id} value={tm.employee_id}>
                    {tm.name} {tm.employee_id ? `(${tm.employee_id})` : ''} {tm.territory_name ? `– ${tm.territory_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Start Date *</label>
              <input type="date" className="input" value={form.start_date} onChange={e => updateField('start_date', e.target.value)} />
            </div>
            <div>
              <label className="label">End Date *</label>
              <input type="date" className="input" value={form.end_date} onChange={e => updateField('end_date', e.target.value)} />
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
            <button className="btn-primary bg-red-600 hover:bg-red-700" onClick={createBrs}>Create & Add Doctors <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {/* Step 3: Add Doctors */}
      {step === 2 && (
        <div className="space-y-6">
          <div className="card space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">Add Doctors</h3>
              <button className="btn-primary flex items-center gap-1 text-sm" onClick={() => setDoctorSearchOpen(true)}>
                <Search size={14} /> Search MCL
              </button>
            </div>

            {doctors.length > 0 ? (
              <div className="overflow-x-auto border rounded-lg">
                <table className="text-sm w-full" style={{ minWidth: '900px' }}>
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      {['Doctor Name', 'Name As Per PAN *', 'PAN Number *', 'Email *', 'Honorarium (₹)', ''].map(h => (
                        <th key={h} className="px-3 py-2 text-left text-xs text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {doctors.map(d => (
                      <tr key={d.id}>
                        <td className="px-3 py-2 font-medium">{d.doctor_name}</td>
                        <td className="px-3 py-2"><input className="input py-1 text-sm" value={d.name_as_per_pan || ''} onChange={e => updateDoctorField(d.id, 'name_as_per_pan', e.target.value)} /></td>
                        <td className="px-3 py-2"><input className="input py-1 text-sm w-28" value={d.pan_number || ''} onChange={e => updateDoctorField(d.id, 'pan_number', e.target.value)} /></td>
                        <td className="px-3 py-2"><input className="input py-1 text-sm" value={d.email || ''} onChange={e => updateDoctorField(d.id, 'email', e.target.value)} /></td>
                        <td className="px-3 py-2"><input type="number" className="input py-1 text-sm w-24" value={d.honorarium_amount || ''} onChange={e => updateDoctorField(d.id, 'honorarium_amount', e.target.value)} /></td>
                        <td className="px-3 py-2"><button className="text-red-400 hover:text-red-600" onClick={() => removeDoctor(d.id)}><Trash2 size={14} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed rounded-lg">
                No doctors added. Click "Search MCL" to add doctors.
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button className="btn-secondary" onClick={() => navigate('/brs')}>Cancel</button>
            <button className="btn-primary bg-emerald-600 hover:bg-emerald-700" onClick={submitBrs}>
              ✓ Submit for Approval
            </button>
          </div>

          <DoctorSearchModal open={doctorSearchOpen} onClose={() => setDoctorSearchOpen(false)} onSelect={addDoctorFromMcl} />
        </div>
      )}
    </div>
  )
}
