import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { eventsApi, masterApi } from '../../api/endpoints'
import api from '../../api/client'
import { fmtDate, fmtDateTime, fmtCurrency } from '../../utils/helpers'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { ArrowLeft, CheckCircle, XCircle, Edit2, Download, Eye, ChevronDown, ChevronUp, Upload } from 'lucide-react'
import useAuthStore from '../../store/authStore'

// Approval levels for progress calculation — will be overridden by dynamic workflow data
const FALLBACK_LEVELS = ['Draft', 'Pending L1', 'Pending L2', 'Pending Compliance', 'Pre-Approved', 'Post L1', 'Post L2', 'Post Compliance', 'Completed']

function getProgress(status, allLevels) {
  const levels = allLevels && allLevels.length > 0 ? allLevels : FALLBACK_LEVELS
  const idx = levels.indexOf(status)
  if (idx === -1) return 0
  return Math.round(((idx + 1) / levels.length) * 100)
}

function Field({ label, value, wide }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || '—'}</p>
    </div>
  )
}

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [auditOpen, setAuditOpen] = useState(false)
  const [submitModal, setSubmitModal] = useState(false)
  const [submitRemarks, setSubmitRemarks] = useState('')
  const [approveModal, setApproveModal] = useState(false)
  const [approveRemarks, setApproveRemarks] = useState('')
  const [postDocUploads, setPostDocUploads] = useState({})
  const [postSubmitting, setPostSubmitting] = useState(false)
  const [postRemarks, setPostRemarks] = useState('')
  const [postSubmitModal, setPostSubmitModal] = useState(false)

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', id],
    queryFn: () => eventsApi.get(id).then(r => r.data),
  })

  const { data: workflowSteps = [] } = useQuery({
    queryKey: ['event-workflow-steps'],
    queryFn: () => eventsApi.workflowSteps().then(r => r.data),
  })

  const { data: postEventDocTypes = [] } = useQuery({
    queryKey: ['post-event-doc-types', event?.event_type],
    queryFn: () => masterApi.documentTypesForEvent(event?.event_type, 'post').then(r => r.data),
    enabled: !!event && event.status === 'Pre-Approved',
  })

  const { data: canApproveData } = useQuery({
    queryKey: ['event-can-approve', id],
    queryFn: () => api.get(`/events/${id}/can-approve`).then(r => r.data),
    enabled: !!event && event.status !== 'Draft' && event.status !== 'Pre-Approved' && event.status !== 'Completed' && event.status !== 'Rejected',
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })

  const approve = useMutation({
    mutationFn: (remarks) => {
      const s = event.status
      if (s === 'Pending L1') return eventsApi.approveL1(id, remarks)
      if (s === 'Pending L2') return eventsApi.approveL2(id, remarks)
      if (s === 'Pending Compliance') return eventsApi.approveCompliance(id, remarks)
      if (s === 'Post L1') return eventsApi.approvePostL1(id, remarks)
      if (s === 'Post L2') return eventsApi.approvePostL2(id, remarks)
      if (s === 'Post Compliance') return eventsApi.approvePostCompliance(id, remarks)
      if (s === 'Post Coordinator') return eventsApi.approvePostCoordinator(id, remarks)
      if (s === 'Post GST') return eventsApi.approvePostGst(id, remarks)
      if (s === 'Post Finance') return eventsApi.approvePostFinance(id, remarks)
      return eventsApi.approve(id, remarks)
    },
    onSuccess: () => { qc.invalidateQueries(['event', id]); toast.success('Approved') },
  })

  const reject = useMutation({
    mutationFn: (reason) => eventsApi.reject(id, reason),
    onSuccess: () => { qc.invalidateQueries(['event', id]); setRejectModal(false); toast.success('Rejected') },
  })

  if (isLoading) return <div className="p-8"><LoadingSpinner /></div>
  if (!event) return <div className="p-8 text-red-500">Event not found</div>

  const canApprove = canApproveData?.can_approve === true

  const isDraft = event.status === 'Draft'
  const isInitiator = user?.id === event.initiator_id
  const endDatePassed = event.event_end_date && new Date(event.event_end_date) < new Date()
  const showPostEventBanner = isInitiator && event.status === 'Pre-Approved' && endDatePassed

  // Build dynamic progress levels from workflow steps
  const allLevels = (() => {
    const levels = ['Draft']
    if (workflowSteps?.pre_steps) {
      workflowSteps.pre_steps.forEach(s => { if (s.pending_status && !levels.includes(s.pending_status)) levels.push(s.pending_status) })
      const lastPre = workflowSteps.pre_steps[workflowSteps.pre_steps.length - 1]
      if (lastPre?.approved_status && !levels.includes(lastPre.approved_status)) levels.push(lastPre.approved_status)
    }
    if (workflowSteps?.post_steps) {
      workflowSteps.post_steps.forEach(s => { if (s.pending_status && !levels.includes(s.pending_status)) levels.push(s.pending_status) })
      const lastPost = workflowSteps.post_steps[workflowSteps.post_steps.length - 1]
      if (lastPost?.approved_status && !levels.includes(lastPost.approved_status)) levels.push(lastPost.approved_status)
    }
    return levels
  })()

  const progress = getProgress(event.status, allLevels)

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/events')} className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{event.event_title}</h1>
            <p className="text-sm text-gray-500">{event.event_code} • {event.event_type || 'Event'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isDraft && isInitiator && <button className="btn-secondary flex items-center gap-1" onClick={() => navigate(`/events/${id}/edit`)}><Edit2 size={14} /> Edit</button>}
          {isDraft && isInitiator && (
            <button className="btn-primary flex items-center gap-1" onClick={() => setSubmitModal(true)}>
              <CheckCircle size={15} /> Submit for Approval
            </button>
          )}
          {showPostEventBanner && (
            <button className="btn-primary flex items-center gap-1" onClick={() => {
              // Validate mandatory docs
              const mandatoryDocs = postEventDocTypes.filter(d => d.is_mandatory)
              const missing = mandatoryDocs.filter(d => !postDocUploads[d.id])
              if (missing.length > 0) {
                toast.error(`Mandatory documents missing: ${missing.map(d => d.name).join(', ')}`)
                return
              }
              setPostSubmitModal(true)
            }}>
              <CheckCircle size={15} /> Submit Post-Event for Approval
            </button>
          )}
          {canApprove && <>
            <button className="btn-primary flex items-center gap-1" onClick={() => setApproveModal(true)}><CheckCircle size={15} /> Approve</button>
            <button className="btn-danger flex items-center gap-1" onClick={() => setRejectModal(true)}><XCircle size={15} /> Reject</button>
          </>}
          <StatusBadge status={event.status} />
        </div>
      </div>

      {/* Progress Bar with Audit Trail */}
      <div className="card mb-6 cursor-pointer" onClick={() => setAuditOpen(!auditOpen)}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">Approval Progress</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{event.status}</span>
            {auditOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className={`h-3 rounded-full transition-all ${progress >= 100 ? 'bg-emerald-500' : progress > 50 ? 'bg-[var(--color-primary)]' : 'bg-amber-500'}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-400">Draft</span>
          <span className="text-xs text-gray-400">Pre-Approved</span>
          <span className="text-xs text-gray-400">Completed</span>
        </div>

        {/* Audit Trail (expandable) */}
        {auditOpen && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <p className="text-sm font-semibold text-gray-700">Audit Trail</p>
            {event.audit_trail?.length > 0 ? (
              <div className="space-y-2">
                {event.audit_trail.map((entry, i) => (
                  <div key={entry.id || i} className="flex items-start gap-3 text-sm">
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-[var(--color-primary-50)]0' : 'bg-gray-300'}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entry.action}</span>
                        {entry.to_status && <StatusBadge status={entry.to_status} />}
                      </div>
                      <p className="text-xs text-gray-500">by {entry.performed_by} • {fmtDateTime(entry.created_at)}</p>
                      {entry.remarks && <p className="text-xs text-gray-600 mt-0.5 bg-gray-50 px-2 py-1 rounded">{entry.remarks}</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-gray-400">No audit trail entries yet.</p>}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t">
              <Field label="L1 Approver" value={event.l1_approver_name} />
              <Field label="L2 Approver" value={event.l2_approver_name} />
              <Field label="Current Pending" value={event.status} />
            </div>
          </div>
        )}
      </div>

      {/* Rejection reason */}
      {event.rejection_reason && (
        <div className="mb-6 card bg-red-50 border-red-200">
          <p className="text-xs text-red-400 mb-1">Rejection Reason</p>
          <p className="text-sm text-red-700">{event.rejection_reason}</p>
        </div>
      )}

      {/* Section 1: Basic Details */}
      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Basic Details</h3>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Event Type" value={event.event_type} />
          <Field label="Initiator" value={event.initiator_name} />
          <Field label="Division" value={event.division_name} />
          <Field label="Cost Center" value={event.cost_center} />
          <Field label="Therapeutic Area" value={event.therapeutic_area} />
          <Field label="Brand" value={event.brand} />
          <Field label="Budget Type" value={event.budget_type} />
          <Field label="Platform" value={event.platform} />
          <Field label="Topic" value={event.topic} />
          {event.event_type === 'Corporate Sponsorship' && <>
            <Field label="Conference Type" value={event.conference_type} />
            <Field label="Solicited/Unsolicited" value={event.solicited_unsolicited} />
            <Field label="Sponsorship Type" value={event.sponsorship_type} />
            <Field label="Sponsorship Amount" value={fmtCurrency(event.sponsorship_amount)} />
          </>}
        </div>
      </div>

      {/* Section 2: Event Info */}
      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Event Information</h3>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Start Date" value={fmtDate(event.event_date)} />
          <Field label="End Date" value={fmtDate(event.event_end_date)} />
          <Field label="City" value={event.city} />
          <Field label="State" value={event.state} />
          <Field label="Venue" value={event.venue} />
          <Field label="On Field Execution By" value={event.on_field_execution_by} />
          <Field label="Emcure Attendees" value={event.proposed_emcure_attendees} />
          <Field label="Promotional Material Approved" value={event.promotional_material_approved} />
          <Field label="HCPs Professional Services" value={event.num_hcps_professional_services} />
          <Field label="Proposed HCPs" value={event.proposed_num_hcps} />
        </div>
        {event.rationale && <div className="mt-3"><Field label="Rationale" value={event.rationale} wide /></div>}
        {event.agenda && <div className="mt-3"><Field label="Agenda" value={event.agenda} wide /></div>}
      </div>

      {/* Section 3: Meals & Costs */}
      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Meals & Beverages</h3>
        {event.meals?.length > 0 ? (
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs text-gray-500">Meal</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500">Max Capping (₹)</th>
                <th className="px-4 py-2 text-left text-xs text-gray-500">Cost Per Attendee (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {event.meals.map(m => (
                <tr key={m.id}>
                  <td className="px-4 py-2 font-medium">{m.meal_name}</td>
                  <td className="px-4 py-2 text-gray-500">{m.max_cost ? fmtCurrency(m.max_cost) : '—'}</td>
                  <td className="px-4 py-2 font-medium">{m.cost_per_attendee ? fmtCurrency(m.cost_per_attendee) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-gray-400">No meals added.</p>}
      </div>

      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Other Event Costs</h3>
        <div className="grid grid-cols-4 gap-4">
          <Field label="Min Guarantee (Pax)" value={event.minimum_guarantee_pax} />
          <Field label="Venue Charges" value={fmtCurrency(event.venue_charges)} />
          <Field label="AV/Platform Cost" value={fmtCurrency(event.av_platform_cost)} />
          <Field label="Other Amount" value={fmtCurrency(event.other_amount)} />
          <Field label="BTC Facility" value={event.btc_facility} />
          {event.other_amount_description && <Field label="Other Description" value={event.other_amount_description} />}
        </div>
      </div>

      {/* Section 4: HCPs */}
      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">HCP Details ({event.doctors?.length || 0})</h3>
        {event.doctors?.length > 0 ? (
          <div className="overflow-x-auto border rounded-lg">
            <table className="text-xs w-full" style={{minWidth: '1200px'}}>
              <thead className="bg-gray-100 border-b">
                <tr>
                  {['Name','Type','PAN','Email','FMV Cat','Pts','Rate','Derived','Honorarium','Cab','Flight','Accom','Remark'].map(h => (
                    <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {event.doctors.map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1.5 font-medium whitespace-nowrap">{d.doctor_name}</td>
                    <td className="px-2 py-1.5"><span className={`text-xs px-1.5 py-0.5 rounded ${d.is_mcl !== false ? 'bg-[var(--color-primary-100)] text-[var(--color-primary)]' : 'bg-amber-100 text-amber-700'}`}>{d.is_mcl !== false ? 'MCL' : 'Non-MCL'}</span></td>
                    <td className="px-2 py-1.5 font-mono">{d.pan_number || '—'}</td>
                    <td className="px-2 py-1.5">{d.email || '—'}</td>
                    <td className="px-2 py-1.5"><span className="font-bold">{d.fmv_category || '—'}</span></td>
                    <td className="px-2 py-1.5 text-center">{d.fmv_total_points || '—'}</td>
                    <td className="px-2 py-1.5">{d.fmv_hourly_rate ? fmtCurrency(d.fmv_hourly_rate) : '—'}</td>
                    <td className="px-2 py-1.5 font-medium">{d.derived_honorarium ? fmtCurrency(d.derived_honorarium) : '—'}</td>
                    <td className="px-2 py-1.5 font-medium">{d.honorarium ? fmtCurrency(d.honorarium) : '—'}</td>
                    <td className="px-2 py-1.5">{d.cab_cost ? fmtCurrency(d.cab_cost) : '—'}</td>
                    <td className="px-2 py-1.5">{d.flight_cost ? fmtCurrency(d.flight_cost) : '—'}</td>
                    <td className="px-2 py-1.5">{d.accommodation_cost ? fmtCurrency(d.accommodation_cost) : '—'}</td>
                    <td className="px-2 py-1.5">{d.remark || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-400">No HCPs added.</p>}
      </div>

      {/* Section 5: Documents */}
      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Uploaded Documents</h3>
        {event.documents?.length > 0 ? (
          <div className="space-y-2">
            {event.documents.map(d => (
                <div key={d.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${d.stage === 'post' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                      {d.stage === 'post' ? 'Post-Event' : 'Pre-Event'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-medium shrink-0">
                      {d.document_type || 'Document'}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{d.document_name}</p>
                      <p className="text-xs text-gray-400">{fmtDate(d.uploaded_at)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {d.file_path && <a href={`/${d.file_path.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs flex items-center gap-1 py-1 px-2"><Eye size={12} /> View</a>}
                    {d.file_path && <a href={`/${d.file_path.replace(/\\/g, '/')}`} download className="btn-secondary text-xs flex items-center gap-1 py-1 px-2"><Download size={12} /> Download</a>}
                  </div>
                </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No documents uploaded.</p>}
      </div>

      {/* Post-Event Document Upload — visible to initiator at Pre-Approved stage */}
      {showPostEventBanner && (
        <div className="card mb-4">
          <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Post-Event Documents</h3>
          <p className="text-xs text-gray-500 mb-3">Upload required post-event documents. Click "Submit Post-Event for Approval" at the top when ready.</p>
          {postEventDocTypes.length === 0 ? (
            <p className="text-sm text-gray-400">No post-event document types configured for this event type.</p>
          ) : (
            <div className="space-y-3">
              {postEventDocTypes.map(docType => (
                <div key={docType.id} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-gray-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{docType.name}</p>
                      {docType.is_mandatory && <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">Mandatory</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {postDocUploads[docType.id] && (
                      <>
                        <div className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle size={14} />
                          <span className="text-xs truncate max-w-[150px]">{postDocUploads[docType.id].name}</span>
                        </div>
                        <button className="text-red-400 hover:text-red-600" onClick={() => setPostDocUploads(prev => { const n = {...prev}; delete n[docType.id]; return n })}>
                          <XCircle size={14} />
                        </button>
                      </>
                    )}
                    <label className="btn-secondary text-xs cursor-pointer flex items-center gap-1">
                      <Upload size={14} /> {postDocUploads[docType.id] ? 'Change' : 'Upload'}
                      <input type="file" className="hidden" onClick={e => { e.target.value = null }} onChange={e => {
                        if (e.target.files[0]) setPostDocUploads(prev => ({ ...prev, [docType.id]: e.target.files[0] }))
                      }} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Submit Confirmation Modal */}
      <Modal open={submitModal} onClose={() => setSubmitModal(false)} title="Submit for Approval">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">This event will go through the following approval workflow:</p>
          <div className="space-y-2">
            {(workflowSteps?.pre_steps || []).map((step, i) => (
              <div key={step.step_order} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--color-primary-50)] text-[var(--color-primary)] flex items-center justify-center text-xs font-bold shrink-0">
                  {step.step_order}
                </div>
                <span className="text-sm font-medium">{step.step_label}</span>
                {i < (workflowSteps?.pre_steps || []).length - 1 && <span className="text-gray-300 text-xs">→</span>}
              </div>
            ))}
          </div>
          {(!workflowSteps?.pre_steps || workflowSteps.pre_steps.length === 0) && (
            <p className="text-sm text-amber-600">No workflow steps configured. Event will be submitted directly.</p>
          )}
          <div>
            <label className="label">Remarks</label>
            <textarea className="input h-20" value={submitRemarks} onChange={e => setSubmitRemarks(e.target.value)} placeholder="Add remarks for submission (optional)…" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button className="btn-secondary" onClick={() => setSubmitModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={async () => {
              setSubmitModal(false)
              try {
                await eventsApi.submit(id, submitRemarks)
                qc.invalidateQueries(['event', id])
                toast.success('Submitted for approval')
                setSubmitRemarks('')
              } catch (e) {
                toast.error(e.response?.data?.detail || 'Submit failed')
              }
            }}>Confirm & Submit</button>
          </div>
        </div>
      </Modal>

      {/* Approve Modal */}
      <Modal open={approveModal} onClose={() => setApproveModal(false)} title="Approve Event">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">You are approving this event at stage: <span className="font-medium">{event?.status}</span></p>
          <div>
            <label className="label">Remarks</label>
            <textarea className="input h-20" value={approveRemarks} onChange={e => setApproveRemarks(e.target.value)} placeholder="Add approval remarks (optional)…" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button className="btn-secondary" onClick={() => setApproveModal(false)}>Cancel</button>
            <button className="btn-primary" onClick={() => { setApproveModal(false); approve.mutate(approveRemarks); setApproveRemarks('') }}>Confirm Approval</button>
          </div>
        </div>
      </Modal>

      {/* Post-Event Submit Modal */}
      <Modal open={postSubmitModal} onClose={() => setPostSubmitModal(false)} title="Submit Post-Event for Approval">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Post-event documents will be submitted for the following approval workflow:</p>
          <div className="space-y-2">
            {(workflowSteps?.post_steps || []).map((step, i) => (
              <div key={step.step_order} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {step.step_order}
                </div>
                <span className="text-sm font-medium">{step.step_label}</span>
                {i < (workflowSteps?.post_steps || []).length - 1 && <span className="text-gray-300 text-xs">→</span>}
              </div>
            ))}
          </div>
          <div>
            <label className="label">Remarks</label>
            <textarea className="input h-20" value={postRemarks} onChange={e => setPostRemarks(e.target.value)} placeholder="Add remarks for post-event submission (optional)…" />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button className="btn-secondary" onClick={() => setPostSubmitModal(false)}>Cancel</button>
            <button className="btn-primary" disabled={postSubmitting} onClick={async () => {
              setPostSubmitModal(false)
              setPostSubmitting(true)
              try {
                for (const [docTypeId, file] of Object.entries(postDocUploads)) {
                  const docType = postEventDocTypes.find(d => d.id === parseInt(docTypeId))
                  const formData = new FormData()
                  formData.append('file', file)
                  formData.append('document_type', docType?.name || 'Post-Event')
                  formData.append('stage', 'post')
                  await eventsApi.uploadDocument(id, formData)
                }
                await eventsApi.submitPostEvent(id, postRemarks)
                qc.invalidateQueries(['event', id])
                toast.success('Post-event documents submitted for approval')
                setPostDocUploads({})
                setPostRemarks('')
              } catch (e) {
                toast.error(e.response?.data?.detail || 'Error submitting post-event documents')
              } finally {
                setPostSubmitting(false)
              }
            }}>Confirm & Submit</button>
          </div>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Reject Event">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Please provide a reason for rejection:</p>
          <div>
            <label className="label">Rejection Reason *</label>
            <textarea className="input h-24" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection…" />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setRejectModal(false)}>Cancel</button>
            <button className="btn-danger" onClick={() => { reject.mutate(rejectReason); setRejectReason('') }} disabled={!rejectReason}>Reject</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
