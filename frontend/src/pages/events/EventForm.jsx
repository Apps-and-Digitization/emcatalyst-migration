import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { eventsApi, accessApi, masterApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import useAuthStore from '../../store/authStore'
import EventFormStep1 from './components/EventFormStep1'
import EventFormStep2 from './components/EventFormStep2'
import EventFormStep3 from './components/EventFormStep3'
import EventFormStep4 from './components/EventFormStep4'

const STEPS = ['Basic Details', 'Event Info', 'Costs & HCPs', 'Documents']

export default function EventForm() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEditMode = !!editId
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [step, setStep] = useState(0)
  const [eventId, setEventId] = useState(editId ? parseInt(editId) : null)
  const [doctors, setDoctors] = useState([])
  const [eventMeals, setEventMeals] = useState([])
  const [doctorSearchOpen, setDoctorSearchOpen] = useState(false)
  const [preDocUploads, setPreDocUploads] = useState({})
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm({
    defaultValues: { event_type: '', platform: '', budget_type: '', btc_facility: '', promotional_material_approved: '', advance_payment: '', is_division_involved: '' }
  })
  const eventType = watch('event_type')
  const isCME = eventType === 'CME / RTM'
  const isAdvisory = eventType === 'Advisory Board'
  const isSponsorship = eventType === 'Corporate Sponsorship'

  // Queries
  const { data: divisions = [] } = useQuery({ queryKey: ['my-divisions'], queryFn: () => accessApi.listMyDivisions().then(r => r.data) })
  const { data: therapeutics = [] } = useQuery({ queryKey: ['therapeutics'], queryFn: () => masterApi.therapeutics().then(r => r.data) })
  const { data: brands = [] } = useQuery({ queryKey: ['brands'], queryFn: () => masterApi.brands().then(r => r.data) })
  const { data: fmvParams = {} } = useQuery({ queryKey: ['fmv-parameters'], queryFn: () => masterApi.fmvParameters().then(r => r.data) })
  const { data: preEventDocs = [] } = useQuery({
    queryKey: ['pre-docs', eventType],
    queryFn: () => masterApi.documentTypesForEvent(eventType, 'pre').then(r => r.data),
    enabled: !!eventType,
  })

  // Load existing event in edit mode
  const { data: existingEvent } = useQuery({
    queryKey: ['event', editId],
    queryFn: () => eventsApi.get(editId).then(r => r.data),
    enabled: isEditMode,
  })

  useEffect(() => {
    if (existingEvent && isEditMode) {
      const fields = ['event_type','event_title','division_id','therapeutic_area','brand','budget_type','on_field_execution_by','platform','topic','city','venue','state','rationale','promotional_material_approved','agenda','proposed_emcure_attendees','num_hcps_professional_services','proposed_num_hcps','conference_type','solicited_unsolicited','sponsorship_type','sponsorship_amount','advance_payment_reason','advance_payment_amount','cost_center','meal_type','meal_cost_per_attendee','minimum_guarantee_pax','venue_charges','av_platform_cost','other_amount','other_amount_description','btc_facility']
      fields.forEach(f => { if (existingEvent[f] != null) setValue(f, String(existingEvent[f])) })
      if (existingEvent.event_date) setValue('event_date', existingEvent.event_date.slice(0, 10))
      if (existingEvent.event_end_date) setValue('event_end_date', existingEvent.event_end_date.slice(0, 10))
      if (existingEvent.advance_payment) setValue('advance_payment', 'Yes')
      if (existingEvent.is_division_involved) setValue('is_division_involved', 'Yes')
      // Load doctors with FMV point fields mapped
      if (existingEvent.doctors?.length) {
        setDoctors(existingEvent.doctors.map(d => ({
          ...d,
          fmv_expertise_pts: d.fmv_expertise ? parseInt(d.fmv_expertise) || 0 : 0,
          fmv_clinical_pts: d.fmv_clinical_experience ? parseInt(d.fmv_clinical_experience) || 0 : 0,
          fmv_publications_pts: d.fmv_publications ? parseInt(d.fmv_publications) || 0 : 0,
          fmv_congress_pts: d.fmv_congress_experience ? parseInt(d.fmv_congress_experience) || 0 : 0,
          fmv_position_pts: d.fmv_professional_position ? parseInt(d.fmv_professional_position) || 0 : 0,
          fmv_investigator_pts: d.fmv_investigator_experience ? parseInt(d.fmv_investigator_experience) || 0 : 0,
        })))
      }
      // Load meals
      if (existingEvent.meals?.length) {
        setEventMeals(existingEvent.meals)
      }
    }
  }, [existingEvent, isEditMode, setValue])

  // Save event (create or update)
  const saveEvent = async (data, andContinue = false) => {
    const payload = {}
    for (const [key, value] of Object.entries(data)) {
      if (value === '' || value === undefined || value === null) continue
      payload[key] = value
    }
    if (payload.division_id) payload.division_id = parseInt(payload.division_id)
    if (payload.proposed_emcure_attendees) payload.proposed_emcure_attendees = parseInt(payload.proposed_emcure_attendees)
    if (payload.num_hcps_professional_services) payload.num_hcps_professional_services = parseInt(payload.num_hcps_professional_services)
    if (payload.proposed_num_hcps) payload.proposed_num_hcps = parseInt(payload.proposed_num_hcps)
    if (payload.sponsorship_amount) payload.sponsorship_amount = parseFloat(payload.sponsorship_amount)
    if (payload.advance_payment_amount) payload.advance_payment_amount = parseFloat(payload.advance_payment_amount)
    if (payload.meal_cost_per_attendee) payload.meal_cost_per_attendee = parseFloat(payload.meal_cost_per_attendee)
    if (payload.minimum_guarantee_pax) payload.minimum_guarantee_pax = parseInt(payload.minimum_guarantee_pax)
    if (payload.venue_charges) payload.venue_charges = parseFloat(payload.venue_charges)
    if (payload.av_platform_cost) payload.av_platform_cost = parseFloat(payload.av_platform_cost)
    if (payload.other_amount) payload.other_amount = parseFloat(payload.other_amount)
    if (payload.advance_payment) payload.advance_payment = payload.advance_payment === 'Yes'
    else delete payload.advance_payment
    if (payload.is_division_involved) payload.is_division_involved = payload.is_division_involved === 'Yes'
    else delete payload.is_division_involved

    setSaving(true)
    try {
      if (eventId) {
        await eventsApi.update(eventId, payload)
      } else {
        const res = await eventsApi.create(payload)
        setEventId(res.data.id)
      }

      // Save event meals
      const eid = eventId
      if (eid && eventMeals.length > 0) {
        for (const meal of eventMeals) {
          if (!meal.id) {
            // New meal - save it
            try {
              const res = await eventsApi.addMeal(eid, { meal_name: meal.meal_name, max_cost: meal.max_cost, cost_per_attendee: meal.cost_per_attendee })
              meal.id = res.data.id
            } catch (err) {
              console.error('Error saving meal', err)
            }
          }
        }
      }

      // Save doctor-level data (FMV params, costs, honorarium)
      if (eid && doctors.length > 0) {
        for (const doc of doctors) {
          if (!doc.id) continue

          // Calculate FMV
          const pts = (parseInt(doc.fmv_expertise_pts) || 0) + (parseInt(doc.fmv_clinical_pts) || 0) +
            (parseInt(doc.fmv_publications_pts) || 0) + (parseInt(doc.fmv_congress_pts) || 0) +
            (parseInt(doc.fmv_position_pts) || 0) + (parseInt(doc.fmv_investigator_pts) || 0)
          let fmvCat = 'Cat C', fmvRate = 5000, fmvCap = 30000
          if (pts >= 19) { fmvCat = 'Cat A'; fmvRate = 15000; fmvCap = 75000 }
          else if (pts >= 10) { fmvCat = 'Cat B'; fmvRate = 10000; fmvCap = 50000 }

          const docPayload = {
            doctor_name: doc.doctor_name,
            name_as_per_pan: doc.name_as_per_pan || null,
            pan_number: doc.pan_number || null,
            email: doc.email || null,
            role: doc.role || null,
            is_mcl: doc.is_mcl !== false,
            fmv_expertise: String(doc.fmv_expertise_pts || 0),
            fmv_clinical_experience: String(doc.fmv_clinical_pts || 0),
            fmv_publications: String(doc.fmv_publications_pts || 0),
            fmv_congress_experience: String(doc.fmv_congress_pts || 0),
            fmv_professional_position: String(doc.fmv_position_pts || 0),
            fmv_investigator_experience: String(doc.fmv_investigator_pts || 0),
            fmv_total_points: pts,
            fmv_category: fmvCat,
            fmv_hourly_rate: fmvRate,
            fmv_max_capping: fmvCap,
            derived_honorarium: fmvCap,
            honorarium: doc.honorarium ? parseFloat(doc.honorarium) : null,
            cab_cost: doc.cab_cost ? parseFloat(doc.cab_cost) : null,
            accommodation_cost: doc.accommodation_cost ? parseFloat(doc.accommodation_cost) : null,
            flight_cost: doc.flight_cost ? parseFloat(doc.flight_cost) : null,
            remark: doc.remark || null,
          }

          try {
            await eventsApi.updateDoctor(eid, doc.id, docPayload)
          } catch (err) {
            console.error('Error updating doctor', doc.id, err)
          }
        }
      }

      toast.success('Event saved')
      if (andContinue) {
        // Budget check when moving from Step 2 (index 1) to Step 3 (index 2)
        if (step === 1) {
          const divId = payload.division_id || getValues('division_id')
          const eventDate = payload.event_date || getValues('event_date')
          if (divId && eventDate) {
            try {
              const budgetRes = await eventsApi.checkBudget(divId, eventDate)
              const budgetData = budgetRes.data
              if (!budgetData.has_budget) {
                toast.error('No budget allocated for the selected division and event month. Please contact admin to allocate budget.')
                setSaving(false)
                return
              }
            } catch (err) {
              // If budget check fails, allow to proceed (non-blocking)
            }
          }
        }
        setStep(s => s + 1)
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error saving')
    }
    setSaving(false)
  }

  const addDoctor = useMutation({
    mutationFn: (data) => eventsApi.addDoctor(eventId, data),
    onSuccess: (res) => { setDoctors(prev => [...prev, res.data]); toast.success('HCP added') },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add doctor. Make sure the event is saved first.'),
  })

  // Upload documents and optionally submit
  const uploadDocs = async () => {
    for (const [docTypeId, file] of Object.entries(preDocUploads)) {
      const docType = preEventDocs.find(d => d.id === parseInt(docTypeId))
      const formData = new FormData()
      formData.append('file', file)
      formData.append('document_type', docType?.name || 'Other')
      await eventsApi.uploadDocument(eventId, formData)
    }
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    try {
      await uploadDocs()
      toast.success('Documents saved as draft')
    } catch (e) {
      toast.error('Error saving documents')
    }
    setSaving(false)
  }

  const handleSubmitEvent = async () => {
    // Check mandatory docs
    const mandatoryDocs = preEventDocs.filter(d => d.is_mandatory)
    const missing = mandatoryDocs.filter(d => !preDocUploads[d.id])
    if (missing.length > 0) {
      toast.error(`Missing mandatory: ${missing.map(d => d.name).join(', ')}`)
      return
    }
    setSaving(true)
    try {
      await uploadDocs()
      await eventsApi.submit(eventId)
      qc.invalidateQueries(['events'])
      toast.success('Event submitted for approval!')
      navigate('/events')
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Error submitting')
    }
    setSaving(false)
  }

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader title={isEditMode ? 'Edit Event' : 'New Event Requisition'} subtitle={isEditMode ? `Editing ${existingEvent?.event_code || ''}` : 'Create a new event request'} />

      {/* Stepper */}
      <div className="flex items-center mb-8">
        {STEPS.map((label, i) => (
          <div key={i} className="flex items-center flex-1">
            <div className="flex items-center gap-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                i < step ? 'bg-emerald-500 border-emerald-500 text-white' : i === step ? 'border-red-500 text-red-500' : 'border-gray-300 text-gray-400'
              }`}>{i < step ? '✓' : `0${i + 1}`}</div>
              <span className={`text-sm ${i === step ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>Step {i + 1}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-1 mx-3 rounded ${i < step ? 'bg-red-500' : 'bg-gray-200'}`} />}
          </div>
        ))}
      </div>

      {/* STEP 1: Basic Details */}
      {step === 0 && (
        <EventFormStep1
          register={register}
          errors={errors}
          watch={watch}
          setValue={setValue}
          handleSubmit={handleSubmit}
          saving={saving}
          user={user}
          divisions={divisions}
          therapeutics={therapeutics}
          brands={brands}
          isCME={isCME}
          isAdvisory={isAdvisory}
          isSponsorship={isSponsorship}
          onSave={saveEvent}
          onCancel={() => navigate('/events')}
        />
      )}

      {/* STEP 2: Event Info */}
      {step === 1 && (
        <EventFormStep2
          register={register}
          handleSubmit={handleSubmit}
          saving={saving}
          eventCode={existingEvent?.event_code}
          isCME={isCME}
          isAdvisory={isAdvisory}
          onSave={saveEvent}
          onBack={() => setStep(0)}
        />
      )}

      {/* STEP 3: Costs & HCPs */}
      {step === 2 && (
        <EventFormStep3
          register={register}
          saving={saving}
          getValues={getValues}
          watch={watch}
          setValue={setValue}
          doctors={doctors}
          setDoctors={setDoctors}
          fmvParams={fmvParams}
          eventMeals={eventMeals}
          setEventMeals={setEventMeals}
          doctorSearchOpen={doctorSearchOpen}
          setDoctorSearchOpen={setDoctorSearchOpen}
          addDoctor={addDoctor}
          onSave={saveEvent}
          onBack={() => setStep(1)}
          checkBudget={async () => {
            const divId = getValues('division_id')
            const eventDate = getValues('event_date')
            if (!divId || !eventDate) return null
            try {
              const res = await eventsApi.checkBudget(divId, eventDate)
              return res.data
            } catch { return null }
          }}
        />
      )}

      {/* STEP 4: Documents */}
      {step === 3 && (
        <EventFormStep4
          eventType={eventType}
          doctors={doctors}
          saving={saving}
          eventId={eventId}
          preEventDocs={preEventDocs}
          preDocUploads={preDocUploads}
          setPreDocUploads={setPreDocUploads}
          onSaveDraft={handleSaveDraft}
          onPreview={async () => {
            // Validate mandatory documents before preview
            const mandatoryDocs = preEventDocs.filter(d => d.is_mandatory)
            const missingDocs = mandatoryDocs.filter(d => !preDocUploads[d.id])
            if (missingDocs.length > 0) {
              toast.error(`Mandatory documents missing: ${missingDocs.map(d => d.name).join(', ')}`)
              return
            }
            // Save draft first (upload docs), then navigate to preview
            await handleSaveDraft()
            if (eventId) navigate(`/events/${eventId}`)
          }}
          onBack={() => setStep(2)}
        />
      )}
    </div>
  )
}
