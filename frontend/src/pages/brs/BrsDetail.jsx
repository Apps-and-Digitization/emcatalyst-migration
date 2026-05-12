import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import {
  ArrowLeft, CheckCircle, XCircle, Send, Link2, Building2,
  DollarSign, FileCheck, Eye, Copy, Clock, User, ChevronDown, ChevronUp
} from 'lucide-react'
import { brsApi } from '../../api/endpoints'
import PageHeader from '../../components/ui/PageHeader'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'

const ALL_STATUSES = [
  'Draft', 'Pending L1', 'Pending L2', 'Pending Compliance',
  'Pending HCP Form', 'Pending Survey', 'Pending Sign',
  'Survey Completed', 'Pending Coord. Verification',
  'Pending Vendor Creation', 'Pending Finance', 'Posted', 'Paid'
]

const STATUS_COLORS = {
  'Draft': 'bg-gray-100 text-gray-700',
  'Pending L1': 'bg-yellow-100 text-yellow-700',
  'Pending L2': 'bg-orange-100 text-orange-700',
  'Pending Compliance': 'bg-purple-100 text-purple-700',
  'Pending HCP Form': 'bg-blue-100 text-blue-700',
  'Pending Survey': 'bg-indigo-100 text-indigo-700',
  'Pending Sign': 'bg-pink-100 text-pink-700',
  'Survey Completed': 'bg-teal-100 text-teal-700',
  'Pending Coord. Verification': 'bg-cyan-100 text-cyan-700',
  'Pending Vendor Creation': 'bg-amber-100 text-amber-700',
  'Pending Finance': 'bg-lime-100 text-lime-700',
  'Posted': 'bg-green-100 text-green-700',
  'Paid': 'bg-emerald-100 text-emerald-800',
}

