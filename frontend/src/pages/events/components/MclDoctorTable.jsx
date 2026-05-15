import { Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MclDoctorTable({ doctors, setDoctors, fmvParams = {} }) {
  const mclDoctors = (doctors || []).filter(d => d.is_mcl !== false)

  if (mclDoctors.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400 text-sm border-2 border-dashed rounded-lg">
        No MCL HCPs added. Click "Search MCL" to find and add doctors.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border rounded-lg">
      <table className="text-xs w-full" style={{ minWidth: '1400px' }}>
        <thead className="bg-gray-100 border-b">
          <tr>
            {['Name', 'PAN', 'Email', 'Expertise', 'Clinical', 'Publish.', 'Congress', 'Position', 'Investig.', 'Pts', 'Cat', 'Rate(₹)', 'Derived', 'Honorarium(₹)', 'Cab(₹)', 'Flight(₹)', 'Accom(₹)', 'Remark', ''].map(h => (
              <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {mclDoctors.map((d, i) => {
            const upd = (f, v) => setDoctors(prev => prev.map(x => x === d ? { ...x, [f]: v } : x))
            const pts = (parseInt(d.fmv_expertise_pts) || 0) + (parseInt(d.fmv_clinical_pts) || 0) + (parseInt(d.fmv_publications_pts) || 0) + (parseInt(d.fmv_congress_pts) || 0) + (parseInt(d.fmv_position_pts) || 0) + (parseInt(d.fmv_investigator_pts) || 0)
            let cat = 'C', rate = 5000, cap = 30000
            if (pts >= 19) { cat = 'A'; rate = 15000; cap = 75000 }
            else if (pts >= 10) { cat = 'B'; rate = 10000; cap = 50000 }
            return (
              <tr key={d.id || `m${i}`} className="hover:bg-gray-50">
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{d.doctor_name}</td>
                <td className="px-2 py-1.5"><input className="input py-0 px-1 text-xs w-24" value={d.pan_number || ''} onChange={e => upd('pan_number', e.target.value)} /></td>
                <td className="px-2 py-1.5"><input className="input py-0 px-1 text-xs w-28" value={d.email || ''} onChange={e => upd('email', e.target.value)} /></td>
                <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_expertise_pts || ''} onChange={e => upd('fmv_expertise_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Area of Expertise'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_clinical_pts || ''} onChange={e => upd('fmv_clinical_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Clinical Practice Experience'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_publications_pts || ''} onChange={e => upd('fmv_publications_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Publications in literature'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_congress_pts || ''} onChange={e => upd('fmv_congress_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Prior experience of Congresses'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_position_pts || ''} onChange={e => upd('fmv_position_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Professional Position'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                <td className="px-2 py-1.5"><select className="input py-0 px-0.5 text-xs w-44" value={d.fmv_investigator_pts || ''} onChange={e => upd('fmv_investigator_pts', parseInt(e.target.value) || 0)}><option value="">-</option>{(fmvParams['Experience as an investigator in clinical trials'] || []).map(o => <option key={o.id} value={o.points}>{o.option_code}) {o.option_label}</option>)}</select></td>
                <td className="px-2 py-1.5 font-bold text-center">{pts}</td>
                <td className="px-2 py-1.5"><span className="px-1 py-0.5 bg-[var(--color-primary-100)] text-[var(--color-primary)] rounded text-xs font-bold">{cat}</span></td>
                <td className="px-2 py-1.5 whitespace-nowrap">{rate.toLocaleString('en-IN')}</td>
                <td className="px-2 py-1.5 whitespace-nowrap font-medium">{cap.toLocaleString('en-IN')}</td>
                <td className="px-2 py-1.5"><input type="number" className="input py-0 px-1 text-xs w-20" value={d.honorarium || ''} onChange={e => { if (parseFloat(e.target.value) > cap) { toast.error(`Max ₹${cap.toLocaleString('en-IN')}`); return } upd('honorarium', e.target.value) }} /></td>
                <td className="px-2 py-1.5"><input type="number" className="input py-0 px-1 text-xs w-16" value={d.cab_cost || ''} onChange={e => upd('cab_cost', e.target.value)} /></td>
                <td className="px-2 py-1.5"><input type="number" className="input py-0 px-1 text-xs w-16" value={d.flight_cost || ''} onChange={e => upd('flight_cost', e.target.value)} /></td>
                <td className="px-2 py-1.5"><input type="number" className="input py-0 px-1 text-xs w-16" value={d.accommodation_cost || ''} onChange={e => upd('accommodation_cost', e.target.value)} /></td>
                <td className="px-2 py-1.5"><input className="input py-0 px-1 text-xs w-20" value={d.remark || ''} onChange={e => upd('remark', e.target.value)} /></td>
                <td className="px-2 py-1.5"><button className="text-red-400 hover:text-red-600" onClick={() => setDoctors(prev => prev.filter(x => x !== d))}><Trash2 size={12} /></button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
