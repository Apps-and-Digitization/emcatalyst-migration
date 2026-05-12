import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  ArrowLeft, Search, UserCheck, Trash2, Upload, Plus, Info
} from 'lucide-react'
import { brsApi, masterApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'

export default function BrsBulkForm() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    survey_title: '',
    therapeutic_area: '',
    brand: '',
    topic: '',
    mode: 'Online',
    survey_duration_days: 7,
    honorarium_amount: '',
    division_id: '',
    cost_center: '',
    company_code: '',
    remarks: '',
    survey_id: '',
  })

  const [doctors, setDoctors] = useState([])
  const [doctorSearch, setDoctorSearch] = useState('')
  const [showDoctorResults, setShowDoctorResults] = useState(false)

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
    mutationFn: (data) => brsApi.bulkCreate(data),
    onSuccess: (res) => {
      toast.success(`Bulk request ${res.data.bulk_code} created with ${res.data.total_doctors} doctors`)
      navigate(`/brs/bulk/${res.data.id}`)
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Failed to create bulk request'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const addDoctorFromMCL = (d) => {
    const already = doctors.some(x => x.hcp_doctor_id === d.id)
    if (already) return toast.error('Doctor already added')
    setDoctors(prev => [...prev, {
      hcp_doctor_id: d.id,
      name: d.full_name || d.first_name || '',
      email: d.email || '',
      phone: d.mobile_number || '',
      speciality: d.qualification || d.doctor_type || '',
      city: d.city || '',
      source: 'mcl',
    }])
    setDoctorSearch('')
    setShowDoctorResults(false)
  }

  const removeDoctor = (idx) => setDoctors(prev => prev.filter((_, i) => i !== idx))

  const handleCsvUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const lines = ev.target.result.split('\n').filter(l => l.trim())
      const added = []
      let skipped = 0
      for (const line of lines) {
        const parts = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''))
        // Skip header row
        if (parts[0]?.toLowerCase() === 'name' || parts[0]?.toLowerCase() === 'doctor name') continue
        if (parts.length < 2) { skipped++; continue }
        const [name, email, phone, speciality, city] = parts
        if (!name || !email) { skipped++; continue }
        added.push({ hcp_doctor_id: null, name, email: email || '', phone: phone || '',
          speciality: speciality || '', city: city || '', source: 'csv' })
      }
      setDoctors(prev => [...prev, ...added])
      toast.success(`Added ${added.length} doctors from CSV${skipped ? ` (${skipped} rows skipped)` : ''}`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.survey_title.trim()) return toast.error('Survey title is required')
    if (doctors.length === 0) return toast.error('Add at least one doctor')

    const payload = {
      ...form,
      honorarium_amount: form.honorarium_amount ? parseFloat(form.honorarium_amount) : null,
      survey_duration_days: parseInt(form.survey_duration_days) || 7,
      division_id: form.division_id ? parseInt(form.division_id) : null,
      survey_id: form.survey_id ? parseInt(form.survey_id) : null,
      doctors: doctors.map(d => ({
        hcp_doctor_id: d.hcp_doctor_id,
        name: d.name, email: d.email, phone: d.phone,
        speciality: d.speciality, city: d.city,
      })),
    }
    createMutation.mutate(payload)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="New Bulk BRS Request"
        subtitle="Send the same survey to multiple doctors at once"
        actions={
          <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/brs/bulk')}>
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
              <select className="input" value={form.survey_id} onChange={e => set('survey_id', e.target.value)}>
                <option value="">— Select Survey Template —</option>
                {surveys.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
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
              <select className="input" value={form.therapeutic_area} onChange={e => set('therapeutic_area', e.target.value)}>
                <option value="">— Select —</option>
                {therapeutics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Brand</label>
              <select className="input" value={form.brand} onChange={e => set('brand', e.target.value)}>
                <option value="">— Select —</option>
                {brands.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Topic / Agenda</label>
              <textarea className="input" rows={3} value={form.topic} onChange={e => set('topic', e.target.value)}
                placeholder="Describe the survey topic and research objectives…" />
            </div>
            <div>
              <label className="label">Survey Duration (days)</label>
              <input className="input" type="number" min={1} max={90} value={form.survey_duration_days}
                onChange={e => set('survey_duration_days', e.target.value)} />
            </div>
            <div>
              <label className="label">Honorarium Amount (₹)</label>
              <input className="input" type="number" min={0} value={form.honorarium_amount}
                onChange={e => set('honorarium_amount', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Org Details */}
        <div className="card p-6">
          <h3 className="font-semibold text-gray-800 mb-4 border-b pb-2">Organisational Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="label">Division</label>
              <select className="input" value={form.division_id} onChange={e => set('division_id', e.target.value)}>
                <option value="">— Select Division —</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Cost Center</label>
              <input className="input" value={form.cost_center} onChange={e => set('cost_center', e.target.value)} />
            </div>
            <div>
              <label className="label">Company Code</label>
              <input className="input" value={form.company_code} onChange={e => set('company_code', e.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label className="label">Remarks</label>
              <textarea className="input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Doctor Selection */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 border-b pb-2">
            <h3 className="font-semibold text-gray-800">Doctors / HCPs
              <span className="ml-2 text-sm font-normal text-gray-500">({doctors.length} added)</span>
            </h3>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-secondary flex items-center gap-1.5 text-sm py-1.5 px-3">
                <Upload size={14} /> Import CSV
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvUpload} />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700 flex gap-2 mb-4">
            <Info size={14} className="shrink-0 mt-0.5" />
            <span>CSV format: <strong>Name, Email, Mobile, Speciality, City</strong> (one doctor per row, header row optional). MCL doctors are linked automatically by searching below.</span>
          </div>

          {/* MCL Search */}
          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
            <input className="input pl-9" placeholder="Search MCL doctors by name, speciality…"
              value={doctorSearch}
              onChange={e => { setDoctorSearch(e.target.value); setShowDoctorResults(true) }}
              onFocus={() => setShowDoctorResults(true)} />
            {showDoctorResults && doctorResults.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                {doctorResults.map(d => (
                  <button key={d.id} type="button"
                    className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm flex items-center justify-between"
                    onClick={() => addDoctorFromMCL(d)}>
                    <span>
                      <span className="font-medium">{d.full_name || d.first_name}</span>
                      <span className="text-gray-400 ml-2">• {d.qualification || d.doctor_type || 'Doctor'} • {d.city || '—'}</span>
                    </span>
                    <Plus size={14} className="text-blue-500 shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Doctor Table */}
          {doctors.length > 0 ? (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {['#', 'Name', 'Email', 'Mobile', 'Speciality', 'City', 'Source', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {doctors.map((d, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{d.name}</td>
                      <td className="px-3 py-2 text-gray-600">{d.email || '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{d.phone || '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{d.speciality || '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{d.city || '—'}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${d.source === 'mcl' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                          {d.source === 'mcl' ? 'MCL' : 'CSV'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => removeDoctor(i)}
                          className="text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border-2 border-dashed border-gray-200 rounded-lg py-10 text-center text-gray-400">
              <UserCheck size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">Search for MCL doctors above, or import a CSV file</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" className="btn-secondary" onClick={() => navigate('/brs/bulk')}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={createMutation.isPending || doctors.length === 0}>
            {createMutation.isPending ? 'Creating…' : `Create Bulk Request (${doctors.length} doctors)`}
          </button>
        </div>
      </form>
    </div>
  )
}
