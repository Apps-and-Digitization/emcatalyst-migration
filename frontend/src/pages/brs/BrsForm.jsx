import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import { ArrowLeft, Search, UserCheck, UserPlus } from 'lucide-react'
import { brsApi, masterApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'

export default function BrsForm() {
  const navigate = useNavigate()
  const [doctorMode, setDoctorMode] = useState('mcl') // 'mcl' | 'new'
  const [doctorSearch, setDoctorSearch] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [showDoctorResults, setShowDoctorResults] = useState(false)

  const [form, setForm] = useState({
    survey_title: '',
    therapeutic_area: '',
    brand: '',
    topic: '',
    mode: 'Online',
    survey_duration_minutes: 30,
    honorarium_amount: '',
    division_id: '',
    cost_center: '',
    company_code: '',
    remarks: '',
    survey_id: '',
    // New doctor fields
    new_doctor_name: '',
    new_doctor_email: '',
    new_doctor_phone: '',
    new_doctor_speciality: '',
    new_doctor_city: '',
    pan_number: '',
    bank_name: '',
    bank_account_no: '',
    ifsc_code: '',
  })

  const { data: therapeutics = [] } = useQuery({
    queryKey: ['therapeutics'],
    queryFn: () => masterApi.therapeutics().then(r => r.data),
  })
  const { data: brands = [] } = useQuery({
    queryKey: ['brands-all'],
    queryFn: () => masterApi.brands('').then(r => r.data),
  })
  const { data: divisions = [] } = useQuery({
    queryKey: ['master-divisions'],
    queryFn: () => masterApi.divisions().then(r => r.data),
  })
  const { data: surveys = [] } = useQuery({
    queryKey: ['brs-surveys'],
    queryFn: () => brsApi.listSurveys().then(r => r.data),
  })
  const { data: doctorResults = [] } = useQuery({
    queryKey: ['hcp-search', doctorSearch],
    queryFn: () => masterApi.hcpDoctors(doctorSearch, 20).then(r => r.data),
    enabled: doctorSearch.length >= 2,
  })

  const createMutation = useMutation({
    mutationFn: (data) => brsApi.create(data),
    onSuccess: (res) => {
      toast.success(`BRS application ${res.data.brs_code} created!`)
      navigate(`/brs/${res.data.id}`)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create application'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.survey_title.trim()) return toast.error('Survey title is required')
    if (doctorMode === 'mcl' && !selectedDoctor) return toast.error('Please select a doctor from MCL')
    if (doctorMode === 'new' && !form.new_doctor_name.trim()) return toast.error('Doctor name is required')

    const payload = {
      ...form,
      is_new_doctor: doctorMode === 'new',
      hcp_doctor_id: doctorMode === 'mcl' ? selectedDoctor?.id : null,
      honorarium_amount: form.honorarium_amount ? parseFloat(form.honorarium_amount) : null,
      survey_duration_minutes: parseInt(form.survey_duration_minutes) || 30,
      division_id: form.division_id ? parseInt(form.division_id) : null,
      survey_id: form.survey_id ? parseInt(form.survey_id) : null,
      pan_number: doctorMode === 'mcl' ? (selectedDoctor?.pan_number || form.pan_number) : form.pan_number,
    }
    createMutation.mutate(payload)
  }

  const selectDoctor = (d) => {
    setSelectedDoctor(d)
    setForm(f => ({
      ...f,
      pan_number: d.pan_number || '',
      bank_name: d.bank_name || '',
      bank_account_no: d.account_number || '',
      ifsc_code: d.ifsc_code || '',
    }))
    setShowDoctorResults(false)
    setDoctorSearch(d.full_name || d.first_name || '')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <PageHeader
        title="New BRS Application"
        subtitle="Bona Fide Research Survey — Initiate a doctor survey engagement"
        actions={
          <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/brs')}>
            <ArrowLeft size={16} /> Back
          </button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Survey Details */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Survey Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="label">Survey Title <span className="text-red-500">*</span></label>
              <input className="input" value={form.survey_title}
                onChange={e => set('survey_title', e.target.value)}
                placeholder="e.g. Cardiology Research Survey Q2 2026" />
            </div>
            <div>
              <label className="label">Survey Template</label>
              <select className="input" value={form.survey_id}
                onChange={e => set('survey_id', e.target.value)}>
                <option value="">— Select Survey Template —</option>
                {surveys.map(s => (
                  <option key={s.id} value={s.id}>{s.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Mode</label>
              <select className="input" value={form.mode} onChange={e => set('mode', e.target.value)}>
                <option>Online</option>
                <option>Offline</option>
              </select>
            </div>
            <div>
              <label className="label">Therapeutic Area</label>
              <select className="input" value={form.therapeutic_area}
                onChange={e => set('therapeutic_area', e.target.value)}>
                <option value="">— Select —</option>
                {therapeutics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Brand</label>
              <select className="input" value={form.brand}
                onChange={e => set('brand', e.target.value)}>
                <option value="">— Select —</option>
                {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Topic / Agenda</label>
              <textarea className="input" rows={3} value={form.topic}
                onChange={e => set('topic', e.target.value)}
                placeholder="Describe the survey topic and research objectives…" />
            </div>
            <div>
              <label className="label">Survey Duration (minutes)</label>
              <input className="input" type="number" min={5} max={180}
                value={form.survey_duration_minutes}
                onChange={e => set('survey_duration_minutes', e.target.value)} />
            </div>
            <div>
              <label className="label">Honorarium Amount (₹)</label>
              <input className="input" type="number" min={0}
                value={form.honorarium_amount}
                onChange={e => set('honorarium_amount', e.target.value)}
                placeholder="Amount per business decision" />
            </div>
          </div>
        </div>

        {/* Budget / Org */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Organisational Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Division</label>
              <select className="input" value={form.division_id}
                onChange={e => set('division_id', e.target.value)}>
                <option value="">— Select Division —</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cost Center</label>
              <input className="input" value={form.cost_center}
                onChange={e => set('cost_center', e.target.value)} />
            </div>
            <div>
              <label className="label">Company Code</label>
              <input className="input" value={form.company_code}
                onChange={e => set('company_code', e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label className="label">Remarks</label>
              <textarea className="input" rows={2} value={form.remarks}
                onChange={e => set('remarks', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Doctor Selection */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Doctor / HCP</h3>
          <div className="flex gap-3 mb-4">
            <button type="button"
              onClick={() => setDoctorMode('mcl')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${doctorMode === 'mcl' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
              <UserCheck size={16} /> Select from MCL
            </button>
            <button type="button"
              onClick={() => setDoctorMode('new')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors
                ${doctorMode === 'new' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:border-blue-400'}`}>
              <UserPlus size={16} /> New Doctor
            </button>
          </div>

          {doctorMode === 'mcl' ? (
            <div className="space-y-3">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
                <input className="input pl-9" placeholder="Search doctor by name, speciality…"
                  value={doctorSearch}
                  onChange={e => { setDoctorSearch(e.target.value); setShowDoctorResults(true) }}
                  onFocus={() => setShowDoctorResults(true)} />
                {showDoctorResults && doctorResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {doctorResults.map(d => (
                      <button key={d.id} type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm"
                        onClick={() => selectDoctor(d)}>
                        <span className="font-medium">{d.full_name || d.first_name}</span>
                        <span className="text-gray-400 ml-2">• {d.qualification || d.doctor_type || 'Doctor'} • {d.city || '—'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedDoctor && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                  <p className="font-semibold text-blue-800">{selectedDoctor.full_name || selectedDoctor.first_name}</p>
                  <p className="text-blue-600">{selectedDoctor.qualification || selectedDoctor.doctor_type || '—'} • {selectedDoctor.city || '—'}</p>
                  <p className="text-blue-500 text-xs mt-1">{selectedDoctor.email || '—'} • {selectedDoctor.mobile_number || '—'}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Doctor Name <span className="text-red-500">*</span></label>
                <input className="input" value={form.new_doctor_name}
                  onChange={e => set('new_doctor_name', e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={form.new_doctor_email}
                  onChange={e => set('new_doctor_email', e.target.value)} />
              </div>
              <div>
                <label className="label">Mobile</label>
                <input className="input" type="tel" value={form.new_doctor_phone}
                  onChange={e => set('new_doctor_phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Speciality</label>
                <input className="input" value={form.new_doctor_speciality}
                  onChange={e => set('new_doctor_speciality', e.target.value)} />
              </div>
              <div>
                <label className="label">City</label>
                <input className="input" value={form.new_doctor_city}
                  onChange={e => set('new_doctor_city', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* KYC / Bank Details */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">KYC & Bank Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">PAN Number</label>
              <input className="input uppercase" value={form.pan_number}
                maxLength={10}
                onChange={e => set('pan_number', e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="label">Bank Name</label>
              <input className="input" value={form.bank_name}
                onChange={e => set('bank_name', e.target.value)} />
            </div>
            <div>
              <label className="label">Bank Account No</label>
              <input className="input" value={form.bank_account_no}
                onChange={e => set('bank_account_no', e.target.value)} />
            </div>
            <div>
              <label className="label">IFSC Code</label>
              <input className="input uppercase" value={form.ifsc_code}
                onChange={e => set('ifsc_code', e.target.value.toUpperCase())} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={() => navigate('/brs')}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating…' : 'Create BRS Application'}
          </button>
        </div>
      </form>
    </div>
  )
}
