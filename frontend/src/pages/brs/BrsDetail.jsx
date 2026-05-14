import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import { brsApi } from '../../api/endpoints'
import api from '../../api/client'
import { fmtDate, fmtCurrency } from '../../utils/helpers'
import PageHeader from '../../components/ui/PageHeader'
import StatusBadge from '../../components/ui/StatusBadge'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import Modal from '../../components/ui/Modal'
import { ArrowLeft, CheckCircle, XCircle, Clock, Download, Edit2 } from 'lucide-react'
import useAuthStore from '../../store/authStore'

export default function BrsDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const { data: brs, isLoading } = useQuery({
    queryKey: ['brs', id],
    queryFn: () => brsApi.get(id).then(r => r.data),
  })

  const { data: canApproveData } = useQuery({
    queryKey: ['brs-can-approve', id],
    queryFn: () => api.get(`/brs/${id}/can-approve`).then(r => r.data).catch(() => ({ can_approve: false })),
    enabled: !!brs && brs.status === 'Submitted',
  })

  const { data: canInitiateData } = useQuery({
    queryKey: ['brs-can-initiate'],
    queryFn: () => api.get('/workflows/can-initiate/brs_approval').then(r => r.data).catch(() => ({ can_initiate: false })),
  })

  const approve = useMutation({
    mutationFn: (remarks) => brsApi.approve(id, remarks),
    onSuccess: () => { qc.invalidateQueries(['brs', id]); toast.success('BRS Approved. Doctor credentials generated.') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const submit = useMutation({
    mutationFn: () => brsApi.submit(id),
    onSuccess: () => { qc.invalidateQueries(['brs', id]); toast.success('BRS submitted for approval') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  const reject = useMutation({
    mutationFn: (reason) => brsApi.reject(id, reason),
    onSuccess: () => { qc.invalidateQueries(['brs', id]); setRejectModal(false); toast.success('BRS Rejected') },
    onError: (e) => toast.error(e.response?.data?.detail || 'Error'),
  })

  if (isLoading) return <div className="p-8"><LoadingSpinner /></div>
  if (!brs) return <div className="p-8 text-red-500">BRS not found</div>

  const canApprove = canApproveData?.can_approve === true
  const canSubmit = canInitiateData?.can_initiate === true

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/brs')} className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></button>
          <div>
            <h1 className="text-xl font-bold">{brs.title || brs.survey_title}</h1>
            <p className="text-sm text-gray-500">{brs.brs_code}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {brs.status === 'Draft' && !brs.is_bulk_imported && (
            <button className="btn-secondary flex items-center gap-1" onClick={() => navigate(`/brs/${id}/edit`)}><Edit2 size={14} /> Edit</button>
          )}
          {brs.status === 'Draft' && brs.is_bulk_imported && canSubmit && (
            <button className="btn-primary flex items-center gap-1" onClick={() => submit.mutate()} disabled={submit.isPending}>
              <CheckCircle size={15} /> {submit.isPending ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
          {canApprove && <>
            <button className="btn-primary bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1" onClick={() => approve.mutate('')} disabled={approve.isPending}>
              <CheckCircle size={15} /> {approve.isPending ? 'Approving...' : 'Approve'}
            </button>
            <button className="btn-danger flex items-center gap-1" onClick={() => setRejectModal(true)} disabled={approve.isPending}>
              <XCircle size={15} /> Reject
            </button>
          </>}
          {user?.role === 'Administrator' && (
            <button className="btn-danger flex items-center gap-1 text-xs" onClick={async () => {
              if (!confirm(`Delete BRS ${brs.brs_code}? This cannot be undone.`)) return
              try { await api.delete(`/brs/${id}`); toast.success('BRS deleted'); navigate('/brs') } catch(e) { toast.error(e.response?.data?.detail || 'Error') }
            }}><XCircle size={14} /> Delete</button>
          )}
          <StatusBadge status={brs.status} />
        </div>
      </div>

      {/* BRS Info */}
      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Basic Details</h3>
        <div className="grid grid-cols-4 gap-4">
          <div><p className="text-xs text-gray-400">Created By</p><p className="text-sm font-medium">{brs.created_by?.name || '—'}</p></div>
          <div><p className="text-xs text-gray-400">Division</p><p className="text-sm font-medium">{brs.division_id || '—'}</p></div>
          <div><p className="text-xs text-gray-400">Cost Center</p><p className="text-sm font-medium">{brs.cost_center || '—'}</p></div>
          <div><p className="text-xs text-gray-400">Survey</p><p className="text-sm font-medium">{brs.survey_title}</p></div>
          <div><p className="text-xs text-gray-400">Title</p><p className="text-sm font-medium">{brs.title || '—'}</p></div>
          <div><p className="text-xs text-gray-400">Brand</p><p className="text-sm font-medium">{brs.brand || '—'}</p></div>
          <div><p className="text-xs text-gray-400">Therapeutic Area</p><p className="text-sm font-medium">{brs.therapeutic_area || '—'}</p></div>
          <div><p className="text-xs text-gray-400">Total Honorarium</p><p className="text-sm font-medium">{fmtCurrency(brs.total_honorarium_amount)}</p></div>
          {brs.topic && <div className="col-span-2"><p className="text-xs text-gray-400">Topic</p><p className="text-sm">{brs.topic}</p></div>}
        </div>
      </div>

      {/* Event Info */}
      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Event Information</h3>
        <div className="grid grid-cols-4 gap-4">
          <div><p className="text-xs text-gray-400">On Field Execution By</p><p className="text-sm font-medium">{brs.on_field_execution_by || '—'}</p></div>
          <div><p className="text-xs text-gray-400">Start Date</p><p className="text-sm font-medium">{fmtDate(brs.start_date)}</p></div>
          <div><p className="text-xs text-gray-400">End Date</p><p className="text-sm font-medium">{fmtDate(brs.end_date)}</p></div>
          <div><p className="text-xs text-gray-400">Created At</p><p className="text-sm font-medium">{fmtDate(brs.created_at)}</p></div>
          {brs.approved_by && <div><p className="text-xs text-gray-400">Approved By</p><p className="text-sm font-medium">{brs.approved_by.name}</p></div>}
          {brs.approved_at && <div><p className="text-xs text-gray-400">Approved At</p><p className="text-sm font-medium">{fmtDate(brs.approved_at)}</p></div>}
        </div>
        {brs.rationale && <div className="mt-3"><p className="text-xs text-gray-400">Rationale</p><p className="text-sm bg-gray-50 p-2 rounded">{brs.rationale}</p></div>}
        {brs.agenda && <div className="mt-3"><p className="text-xs text-gray-400">Agenda</p><p className="text-sm bg-gray-50 p-2 rounded">{brs.agenda}</p></div>}
        {brs.remarks && <div className="mt-3"><p className="text-xs text-gray-400">Remarks</p><p className="text-sm bg-gray-50 p-2 rounded">{brs.remarks}</p></div>}
      </div>

      {/* Rejection reason */}
      {brs.rejection_reason && (
        <div className="card mb-4 bg-red-50 border-red-200">
          <p className="text-xs text-red-400 mb-1">Rejection Reason</p>
          <p className="text-sm text-red-700">{brs.rejection_reason}</p>
        </div>
      )}

      {/* Doctors */}
      <div className="card mb-4">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Doctors ({brs.doctors?.length || 0})</h3>
        {brs.doctors?.length > 0 ? (
          <div className="overflow-x-auto border rounded-lg">
            <table className="text-sm w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  {['Name', 'Name As Per PAN', 'PAN', 'Email', 'Speciality', 'Honorarium', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {brs.doctors.map(d => (
                  <tr key={d.id}>
                    <td className="px-3 py-2 font-medium">{d.doctor_name}</td>
                    <td className="px-3 py-2">{d.name_as_per_pan || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{d.pan_number || '—'}</td>
                    <td className="px-3 py-2 text-xs">{d.email || '—'}</td>
                    <td className="px-3 py-2 text-xs">{d.speciality || '—'}</td>
                    <td className="px-3 py-2">{d.honorarium_amount ? fmtCurrency(d.honorarium_amount) : '—'}</td>
                    <td className="px-3 py-2"><StatusBadge status={d.doctor_status} /></td>
                    <td className="px-3 py-2">
                      {(d.has_signature || d.survey_responses) && (
                        <button
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                          onClick={async () => {
                            let agreementData = null
                            if (d.has_signature) {
                              try { agreementData = (await brsApi.getDoctorAgreement(d.id)).data } catch(e) {}
                            }
                            const responses = d.survey_responses || {}
                            const docs = d.uploaded_documents || []
                            const today = new Date().toLocaleDateString('en-IN')
                            const w = window.open('', '_blank')
                            w.document.write(`
<html><head><title>BRS Document - ${d.doctor_name}</title>
<style>
body{font-family:Arial,sans-serif;padding:40px 50px;max-width:800px;margin:auto;font-size:12px;line-height:1.6;color:#333}
h2{text-align:center;font-size:15px;margin-bottom:2px}
h3{font-size:13px;margin-top:30px;padding-bottom:5px;border-bottom:2px solid #003087;color:#003087}
.subtitle{text-align:center;font-size:11px;color:#666;margin-bottom:25px}
.to-block{margin-bottom:15px}
ol{padding-left:18px;font-size:11px}
ol li{margin-bottom:8px}
.sig-section{margin-top:30px;display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:20px}
.sig-box{width:45%}
.sig-box p{margin:3px 0;font-size:11px}
.sig-box img{max-height:60px;margin-top:5px}
.qa{margin-bottom:12px;padding:8px 12px;border:1px solid #e5e7eb;border-radius:4px}
.qa .q{font-weight:bold;font-size:11px;color:#374151}
.qa .a{color:#1f2937;padding-left:10px;margin-top:3px}
.doc-list{margin-top:10px}
.doc-item{padding:6px 10px;border:1px solid #e5e7eb;border-radius:4px;margin-bottom:6px;font-size:11px}
.page-break{page-break-before:always}
@media print{.no-print{display:none}body{padding:20px 30px}}
</style></head><body>

<!-- SECTION 1: AGREEMENT -->
${agreementData ? `
<h2>EXPERT SERVICES AGREEMENT (Survey)</h2>
<p class="subtitle">BRS ID: ${brs.brs_code} / Date: ${agreementData.agreement_signed_at ? new Date(agreementData.agreement_signed_at).toLocaleDateString('en-IN') : today}</p>
<div class="to-block"><p>To,</p><p><strong>Dr. ${agreementData.name_as_per_pan || agreementData.doctor_name}</strong></p></div>
<p><strong>Usage of:</strong> ${brs.survey_title || brs.title || ''}<br/><strong>Amount:</strong> INR ${Number(agreementData.honorarium_amount).toLocaleString('en-IN')}/-</p>
<ol>
<li>We wish to seek your expert advice on usage of the above mentioned subject. We are pleased to appoint you as an Expert representing Emcure Pharmaceuticals Limited.</li>
<li>You are requested to advise and update the Company on developments and issues in the field mentioned above, in form of written opinions or expert survey reports.</li>
<li>The period for your services shall begin on the date you sign this Agreement and shall continue for one (1) year.</li>
<li>Emcure will pay you a onetime service fee of <strong>INR ${Number(agreementData.honorarium_amount).toLocaleString('en-IN')}/-</strong> subject to statutory deductions.</li>
<li>You agree not to disclose confidential information to third parties.</li>
<li>Your opinion/surveys on the topics shall be an integral part of the deliverable.</li>
<li>Your responsibilities are in no way linked to prescribing or promoting Emcure's products.</li>
<li>You agree to fulfill all obligations in accordance with professional standards and applicable laws.</li>
<li>Any documentation created within the scope of this agreement shall be the property of Emcure.</li>
<li>You confirm no conflict of interest which would prevent you from acting as an Expert.</li>
<li>This Agreement is governed by laws of India. Disputes decided by arbitration at Pune.</li>
</ol>
<div class="sig-section">
<div class="sig-box"><p><strong>HCP Name:</strong></p><p>${agreementData.name_as_per_pan || agreementData.doctor_name}</p><p style="margin-top:12px"><strong>Signature:</strong></p><img src="${agreementData.signature}" /></div>
<div class="sig-box"><p><strong>Emcure Authorized Signatory</strong></p><p>Name: _______________</p><p style="margin-top:12px">Sign: _______________</p></div>
</div>
` : '<p><em>Agreement not yet signed</em></p>'}

<!-- SECTION 2: SURVEY RESPONSES -->
<div class="${agreementData ? 'page-break' : ''}">
<h3>Survey Responses</h3>
<p style="font-size:11px;color:#666">Doctor: ${d.doctor_name} | Completed: ${d.survey_completed_at ? new Date(d.survey_completed_at).toLocaleDateString('en-IN') : 'Pending'}</p>
${Object.keys(responses).length > 0 ? Object.entries(responses).map(([qId, val]) => {
  const question = typeof val === 'object' && val?.question ? val.question : 'Question ' + qId
  const answer = typeof val === 'object' && val?.answer != null ? (Array.isArray(val.answer) ? val.answer.join(', ') : val.answer) : (typeof val === 'string' ? val : (Array.isArray(val) ? val.join(', ') : String(val || '—')))
  return '<div class="qa"><div class="q">' + question + '</div><div class="a">' + (answer || '—') + '</div></div>'
}).join('') : '<p><em>Survey not yet completed</em></p>'}
</div>

<!-- SECTION 3: UPLOADED DOCUMENTS -->
<div class="page-break">
<h3>Uploaded Documents</h3>
${docs.length > 0 ? docs.map(doc => {
  const isImage = doc.document_name?.match(/\.(png|jpg|jpeg)$/i)
  const isPdf = doc.document_name?.match(/\.pdf$/i)
  const fileUrl = '/' + doc.file_path
  if (isImage) {
    return '<div class="page-break" style="text-align:center"><p style="font-size:11px;color:#666;margin-bottom:10px"><strong>' + doc.document_type.replace(/_/g, ' ').toUpperCase() + '</strong> — ' + doc.document_name + '</p><img src="' + fileUrl + '" style="max-width:100%;max-height:90vh;border:1px solid #ddd" /></div>'
  } else if (isPdf) {
    return '<div class="page-break"><p style="font-size:11px;color:#666;margin-bottom:10px"><strong>' + doc.document_type.replace(/_/g, ' ').toUpperCase() + '</strong> — ' + doc.document_name + '</p><iframe src="' + fileUrl + '" style="width:100%;height:90vh;border:1px solid #ddd"></iframe></div>'
  }
  return '<div class="page-break"><p><strong>' + doc.document_type.replace(/_/g, ' ').toUpperCase() + ':</strong> ' + doc.document_name + ' <a href="' + fileUrl + '" target="_blank">[Open]</a></p></div>'
}).join('') : '<p><em>No documents uploaded</em></p>'}

<div class="no-print" style="margin-top:30px;text-align:center">
<button onclick="window.print()" style="padding:10px 30px;background:#003087;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:14px">Download as PDF</button>
</div>
</body></html>`)
                            w.document.close()
                          }}
                        >
                          <Download size={12} /> Download
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="text-sm text-gray-400">No doctors added.</p>}
      </div>

      {/* Audit Trail */}
      <div className="card">
        <h3 className="font-semibold text-sm text-gray-700 mb-3 uppercase tracking-wide">Audit Trail</h3>
        {brs.audit_trail?.length > 0 ? (
          <div className="space-y-2">
            {brs.audit_trail.map((entry, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-blue-500' : 'bg-gray-300'}`} />
                <div>
                  <span className="font-medium">{entry.action}</span>
                  {entry.to_status && <> → <StatusBadge status={entry.to_status} /></>}
                  <p className="text-xs text-gray-500">by {entry.performed_by} • {fmtDate(entry.created_at)}</p>
                  {entry.remarks && <p className="text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded mt-1">{entry.remarks}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : <p className="text-sm text-gray-400">No audit trail.</p>}
      </div>

      {/* Reject Modal */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title="Reject BRS">
        <div className="space-y-4">
          <textarea className="input h-24" value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Reason for rejection…" />
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setRejectModal(false)}>Cancel</button>
            <button className="btn-danger" onClick={() => reject.mutate(rejectReason)} disabled={!rejectReason}>Reject</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
