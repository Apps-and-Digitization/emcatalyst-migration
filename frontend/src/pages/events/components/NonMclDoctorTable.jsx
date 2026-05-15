import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

const HCP_ROLES = ['Speaker', 'Moderator', 'Chairperson', 'Panellist', 'Advisor', 'Consultant', 'Others']

export default function NonMclDoctorTable({ doctors, setDoctors, fmvParams, addDoctor, hcpLimit = 0 }) {
  const [showNonMcl, setShowNonMcl] = useState(false)
  const [nonMclForm, setNonMclForm] = useState({ first_name: '', last_name: '', speciality: '', qualification: '', email: '', pan: '', role: '', experience: '', address: '' })

  const nonMclDoctors = doctors.filter(d => d.is_mcl === false)

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-semibold text-lg">Non-MCL HCP Doctor Details</h3>
          <p className="text-xs text-gray-500 mt-1">Selection Procedure For Non MCL HCP</p>
        </div>
        <button className="btn-secondary flex items-center gap-1 text-sm" onClick={() => {
          if (hcpLimit > 0 && doctors.length >= hcpLimit) {
            toast.error(`Cannot add more doctors. Limit is ${hcpLimit} (HCPs Delivering Professional Services)`)
            return
          }
          setShowNonMcl(true)
        }}><Plus size={14} /> Add Non-MCL HCP</button>
      </div>

      {showNonMcl && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <input className="input" placeholder="First Name *" value={nonMclForm.first_name} onChange={e => setNonMclForm(p => ({ ...p, first_name: e.target.value }))} />
            <input className="input" placeholder="Last Name" value={nonMclForm.last_name} onChange={e => setNonMclForm(p => ({ ...p, last_name: e.target.value }))} />
            <input className="input" placeholder="Speciality" value={nonMclForm.speciality} onChange={e => setNonMclForm(p => ({ ...p, speciality: e.target.value }))} />
            <input className="input" placeholder="Qualification" value={nonMclForm.qualification} onChange={e => setNonMclForm(p => ({ ...p, qualification: e.target.value }))} />
            <input className="input" placeholder="Email *" value={nonMclForm.email} onChange={e => setNonMclForm(p => ({ ...p, email: e.target.value }))} />
            <input className="input" placeholder="PAN No *" value={nonMclForm.pan} onChange={e => setNonMclForm(p => ({ ...p, pan: e.target.value }))} />
            <select className="input" value={nonMclForm.role} onChange={e => setNonMclForm(p => ({ ...p, role: e.target.value }))}><option value="">Role of HCP</option>{HCP_ROLES.map(r => <option key={r} value={r}>{r}</option>)}</select>
            <input type="number" className="input" placeholder="Years of Experience" value={nonMclForm.experience} onChange={e => setNonMclForm(p => ({ ...p, experience: e.target.value }))} />
            <input className="input" placeholder="Occupational Address" value={nonMclForm.address} onChange={e => setNonMclForm(p => ({ ...p, address: e.target.value }))} />
          </div>
          <div className="flex gap-2">
            <button className="btn-primary text-sm flex items-center gap-1" onClick={() => {
              if (!nonMclForm.first_name) { toast.error('First name is required'); return }
              if (hcpLimit > 0 && doctors.length >= hcpLimit) {
                toast.error(`Cannot add more doctors. Limit is ${hcpLimit} (HCPs Delivering Professional Services)`)
                return
              }
              addDoctor.mutate({
                doctor_name: `${nonMclForm.first_name} ${nonMclForm.last_name}`.trim(),
                specialization: nonMclForm.speciality || '',
                qualification: nonMclForm.qualification || '',
                email: nonMclForm.email || '',
                pan_number: nonMclForm.pan || '',
                role: nonMclForm.role || '',
                is_mcl: false,
              })
              setNonMclForm({ first_name: '', last_name: '', speciality: '', qualification: '', email: '', pan: '', role: '', experience: '', address: '' })
              setShowNonMcl(false)
            }}><Plus size={14} /> Add HCP</button>
            <button className="btn-secondary text-sm" onClick={() => setShowNonMcl(false)}>Cancel</button>
          </div>
        </div>
      )}

      {nonMclDoctors.length > 0 ? (
        <div className="overflow-x-auto border rounded-lg">
          <table className="text-xs w-full" style={{ minWidth: '1200px' }}>
            <thead className="bg-gray-100 border-b">
              <tr>
                {['Name', 'Email', 'Expertise', 'Clinical', 'Publish.', 'Congress', 'Position', 'Investig.', 'Pts', 'Cat', 'Rate(₹)', 'Derived', 'Honorarium(₹)', 'Cab(₹)', 'Flight(₹)', 'Accom(₹)', 'Speciality', 'PAN', ''].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {nonMclDoctors.map((d, i) => {
                const upd = (f, v) => setDoctors(prev => prev.map(x => x === d ? { ...x, [f]: v } : x))
                const pts = (parseInt(d.fmv_expertise_pts) || 0) + (parseInt(d.fmv_clinical_pts) || 0) + (parseInt(d.fmv_publications_pts) || 0) + (parseInt(d.fmv_congress_pts) || 0) + (parseInt(d.fmv_position_pts) || 0) + (parseInt(d.fmv_investigator_pts) || 0)
                let cat = 'C', rate = 5000, cap = 30000
                if (pts >= 19) { cat = 'A'; rate = 15000; cap = 75000 }
                else if (pts >= 10) { cat = 'B'; rate = 10000; cap = 50000 }
                return (
                  <tr key={d.id || `n${i}`} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 font-medium whitespace-nowrap">{d.doctor_name}</td>
                    <td className="px-2 py-1.5 text-gray-500">{d.email || '—'}</td>
                    <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_expertise_pts || ''} onChange={e => upd('fmv_expertise_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Area of Expertise'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                    <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_clinical_pts || ''} onChange={e => upd('fmv_clinical_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Clinical Practice Experience'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                    <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_publications_pts || ''} onChange={e => upd('fmv_publications_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Publications in literature'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                    <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_congress_pts || ''} onChange={e => upd('fmv_congress_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Prior experience of Congresses'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                    <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_position_pts || ''} onChange={e => upd('fmv_position_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Professional Position'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                    <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_investigator_pts || ''} onChange={e => upd('fmv_investigator_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Experience as an investigator in clinical trials'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                    <td className="px-2 py-1.5 font-bold text-center">{pts}</td>
                    <td className="px-2 py-1.5"><span className="px-1 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">{cat}</span></td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{rate.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap font-medium">{cap.toLocaleString('en-IN')}</td>
                    <td className="px-2 py-1.5"><input type="number" className="input py-0 px-1 text-xs w-20" value={d.honorarium || ''} onChange={e => { if (parseFloat(e.target.value) > cap) { toast.error(`Max ₹${cap.toLocaleString('en-IN')}`); return } upd('honorarium', e.target.value) }} /></td>
                    <td className="px-2 py-1.5"><input type="number" className="input py-0 px-1 text-xs w-16" value={d.cab_cost || ''} onChange={e => upd('cab_cost', e.target.value)} /></td>
                    <td className="px-2 py-1.5"><input type="number" className="input py-0 px-1 text-xs w-16" value={d.flight_cost || ''} onChange={e => upd('flight_cost', e.target.value)} /></td>
                    <td className="px-2 py-1.5"><input type="number" className="input py-0 px-1 text-xs w-16" value={d.accommodation_cost || ''} onChange={e => upd('accommodation_cost', e.target.value)} /></td>
                    <td className="px-2 py-1.5 text-gray-500">{d.specialization || '—'}</td>
                    <td className="px-2 py-1.5 font-mono">{d.pan_number || '—'}</td>
                    <td className="px-2 py-1.5"><button className="text-red-400 hover:text-red-600" onClick={() => setDoctors(prev => prev.filter(x => x !== d))}><Trash2 size={12} /></button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed rounded-lg">No Non-MCL HCPs added.</div>
      )}
    </div>
  )
}
