import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Search, Save, Plus, Trash2, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { masterApi, accessApi } from '../../../api/endpoints'
import MclDoctorTable from './MclDoctorTable'
import NonMclDoctorTable from './NonMclDoctorTable'
import DoctorSearchModal from '../../../components/DoctorSearchModal'

export default function EventFormStep3({
  register, saving, getValues, watch, setValue,
  doctors, setDoctors, fmvParams,
  eventMeals, setEventMeals,
  doctorSearchOpen, setDoctorSearchOpen,
  addDoctor, onSave, onBack, checkBudget,
}) {
  const [selectedMeal, setSelectedMeal] = useState('')
  const [mealCost, setMealCost] = useState('')
  const [showAttendeeModal, setShowAttendeeModal] = useState(false)
  const [selectedAttendees, setSelectedAttendees] = useState([])
  const [hcpCount, setHcpCount] = useState(getValues ? (getValues('num_hcps_professional_services') || '') : '')
  const [proposedHcps, setProposedHcps] = useState(getValues ? (getValues('proposed_num_hcps') || '') : '')
  const [attendeeSearch, setAttendeeSearch] = useState('')

  const { data: hierarchyUsers = [] } = useQuery({
    queryKey: ['hierarchy-full'],
    queryFn: () => accessApi.fullHierarchy().then(r => r.data),
  })

  const { data: mealsMaster = [] } = useQuery({
    queryKey: ['master-meals'],
    queryFn: () => masterApi.meals().then(r => r.data),
  })

  // Calculations
  const emcureAttendees = selectedAttendees.length
  const hcpsProfessionalCalc = parseInt(hcpCount) || 0
  const proposedHcpsCalc = parseInt(proposedHcps) || 0
  const totalAttendees = emcureAttendees + hcpsProfessionalCalc + proposedHcpsCalc
  const totalMealCostPerHead = eventMeals.reduce((sum, m) => sum + (parseFloat(m.cost_per_attendee) || 0), 0)
  const totalMealCost = totalMealCostPerHead * totalAttendees
  const avCost = parseFloat(watch?.('av_platform_cost')) || 0
  const hallCharges = parseFloat(watch?.('venue_charges')) || 0
  const totalEventCost = avCost + hallCharges + totalMealCost

  const addMeal = () => {
    if (!selectedMeal) { toast.error('Select a meal'); return }
    const meal = mealsMaster.find(m => m.name === selectedMeal)
    const cost = parseFloat(mealCost) || 0
    if (meal?.max_cost && cost > meal.max_cost) {
      toast.error(`Cost cannot exceed ₹${Number(meal.max_cost).toLocaleString('en-IN')} for ${meal.name}`)
      return
    }
    setEventMeals(prev => [...prev, { meal_name: selectedMeal, max_cost: meal?.max_cost || null, cost_per_attendee: cost }])
    setSelectedMeal('')
    setMealCost('')
  }

  return (
    <div className="space-y-6">
      <div className="card space-y-5">
        <h3 className="text-lg font-bold">Event Details</h3>

        {/* Row 1: Attendees & HCP counts */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="label">Proposed Number Of Emcure Attendees</label>
            <div className="flex gap-2">
              <input type="number" className="input bg-gray-50 flex-1" value={selectedAttendees.length} disabled />
              <button type="button" className="btn-secondary text-xs flex items-center gap-1 shrink-0" onClick={() => setShowAttendeeModal(true)}>
                <Users size={14} /> Select
              </button>
            </div>
            <input type="hidden" {...register('proposed_emcure_attendees')} />
          </div>
          <div>
            <label className="label">Number of HCPs Delivering Professional Services *</label>
            <input type="number" className="input" value={hcpCount} onChange={e => { setHcpCount(e.target.value); setValue('num_hcps_professional_services', e.target.value) }} placeholder="" min="1" />
            <input type="hidden" {...register('num_hcps_professional_services')} />
          </div>
          <div>
            <label className="label">Proposed Number Of HCPs *</label>
            <input type="number" className="input" value={proposedHcps} onChange={e => { setProposedHcps(e.target.value); setValue('proposed_num_hcps', e.target.value) }} placeholder="0" min="1" />
            <input type="hidden" {...register('proposed_num_hcps')} />
          </div>
          <div>
            <label className="label">Minimum Guarantee (Pax)</label>
            <input type="number" className="input bg-gray-50" value={totalAttendees} disabled />
          </div>
        </div>

        {/* Row 2: Costs */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="label">Audio/Video & Platform Cost (₹)</label>
            <input type="number" className="input" {...register('av_platform_cost')} placeholder="0" />
          </div>
          <div>
            <label className="label">Hall Charges (₹)</label>
            <input type="number" className="input" {...register('venue_charges')} placeholder="0" />
          </div>
          <div>
            <label className="label">Total Cost For Meals And Beverages (₹)</label>
            <input type="number" className="input bg-gray-50" value={totalMealCost} disabled />
          </div>
          <div>
            <label className="label">Total Event Cost (₹)</label>
            <input type="number" className="input bg-gray-50" value={totalEventCost} disabled />
          </div>
        </div>

        {/* Meals Section */}
        <div className="border-t pt-4">
          <div className="flex gap-3 items-end mb-3">
            <div className="flex-1">
              <label className="label">Meal</label>
              <select className="input" value={selectedMeal} onChange={e => setSelectedMeal(e.target.value)}>
                <option value="">Select meal</option>
                {mealsMaster.map(m => <option key={m.id} value={m.name}>{m.name} {m.max_cost ? `(Max ₹${Number(m.max_cost).toLocaleString('en-IN')})` : ''}</option>)}
              </select>
            </div>
            <div className="w-40">
              <label className="label">Meal Cost</label>
              <input type="number" className="input" value={mealCost} onChange={e => setMealCost(e.target.value)} placeholder="0" />
            </div>
            <button type="button" className="btn-primary h-10" onClick={addMeal}>Add</button>
          </div>

          {eventMeals.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50"><tr>
                  <th className="px-4 py-2 text-left text-xs text-gray-500">Meal</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500">Max Capping (₹)</th>
                  <th className="px-4 py-2 text-left text-xs text-gray-500">Cost Per Attendee (₹)</th>
                  <th className="px-4 py-2"></th>
                </tr></thead>
                <tbody className="divide-y">
                  {eventMeals.map((m, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium">{m.meal_name}</td>
                      <td className="px-4 py-2 text-gray-500">{m.max_cost ? `₹${Number(m.max_cost).toLocaleString('en-IN')}` : '—'}</td>
                      <td className="px-4 py-2 font-medium">₹{Number(m.cost_per_attendee || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2 text-right"><button className="text-red-400 hover:text-red-600" onClick={() => setEventMeals(prev => prev.filter((_, idx) => idx !== i))}><Trash2 size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Other costs */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <label className="label">Other Amount (₹)</label>
            <input type="number" className="input" {...register('other_amount')} placeholder="0" />
          </div>
          <div>
            <label className="label">Other Amount Description</label>
            <input className="input" {...register('other_amount_description')} placeholder="Mandatory if other amount filled" />
          </div>
          <div>
            <label className="label">BTC Facility</label>
            <select className="input" {...register('btc_facility')}><option value="">Select</option><option value="Yes">Yes</option><option value="No">No</option></select>
          </div>
        </div>
      </div>

      {/* MCL HCP Section */}
      <div className="card space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold">MCL HCP Doctor Details</h3>
          <button type="button" className="btn-primary flex items-center gap-1 text-sm" onClick={() => setDoctorSearchOpen(true)}><Plus size={14} /> Add Doctor</button>
        </div>
        <p className="text-xs text-gray-500">Selection Procedure For MCL HCP</p>
        <MclDoctorTable doctors={doctors} setDoctors={setDoctors} fmvParams={fmvParams} />
      </div>

      {/* Non-MCL HCP Section */}
      <NonMclDoctorTable doctors={doctors} setDoctors={setDoctors} fmvParams={fmvParams} addDoctor={addDoctor} hcpLimit={parseInt(hcpCount) || 0} />

      <div className="flex justify-between">
        <button type="button" className="btn-secondary text-red-600 border-red-300" onClick={onBack}>Previous</button>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex items-center gap-1" disabled={saving} onClick={() => onSave(getValues(), false)}><Save size={14} /> Save</button>
          <button type="button" className="btn-primary" onClick={async () => {
            // Validations using controlled state
            const emcureCount = selectedAttendees.length || (parseInt(getValues('proposed_emcure_attendees')) || 0)
            if (emcureCount === 0) {
              toast.error('Please select at least 1 Emcure attendee')
              return
            }
            const hcpLimit = parseInt(hcpCount) || 0
            if (hcpLimit <= 0) {
              toast.error('Number of HCPs Delivering Professional Services is required')
              return
            }
            const totalDoctors = doctors.length
            if (totalDoctors !== hcpLimit) {
              toast.error(`Total doctors added (${totalDoctors}) must be exactly ${hcpLimit} (HCPs Delivering Professional Services)`)
              return
            }
            const proposed = parseInt(proposedHcps) || 0
            const minProposed = hcpLimit * 10
            if (proposed < minProposed) {
              toast.error(`Proposed Number of HCPs must be at least ${minProposed} (1:10 ratio with ${hcpLimit} HCPs delivering services)`)
              return
            }

            // Budget check
            if (checkBudget) {
              const budgetData = await checkBudget()
              if (budgetData) {
                // Calculate speaker cost
                const speakerCost = doctors.reduce((sum, d) => sum + (parseFloat(d.honorarium) || 0), 0)
                if (budgetData.speaker_budget && speakerCost > budgetData.speaker_budget.remaining) {
                  toast.error(`Speaker cost (₹${speakerCost.toLocaleString('en-IN')}) exceeds remaining Speaker budget (₹${budgetData.speaker_budget.remaining.toLocaleString('en-IN')})`)
                  return
                }
                // Calculate event cost
                const avCost = parseFloat(getValues('av_platform_cost')) || 0
                const hallCharges = parseFloat(getValues('venue_charges')) || 0
                const otherAmt = parseFloat(getValues('other_amount')) || 0
                const travelCost = doctors.reduce((sum, d) => sum + (parseFloat(d.cab_cost) || 0) + (parseFloat(d.flight_cost) || 0) + (parseFloat(d.accommodation_cost) || 0), 0)
                const mealCost = totalMealCost
                const totalEvtCost = avCost + hallCharges + otherAmt + travelCost + mealCost
                if (budgetData.event_budget && totalEvtCost > budgetData.event_budget.remaining) {
                  toast.error(`Event cost (₹${totalEvtCost.toLocaleString('en-IN')}) exceeds remaining Event budget (₹${budgetData.event_budget.remaining.toLocaleString('en-IN')})`)
                  return
                }
              }
            }

            onSave(getValues(), true)
          }}>Next</button>
        </div>
      </div>

      <DoctorSearchModal open={doctorSearchOpen} onClose={() => setDoctorSearchOpen(false)} onSelect={(doc) => {
        const hcpLimit = parseInt(hcpCount) || 0
        if (hcpLimit > 0 && doctors.length >= hcpLimit) {
          toast.error(`Cannot add more doctors. Limit is ${hcpLimit} (HCPs Delivering Professional Services)`)
          setDoctorSearchOpen(false)
          return
        }
        addDoctor.mutate({ doctor_name: doc.full_name || `${doc.first_name || ''} ${doc.last_name || ''}`.trim(), specialization: doc.qualification || '', city: doc.city || '', mobile_no: doc.mobile_number || '', pan_number: doc.pan_number || '', email: doc.email || '', fmv_amount: doc.hourly_rate || null, is_mcl: true })
        setDoctorSearchOpen(false)
      }} />

      {/* Emcure Attendees Selection Modal */}
      {showAttendeeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setShowAttendeeModal(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Select Emcure Attendees</h3>
            <div className="relative mb-3">
              <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
              <input className="input pl-9" placeholder="Search by name, designation…" value={attendeeSearch} onChange={e => setAttendeeSearch(e.target.value)} autoFocus />
            </div>
            <p className="text-xs text-gray-400 mb-2">{selectedAttendees.length} selected · {hierarchyUsers.length} users in hierarchy</p>
            <div className="flex-1 overflow-y-auto border rounded-lg divide-y">
              {hierarchyUsers
                .filter(u => !attendeeSearch || u.name?.toLowerCase().includes(attendeeSearch.toLowerCase()) || u.designation?.toLowerCase().includes(attendeeSearch.toLowerCase()) || u.employee_id?.toLowerCase().includes(attendeeSearch.toLowerCase()))
                .map(u => {
                  const isSelected = selectedAttendees.find(a => a.id === u.id)
                  return (
                    <label key={u.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-[var(--color-primary-50)]' : ''}`}>
                      <input type="checkbox" checked={!!isSelected} onChange={() => {
                        if (isSelected) {
                          const updated = selectedAttendees.filter(a => a.id !== u.id)
                          setSelectedAttendees(updated)
                          setValue('proposed_emcure_attendees', String(updated.length))
                        } else {
                          const updated = [...selectedAttendees, u]
                          setSelectedAttendees(updated)
                          setValue('proposed_emcure_attendees', String(updated.length))
                        }
                      }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.designation || '—'} · {u.employee_id || ''}</p>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${u.relation === 'self' ? 'bg-blue-100 text-blue-700' : u.relation === 'manager' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        {u.relation === 'self' ? 'You' : u.relation === 'manager' ? 'Manager' : 'Report'}
                      </span>
                    </label>
                  )
                })}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="btn-secondary" onClick={() => setShowAttendeeModal(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
