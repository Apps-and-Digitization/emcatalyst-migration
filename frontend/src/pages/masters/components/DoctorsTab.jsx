import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Edit2, Trash2, Upload } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi, accessApi } from '../../../api/endpoints'
import api from '../../../api/client'
import LoadingSpinner from '../../../components/ui/LoadingSpinner'
import Modal from '../../../components/ui/Modal'
import useAuthStore from '../../../store/authStore'
import useAccessStore from '../../../store/accessStore'
import useJobStore from '../../../store/jobStore'

const PAGE_SIZE = 50

export default function DoctorsTab() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'Administrator' || user?.is_superuser
  const { accessiblePages } = useAccessStore()
  const canAdd = accessiblePages.includes('masters_doctors_add')
  const canEdit = accessiblePages.includes('masters_doctors_edit')
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [territoryFilter, setTerritoryFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [importing, setImporting] = useState(false)
  const [addForm, setAddForm] = useState({ full_name: '', first_name: '', last_name: '', middle_name: '', division_ids: [], territory_ids: [], uid_number: '', qualification: '', speciality: '', email: '', pan_number: '', city: '', state: '', town_name: '', mobile_number: '', doctor_type: '', gender: '', area_of_practice: '', hourly_rate: '', max_capping: '' })

  const { data: states = [] } = useQuery({
    queryKey: ['master-states'],
    queryFn: () => masterApi.states().then(r => r.data),
  })

  const { data: divisions = [] } = useQuery({
    queryKey: ['divisions'],
    queryFn: () => accessApi.listDivisions().then(r => r.data),
  })

  const { data: allTerritories = [] } = useQuery({
    queryKey: ['master-territories-all'],
    queryFn: () => masterApi.territories().then(r => r.data),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['doctors-all', search, stateFilter, territoryFilter, page],
    queryFn: () => masterApi.hcpDoctorsAll({
      q: search || undefined,
      state: stateFilter || undefined,
      territory_id: territoryFilter || undefined,
      skip: (page - 1) * PAGE_SIZE,
      limit: PAGE_SIZE,
    }).then(r => r.data),
  })

  const doctors = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : []
  const totalDoctors = data?.total || doctors.length

  const createDoctor = useMutation({
    mutationFn: () => {
      const payload = {}
      for (const [k, v] of Object.entries(addForm)) { if (v && k !== 'division_ids' && k !== 'territory_ids') payload[k] = v }
      if (!payload.full_name) payload.full_name = `${payload.first_name || ''} ${payload.middle_name || ''} ${payload.last_name || ''}`.trim().replace(/\s+/g, ' ')
      if (!payload.full_name) payload.full_name = 'Unknown'
      if (addForm.division_ids.length > 0) payload.division_ids = addForm.division_ids.join(',')
      if (addForm.territory_ids.length > 0) payload.territory_ids = addForm.territory_ids.join(',')
      return masterApi.createHcpDoctor(payload)
    },
    onSuccess: () => {
      qc.invalidateQueries(['doctors-all'])
      setShowAdd(false)
      setAddForm({ full_name: '', first_name: '', last_name: '', middle_name: '', division_ids: [], territory_ids: [], uid_number: '', qualification: '', speciality: '', email: '', pan_number: '', city: '', state: '', town_name: '', mobile_number: '', doctor_type: '', gender: '', area_of_practice: '', hourly_rate: '', max_capping: '' })
      toast.success('Doctor added')
    },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error adding doctor'),
  })

  const deleteDoctor = useMutation({
    mutationFn: (id) => masterApi.deleteHcpDoctor(id),
    onSuccess: () => { qc.invalidateQueries(['doctors-all']); toast.success('Doctor deleted') },
    onError: () => toast.error('Error deleting'),
  })

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by name, PAN, email, city…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select className="input w-48" value={stateFilter} onChange={e => { setStateFilter(e.target.value); setPage(1) }}>
          <option value="">All States</option>
          {states.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
        <select className="input w-48" value={territoryFilter} onChange={e => { setTerritoryFilter(e.target.value); setPage(1) }}>
          <option value="">All Territories</option>
          {allTerritories.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {canAdd && <button className="btn-primary flex items-center gap-2 text-sm" onClick={() => setShowAdd(true)}>
          <Plus size={14} /> Add Doctor
        </button>}
        {canAdd && <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
          <Upload size={14} /> Import Excel
          <input type="file" className="hidden" accept=".xlsx,.xls"
            onClick={e => { e.target.value = null }}
            onChange={async e => {
              const file = e.target.files[0]
              if (!file) return
              setImporting(true)
              const formData = new FormData()
              formData.append('file', file)
              try {
                const res = await api.post('/import/mcl', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
                const { job_id } = res.data
                useJobStore.getState().addJob(job_id)
                toast.success(`Import started: ${res.data.file_name} (${res.data.file_size_mb} MB) — check the progress panel`)
              } catch (err) {
                toast.error(err.response?.data?.detail || 'Import failed')
              } finally {
                setImporting(false)
              }
            }}
          />
        </label>}
      </div>

      {/* Add Doctor Form */}
      {showAdd && (
        <div className="mb-4 p-4 bg-[var(--color-primary-50)] border border-[var(--color-primary-100)] rounded-lg space-y-3">
          <p className="text-sm font-medium text-[var(--color-primary-hover)]">Add New MCL Doctor</p>
          <div className="grid grid-cols-4 gap-3">
            <input className="input" placeholder="First Name *" value={addForm.first_name} onChange={e => setAddForm(p => ({...p, first_name: e.target.value}))} />
            <input className="input" placeholder="Middle Name" value={addForm.middle_name} onChange={e => setAddForm(p => ({...p, middle_name: e.target.value}))} />
            <input className="input" placeholder="Last Name" value={addForm.last_name} onChange={e => setAddForm(p => ({...p, last_name: e.target.value}))} />
            <div className="col-span-2">
              <label className="label">Divisions</label>
              <div className="border rounded-lg p-2 max-h-24 overflow-y-auto grid grid-cols-4 gap-1">
                {divisions.map(d => (
                  <label key={d.id} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={addForm.division_ids.includes(String(d.id))} onChange={e => {
                      if (e.target.checked) setAddForm(p => ({...p, division_ids: [...p.division_ids, String(d.id)]}))
                      else setAddForm(p => ({...p, division_ids: p.division_ids.filter(x => x !== String(d.id))}))
                    }} />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="label">Territories</label>
              <div className="border rounded-lg p-2 max-h-24 overflow-y-auto grid grid-cols-4 gap-1">
                {allTerritories
                  .filter(t => addForm.division_ids.length === 0 || addForm.division_ids.includes(String(t.division_id)))
                  .map(t => (
                  <label key={t.id} className="flex items-center gap-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={addForm.territory_ids.includes(String(t.id))} onChange={e => {
                      if (e.target.checked) setAddForm(p => ({...p, territory_ids: [...p.territory_ids, String(t.id)]}))
                      else setAddForm(p => ({...p, territory_ids: p.territory_ids.filter(x => x !== String(t.id))}))
                    }} />
                    {t.name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Filtered by selected divisions</p>
            </div>
            <input className="input" placeholder="UID Number" value={addForm.uid_number} onChange={e => setAddForm(p => ({...p, uid_number: e.target.value}))} />
            <input className="input" placeholder="Qualification" value={addForm.qualification} onChange={e => setAddForm(p => ({...p, qualification: e.target.value}))} />
            <input className="input" placeholder="Speciality" value={addForm.speciality} onChange={e => setAddForm(p => ({...p, speciality: e.target.value}))} />
            <input className="input" placeholder="Doctor Type" value={addForm.doctor_type} onChange={e => setAddForm(p => ({...p, doctor_type: e.target.value}))} />
            <select className="input" value={addForm.gender} onChange={e => setAddForm(p => ({...p, gender: e.target.value}))}>
              <option value="">Gender</option>
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <input className="input" placeholder="Email" value={addForm.email} onChange={e => setAddForm(p => ({...p, email: e.target.value}))} />
            <input className="input" placeholder="PAN Number" value={addForm.pan_number} onChange={e => setAddForm(p => ({...p, pan_number: e.target.value}))} />
            <input className="input" placeholder="Mobile" value={addForm.mobile_number} onChange={e => setAddForm(p => ({...p, mobile_number: e.target.value}))} />
            <input className="input" placeholder="City" value={addForm.city} onChange={e => setAddForm(p => ({...p, city: e.target.value}))} />
            <input className="input" placeholder="State" value={addForm.state} onChange={e => setAddForm(p => ({...p, state: e.target.value}))} />
            <input className="input" placeholder="Town Name" value={addForm.town_name} onChange={e => setAddForm(p => ({...p, town_name: e.target.value}))} />
            <input className="input" placeholder="Area of Practice" value={addForm.area_of_practice} onChange={e => setAddForm(p => ({...p, area_of_practice: e.target.value}))} />
            <input type="number" className="input" placeholder="Hourly Rate (₹)" value={addForm.hourly_rate} onChange={e => setAddForm(p => ({...p, hourly_rate: e.target.value}))} />
            <input type="number" className="input" placeholder="Max Capping (₹)" value={addForm.max_capping} onChange={e => setAddForm(p => ({...p, max_capping: e.target.value}))} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-sm" onClick={() => createDoctor.mutate()}>Save Doctor</button>
            <button className="btn-secondary text-sm" onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <LoadingSpinner /> : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['UID', 'Name', 'Speciality', 'City/State', 'Division', 'Territory', 'Mobile', 'Type', 'Actions'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {doctors.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-[var(--color-primary)]">{d.uid_number || '—'}</td>
                  <td className="px-3 py-2 font-medium">{d.full_name || [d.first_name, d.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{d.speciality || d.qualification || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{[d.city, d.state].filter(Boolean).join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{d.divisions?.map(div => div.name).join(', ') || d.division || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{d.territories?.map(t => t.name).join(', ') || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{d.mobile_number || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{d.doctor_type || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      {canEdit && <button className="text-xs text-[var(--color-primary)] hover:underline" onClick={() => setSelectedDoc(d)}>
                        <Edit2 size={12} />
                      </button>}
                      {canEdit && isAdmin && <button className="text-xs text-red-500 hover:underline" onClick={(ev) => { ev.stopPropagation(); if (confirm('Delete this doctor?')) deleteDoctor.mutate(d.id) }}>
                        <Trash2 size={12} />
                      </button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalDoctors > PAGE_SIZE && (
            <div className="flex justify-between items-center px-4 py-3 border-t text-sm text-gray-500">
              <span>Showing {(page - 1) * PAGE_SIZE + 1}–{(page - 1) * PAGE_SIZE + doctors.length} of {totalDoctors}</span>
              <div className="flex gap-2">
                <button className="btn-secondary py-1 px-3 text-xs" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
                <button className="btn-secondary py-1 px-3 text-xs" disabled={(page * PAGE_SIZE) >= totalDoctors} onClick={() => setPage(p => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Doctor detail/edit modal */}
      <Modal open={!!selectedDoc} onClose={() => setSelectedDoc(null)} title="Edit Doctor" size="lg">
        {selectedDoc && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Full Name</label><input className="input" value={selectedDoc.full_name || ''} onChange={e => setSelectedDoc(p => ({...p, full_name: e.target.value}))} /></div>
              <div><label className="label">First Name</label><input className="input" value={selectedDoc.first_name || ''} onChange={e => setSelectedDoc(p => ({...p, first_name: e.target.value}))} /></div>
              <div><label className="label">Last Name</label><input className="input" value={selectedDoc.last_name || ''} onChange={e => setSelectedDoc(p => ({...p, last_name: e.target.value}))} /></div>
              <div className="col-span-3">
                <label className="label">Divisions</label>
                <div className="border rounded-lg p-2 max-h-24 overflow-y-auto grid grid-cols-4 gap-1">
                  {divisions.map(d => {
                    const currentIds = selectedDoc._divIds || (selectedDoc.divisions || []).map(div => div.id)
                    return (
                      <label key={d.id} className="flex items-center gap-1 text-xs cursor-pointer">
                        <input type="checkbox" checked={currentIds.includes(d.id)} onChange={e => {
                          const ids = [...currentIds]
                          if (e.target.checked) ids.push(d.id)
                          else ids.splice(ids.indexOf(d.id), 1)
                          setSelectedDoc(p => ({...p, _divIds: ids}))
                        }} />
                        {d.name}
                      </label>
                    )
                  })}
                </div>
              </div>
              <div className="col-span-3">
                <label className="label">Territories</label>
                <div className="border rounded-lg p-2 max-h-24 overflow-y-auto grid grid-cols-4 gap-1">
                  {(() => {
                    const currentDivIds = selectedDoc._divIds || (selectedDoc.divisions || []).map(div => div.id)
                    const currentTerritoryIds = selectedDoc._terrIds || (selectedDoc.territories || []).map(t => t.id)
                    return allTerritories
                      .filter(t => currentDivIds.length === 0 || currentDivIds.includes(t.division_id))
                      .map(t => (
                        <label key={t.id} className="flex items-center gap-1 text-xs cursor-pointer">
                          <input type="checkbox" checked={currentTerritoryIds.includes(t.id)} onChange={e => {
                            const ids = [...currentTerritoryIds]
                            if (e.target.checked) ids.push(t.id)
                            else ids.splice(ids.indexOf(t.id), 1)
                            setSelectedDoc(p => ({...p, _terrIds: ids}))
                          }} />
                          {t.name}
                        </label>
                      ))
                  })()}
                </div>
                <p className="text-xs text-gray-400 mt-1">Filtered by selected divisions</p>
              </div>
              <div><label className="label">UID Number</label><input className="input" value={selectedDoc.uid_number || ''} onChange={e => setSelectedDoc(p => ({...p, uid_number: e.target.value}))} /></div>
              <div><label className="label">Qualification</label><input className="input" value={selectedDoc.qualification || ''} onChange={e => setSelectedDoc(p => ({...p, qualification: e.target.value}))} /></div>
              <div><label className="label">Speciality</label><input className="input" value={selectedDoc.speciality || ''} onChange={e => setSelectedDoc(p => ({...p, speciality: e.target.value}))} /></div>
              <div><label className="label">Doctor Type</label><input className="input" value={selectedDoc.doctor_type || ''} onChange={e => setSelectedDoc(p => ({...p, doctor_type: e.target.value}))} /></div>
              <div><label className="label">Gender</label>
                <select className="input" value={selectedDoc.gender || ''} onChange={e => setSelectedDoc(p => ({...p, gender: e.target.value}))}>
                  <option value="">Select</option><option value="M">Male</option><option value="F">Female</option>
                </select>
              </div>
              <div><label className="label">City</label><input className="input" value={selectedDoc.city || ''} onChange={e => setSelectedDoc(p => ({...p, city: e.target.value}))} /></div>
              <div><label className="label">State</label><input className="input" value={selectedDoc.state || ''} onChange={e => setSelectedDoc(p => ({...p, state: e.target.value}))} /></div>
              <div><label className="label">Town</label><input className="input" value={selectedDoc.town_name || ''} onChange={e => setSelectedDoc(p => ({...p, town_name: e.target.value}))} /></div>
              <div><label className="label">Mobile</label><input className="input" value={selectedDoc.mobile_number || ''} onChange={e => setSelectedDoc(p => ({...p, mobile_number: e.target.value}))} /></div>
              <div><label className="label">Email</label><input className="input" value={selectedDoc.email || ''} onChange={e => setSelectedDoc(p => ({...p, email: e.target.value}))} /></div>
              <div><label className="label">PAN Number</label><input className="input" value={selectedDoc.pan_number || ''} onChange={e => setSelectedDoc(p => ({...p, pan_number: e.target.value}))} /></div>
              <div><label className="label">Area of Practice</label><input className="input" value={selectedDoc.area_of_practice || ''} onChange={e => setSelectedDoc(p => ({...p, area_of_practice: e.target.value}))} /></div>
              <div><label className="label">PAN Number</label><input className="input" value={selectedDoc.pan_number || ''} onChange={e => setSelectedDoc(p => ({...p, pan_number: e.target.value}))} /></div>
              <div><label className="label">Hourly Rate (₹)</label><input type="number" className="input" value={selectedDoc.hourly_rate || ''} onChange={e => setSelectedDoc(p => ({...p, hourly_rate: e.target.value}))} /></div>
              <div><label className="label">Max Capping (₹)</label><input type="number" className="input" value={selectedDoc.max_capping || ''} onChange={e => setSelectedDoc(p => ({...p, max_capping: e.target.value}))} /></div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button className="btn-secondary" onClick={() => setSelectedDoc(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => {
                const data = {}
                const editableFields = ['full_name', 'first_name', 'last_name', 'middle_name', 'uid_number', 'qualification', 'speciality', 'doctor_type', 'gender', 'city', 'state', 'town_name', 'mobile_number', 'email', 'pan_number', 'area_of_practice', 'hourly_rate', 'max_capping']
                for (const field of editableFields) {
                  if (selectedDoc[field] !== null && selectedDoc[field] !== undefined) {
                    data[field] = selectedDoc[field]
                  }
                }
                const divIds = selectedDoc._divIds || (selectedDoc.divisions || []).map(d => d.id)
                if (divIds.length > 0) data.division_ids = divIds.join(',')
                else data.division_ids = ''
                const terrIds = selectedDoc._terrIds || (selectedDoc.territories || []).map(t => t.id)
                if (terrIds.length > 0) data.territory_ids = terrIds.join(',')
                else data.territory_ids = ''
                masterApi.updateHcpDoctor(selectedDoc.id, data).then(() => {
                  qc.invalidateQueries(['doctors-all'])
                  setSelectedDoc(null)
                  toast.success('Doctor updated')
                }).catch(() => toast.error('Error updating'))
              }}>Save Changes</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