function Stepper({ currentStatus }) {
  const idx = ALL_STATUSES.indexOf(currentStatus)
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-center min-w-max">
        {ALL_STATUSES.map((s, i) => (
          <div key={s} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
                ${i < idx ? 'bg-green-500 border-green-500 text-white'
                  : i === idx ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-300 text-gray-400'}`}>
                {i < idx ? <CheckCircle size={14} /> : i + 1}
              </div>
              <p className={`text-[9px] mt-1 w-16 text-center leading-tight
                ${i === idx ? 'text-blue-600 font-semibold' : i < idx ? 'text-green-600' : 'text-gray-400'}`}>
                {s}
              </p>
            </div>
            {i < ALL_STATUSES.length - 1 && (
              <div className={`h-0.5 w-6 mx-0.5 mb-5 ${i < idx ? 'bg-green-400' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function BrsDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [remarksModal, setRemarksModal] = useState(null) // { fn, label }
  const [remarks, setRemarks] = useState('')
  const [surveyLink, setSurveyLink] = useState('')
  const [showAudit, setShowAudit] = useState(false)

  const { data: app, isLoading } = useQuery({
    queryKey: ['brs', id],
    queryFn: () => brsApi.get(id).then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['brs', id] })

  const onSuccess = (msg) => () => { toast.success(msg); invalidate() }
  const onError = (e) => toast.error(e.response?.data?.detail || 'Action failed')

  const submitMut = useMutation({
    mutationFn: () => brsApi.submit(id),
    onSuccess: onSuccess('Submitted for L1 approval'), onError,
  })
  const appL1Mut = useMutation({
    mutationFn: () => brsApi.approveL1(id, remarks),
    onSuccess: onSuccess('L1 Approved'), onError,
  })
  const appL2Mut = useMutation({
    mutationFn: () => brsApi.approveL2(id, remarks),
    onSuccess: onSuccess('L2 Approved'), onError,
  })
  const appCompMut = useMutation({
    mutationFn: () => brsApi.approveCompliance(id, remarks),
    onSuccess: onSuccess('Compliance Approved'), onError,
  })
  const rejectMut = useMutation({
    mutationFn: () => brsApi.reject(id, remarks),
    onSuccess: onSuccess('Returned to Draft'), onError,
  })
  const coordMut = useMutation({
    mutationFn: () => brsApi.verifyCoord(id, remarks),
    onSuccess: onSuccess('Coordinator verified'), onError,
  })
  const vendorNotifyMut = useMutation({
    mutationFn: () => brsApi.triggerVendorCreation(id),
    onSuccess: onSuccess('Vendor creation notification sent'), onError,
  })
  const vendorCreatedMut = useMutation({
    mutationFn: () => brsApi.markVendorCreated(id),
    onSuccess: onSuccess('Vendor linked'), onError,
  })
  const financeMut = useMutation({
    mutationFn: () => brsApi.postFinance(id, remarks),
    onSuccess: onSuccess('Posted to Finance'), onError,
  })
  const paidMut = useMutation({
    mutationFn: () => brsApi.markPaid(id, remarks),
    onSuccess: onSuccess('Marked as Paid'), onError,
  })
  const completeMut = useMutation({
    mutationFn: () => brsApi.completeSurvey(id),
    onSuccess: onSuccess('Moved to Coord. Verification'), onError,
  })

  const sendLinkMut = useMutation({
    mutationFn: () => brsApi.sendSurveyLink(id),
    onSuccess: (res) => {
      toast.success('Survey link sent to doctor!')
      setSurveyLink(res.data.survey_link)
      invalidate()
    },
    onError,
  })

  const openAction = (mut, label) => {
    setRemarks('')
    setRemarksModal({ mut, label })
  }

  const confirmAction = () => {
    remarksModal.mut.mutate()
    setRemarksModal(null)
  }

  if (isLoading) return <LoadingSpinner />
  if (!app) return <div className="p-8 text-gray-500">Application not found.</div>

  const doctor = app.doctor || {}
  const isRejectable = !['Paid', 'Posted', 'Draft'].includes(app.status)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title={app.brs_code}
        subtitle={app.survey_title}
        actions={
          <button className="btn-secondary flex items-center gap-2" onClick={() => navigate('/brs')}>
            <ArrowLeft size={16} /> Back
          </button>
        }
      />

      {/* Status Stepper */}
      <div className="card p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[app.status] || 'bg-gray-100 text-gray-700'}`}>
              {app.status}
            </span>
            {app.rejection_reason && (
              <span className="text-xs text-red-500">↩ {app.rejection_reason}</span>
            )}
          </div>
        </div>
        <Stepper currentStatus={app.status} />
      </div>

      {/* Action Bar */}
      <div className="card p-4 mb-6 flex flex-wrap gap-2">
        {app.status === 'Draft' && (
          <button className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => submitMut.mutate()} disabled={submitMut.isPending}>
            <Send size={15} /> Submit for Approval
          </button>
        )}
        {app.status === 'Pending L1' && (
          <button className="btn-primary bg-yellow-600 hover:bg-yellow-700 flex items-center gap-2 text-sm"
            onClick={() => openAction(appL1Mut, 'L1 Approve')}>
            <CheckCircle size={15} /> L1 Approve
          </button>
        )}
        {app.status === 'Pending L2' && (
          <button className="btn-primary bg-orange-600 hover:bg-orange-700 flex items-center gap-2 text-sm"
            onClick={() => openAction(appL2Mut, 'L2 Approve')}>
            <CheckCircle size={15} /> L2 Approve
          </button>
        )}
        {app.status === 'Pending Compliance' && (
          <button className="btn-primary bg-purple-600 hover:bg-purple-700 flex items-center gap-2 text-sm"
            onClick={() => openAction(appCompMut, 'Compliance Approve')}>
            <CheckCircle size={15} /> Compliance Approve
          </button>
        )}
        {app.status === 'Pending HCP Form' && (
          <button className="btn-primary flex items-center gap-2 text-sm"
            onClick={() => sendLinkMut.mutate()} disabled={sendLinkMut.isPending}>
            <Link2 size={15} /> {sendLinkMut.isPending ? 'Sending…' : 'Send Survey Link to Doctor'}
          </button>
        )}
        {app.status === 'Survey Completed' && (
          <button className="btn-primary bg-teal-600 hover:bg-teal-700 flex items-center gap-2 text-sm"
            onClick={() => completeMut.mutate()} disabled={completeMut.isPending}>
            <FileCheck size={15} /> Move to Coord. Verification
          </button>
        )}
        {app.status === 'Pending Coord. Verification' && (
          <button className="btn-primary bg-cyan-600 hover:bg-cyan-700 flex items-center gap-2 text-sm"
            onClick={() => openAction(coordMut, 'Coordinator Verify')}>
            <CheckCircle size={15} /> Coordinator Verify
          </button>
        )}
        {app.status === 'Pending Vendor Creation' && (
          <>
            <button className="btn-secondary flex items-center gap-2 text-sm"
              onClick={() => vendorNotifyMut.mutate()} disabled={vendorNotifyMut.isPending}>
              <Building2 size={15} /> Notify MDM Team
            </button>
            <button className="btn-primary bg-amber-600 hover:bg-amber-700 flex items-center gap-2 text-sm"
              onClick={() => vendorCreatedMut.mutate()} disabled={vendorCreatedMut.isPending}>
              <CheckCircle size={15} /> Mark Vendor Created
            </button>
          </>
        )}
        {app.status === 'Pending Finance' && (
          <button className="btn-primary bg-lime-600 hover:bg-lime-700 flex items-center gap-2 text-sm"
            onClick={() => openAction(financeMut, 'Post to Finance')}>
            <DollarSign size={15} /> Post to Finance
          </button>
        )}
        {app.status === 'Posted' && (
          <button className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2 text-sm"
            onClick={() => openAction(paidMut, 'Mark as Paid')}>
            <CheckCircle size={15} /> Mark as Paid
          </button>
        )}
        {isRejectable && (
          <button className="btn-secondary text-red-600 border-red-300 hover:bg-red-50 flex items-center gap-2 text-sm"
            onClick={() => openAction(rejectMut, 'Reject / Return to Draft')}>
            <XCircle size={15} /> Reject
          </button>
        )}
      </div>

      {/* Survey Link */}
      {(surveyLink || app.survey_link_sent_at) && (
        <div className="card p-4 mb-6 bg-blue-50 border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Link2 size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-blue-800">Doctor Survey Link</span>
            {app.survey_link_sent_at && (
              <span className="text-xs text-blue-500">Sent {new Date(app.survey_link_sent_at).toLocaleString()}</span>
            )}
          </div>
          {surveyLink && (
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white px-3 py-2 rounded border text-blue-700 truncate">{surveyLink}</code>
              <button className="btn-secondary py-1 px-2 text-xs flex items-center gap-1"
                onClick={() => { navigator.clipboard.writeText(surveyLink); toast.success('Link copied!') }}>
                <Copy size={13} /> Copy
              </button>
              <a href={surveyLink} target="_blank" rel="noreferrer"
                className="btn-secondary py-1 px-2 text-xs flex items-center gap-1">
                <Eye size={13} /> Open
              </a>
            </div>
          )}
        </div>
      )}

      {/* Info Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="card p-5 lg:col-span-2">
          <h4 className="font-semibold text-gray-800 mb-3">Survey Details</h4>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div><dt className="text-gray-500">Therapeutic Area</dt><dd className="font-medium">{app.therapeutic_area || '—'}</dd></div>
            <div><dt className="text-gray-500">Brand</dt><dd className="font-medium">{app.brand || '—'}</dd></div>
            <div><dt className="text-gray-500">Mode</dt><dd className="font-medium">{app.mode}</dd></div>
            <div><dt className="text-gray-500">Duration</dt><dd className="font-medium">{app.survey_duration_minutes} min</dd></div>
            <div><dt className="text-gray-500">Honorarium</dt>
              <dd className="font-semibold text-green-700">
                {app.honorarium_amount > 0 ? `₹${app.honorarium_amount.toLocaleString('en-IN')}` : '—'}
              </dd>
            </div>
            <div><dt className="text-gray-500">Initiated by</dt><dd className="font-medium">{app.initiator?.name || '—'}</dd></div>
            {app.topic && (
              <div className="col-span-2"><dt className="text-gray-500">Topic</dt><dd className="mt-1 text-gray-700">{app.topic}</dd></div>
            )}
          </dl>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 mb-3">
            <User size={16} className="text-gray-500" />
            <h4 className="font-semibold text-gray-800">Doctor</h4>
            {app.is_new_doctor && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">New</span>}
          </div>
          <dl className="space-y-2 text-sm">
            <div><dt className="text-gray-500 text-xs">Name</dt><dd className="font-medium">{doctor.name || '—'}</dd></div>
            <div><dt className="text-gray-500 text-xs">Email</dt><dd className="text-blue-600 text-xs">{doctor.email || '—'}</dd></div>
            <div><dt className="text-gray-500 text-xs">Phone</dt><dd>{doctor.phone || '—'}</dd></div>
            <div><dt className="text-gray-500 text-xs">Speciality</dt><dd>{doctor.speciality || '—'}</dd></div>
            <div><dt className="text-gray-500 text-xs">City</dt><dd>{doctor.city || '—'}</dd></div>
            {app.pan_number && <div><dt className="text-gray-500 text-xs">PAN</dt><dd className="font-mono text-xs">{app.pan_number}</dd></div>}
          </dl>
        </div>
      </div>

      {/* Approval Chain */}
      <div className="card p-5 mb-6">
        <h4 className="font-semibold text-gray-800 mb-3">Approval Chain</h4>
        <div className="flex flex-wrap items-stretch gap-3">
          {[
            { label: 'Initiator', data: app.initiator, color: 'border-blue-400 bg-blue-50', badge: 'bg-blue-100 text-blue-700' },
            { label: 'L1 Manager', data: app.l1_approver, color: 'border-indigo-400 bg-indigo-50', badge: 'bg-indigo-100 text-indigo-700' },
            { label: 'L2 Manager', data: app.l2_approver, color: 'border-purple-400 bg-purple-50', badge: 'bg-purple-100 text-purple-700' },
          ].map(({ label, data, color, badge }) => (
            <div key={label} className={`flex-1 min-w-[160px] border-l-4 rounded-r-xl p-3 ${color}`}>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badge}`}>{label}</span>
              {data ? (
                <div className="mt-2">
                  <p className="font-semibold text-gray-900 text-sm">{data.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{data.designation || '—'}</p>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{data.employee_id}</p>
                  {data.approved_at && (
                    <p className="text-xs text-green-600 mt-1">✓ Approved {new Date(data.approved_at).toLocaleDateString()}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-2">Not assigned</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bank Details */}
      {(app.bank_name || app.bank_account_no) && (
        <div className="card p-5 mb-6">
          <h4 className="font-semibold text-gray-800 mb-3">Bank Details</h4>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div><dt className="text-gray-500 text-xs">Bank Name</dt><dd className="font-medium">{app.bank_name || '—'}</dd></div>
            <div><dt className="text-gray-500 text-xs">Account No</dt><dd className="font-mono text-xs">{app.bank_account_no || '—'}</dd></div>
            <div><dt className="text-gray-500 text-xs">IFSC</dt><dd className="font-mono text-xs">{app.ifsc_code || '—'}</dd></div>
          </dl>
        </div>
      )}

      {/* Signature status */}
      {app.agreement_signed_at && (
        <div className="card p-5 mb-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-green-600" />
            <div>
              <p className="font-semibold text-green-800 text-sm">Agreement Digitally Signed</p>
              <p className="text-green-600 text-xs">
                Signed on {new Date(app.agreement_signed_at).toLocaleString()}
                {app.signature_otp_verified && ' · OTP Verified'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Survey Responses */}
      {app.survey_responses && app.survey && (
        <div className="card p-5 mb-6">
          <h4 className="font-semibold text-gray-800 mb-3">Survey Responses</h4>
          <div className="space-y-3">
            {app.survey.questions.map(q => (
              <div key={q.id} className="border-l-2 border-blue-200 pl-4">
                <p className="text-sm font-medium text-gray-700">{q.order_no}. {q.question_text}</p>
                <p className="text-sm text-gray-600 mt-1">
                  {Array.isArray(app.survey_responses[q.id])
                    ? app.survey_responses[q.id].join(', ')
                    : app.survey_responses[q.id] || <span className="text-gray-400 italic">No response</span>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Trail */}
      <div className="card mb-6">
        <button className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700"
          onClick={() => setShowAudit(v => !v)}>
          <div className="flex items-center gap-2"><Clock size={16} /> Audit Trail ({app.audit_trail?.length || 0})</div>
          {showAudit ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {showAudit && (
          <div className="border-t divide-y">
            {(app.audit_trail || []).map((t, i) => (
              <div key={i} className="px-5 py-3 flex items-start gap-4 text-sm">
                <div className="w-36 shrink-0 text-xs text-gray-400">
                  {t.created_at ? new Date(t.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-700">{t.action}</p>
                  {t.from_status && t.to_status && t.from_status !== t.to_status && (
                    <p className="text-xs text-gray-400">{t.from_status} → {t.to_status}</p>
                  )}
                  {t.remarks && <p className="text-xs text-gray-500 mt-0.5">{t.remarks}</p>}
                </div>
                <div className="text-xs text-gray-500 w-28 text-right shrink-0">{t.performed_by || 'System'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Remarks Modal */}
      {remarksModal && (
        <Modal title={remarksModal.label} onClose={() => setRemarksModal(null)}>
          <div className="p-5 space-y-4">
            <div>
              <label className="label">Remarks (optional)</label>
              <textarea className="input" rows={3} value={remarks}
                onChange={e => setRemarks(e.target.value)}
                placeholder="Add any comments or notes…" />
            </div>
            <div className="flex gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setRemarksModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={confirmAction}>Confirm</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
